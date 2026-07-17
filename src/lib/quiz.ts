import type { QuizFeedback, QuizQuestion, QuizState } from "./types";

function truncateNotes(notes: string, maxChars = 3500): string {
  const trimmed = notes.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[Notes truncated for speed]`;
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•]+\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\d+\s+(?=[A-Za-z])/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Turn a notes fragment into a short, complete model answer. */
export function polishAnswer(raw: string, maxLen = 160): string {
  let t = raw
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-–—]+\s*/, "")
    .trim();

  // Drop trailing incomplete clauses
  t = t.replace(/\s+\b(and|or|the|of|to|with|for|a|an|in|on|by)$/i, "");

  if (t.length > maxLen) {
    const cut = t.slice(0, maxLen);
    const lastStop = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("; "),
      cut.lastIndexOf(", "),
    );
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastStop > 40 ? cut.slice(0, lastStop) : lastSpace > 60 ? cut.slice(0, lastSpace) : cut)
      .trim()
      .replace(/[,;:]$/, "");
  }

  if (!t) return raw.trim().slice(0, maxLen);
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

function extractConceptAnswer(
  line: string | undefined,
  topic: string,
  fallback: string,
): string {
  if (!line) return polishAnswer(fallback);

  const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const colon = line.match(new RegExp(`${escaped}[^:]{0,40}:\\s*(.+)`, "i"));
  if (colon?.[1] && colon[1].trim().length > 15) {
    return polishAnswer(colon[1]);
  }

  const isMatch = line.match(
    new RegExp(`${escaped}\\s+(?:is|are|means|refers to)\\s+(.+)`, "i"),
  );
  if (isMatch?.[1] && isMatch[1].trim().length > 15) {
    return polishAnswer(isMatch[1]);
  }

  const trimmed = line.trim();
  // Mid-sentence PDF scraps are worse than a clean fallback
  if (
    /^(primarily|mainly|also|and|the|a|an|which|that|this|these|those)\b/i.test(
      trimmed,
    )
  ) {
    return polishAnswer(fallback);
  }
  if (/\b(and|or|the|of|to|with|for)$/i.test(trimmed.slice(0, 140))) {
    return polishAnswer(fallback);
  }

  const polished = polishAnswer(trimmed);
  return polished.length >= 24 ? polished : polishAnswer(fallback);
}

export function createEmptyQuiz(): QuizState {
  return {
    active: false,
    questions: [],
    currentIndex: 0,
    score: 0,
    weakTopics: [],
  };
}

export const QUIZ_GEMMA_PROMPT = `You are MwanaAI, writing a quiz from NOTES only.
Test understanding, not memorization of course codes/headings/URLs.
Mix difficulty across 5 questions: ~2 easy, ~2 medium, ~1 harder.
One concept per question. No trick questions.

Output exactly 5 lines:
Q|question|short expected answer|topic

Example:
Q|What is a population?|All individuals under study|Sampling
Q|How does descriptive statistics differ from inferential?|Descriptive summarizes data; inferential concludes about a population|Inference`;

/** Course codes / catalog junk — never quiz on these. */
function isCourseCodeOrMeta(term: string): boolean {
  const t = term.trim();
  if (!t) return true;
  // MATH10282, CS101, STAT-200, MATH 10282
  if (/^[A-Z]{2,6}\s?-?\s?\d{2,5}[A-Z]?$/i.test(t)) return true;
  if (/\b[A-Z]{2,6}\d{2,5}[A-Z]?\b/i.test(t) && t.length <= 16) return true;
  if (/^(module|course|unit|chapter|section|lecture|page|week)\b/i.test(t))
    return true;
  if (/^(introduction|overview|contents|references|bibliography)$/i.test(t))
    return true;
  if (/https?:|www\.|doi\./i.test(t)) return true;
  return false;
}

function isGoodQuestion(q: QuizQuestion): boolean {
  const question = q.question.trim();
  const answer = q.expectedAnswer.trim();
  const topic = (q.topic || "").trim();

  if (question.length < 14 || question.length > 160) return false;
  if (answer.length < 8 || answer.length > 160) return false;
  if (/^what\??$/i.test(answer)) return false;
  if (/\bwhat\?\s*$/i.test(question)) return false;
  if (/what is what/i.test(question)) return false;
  if (/^what is \d+/i.test(question)) return false;
  if (/\b(json|markdown|placeholder|constraints?)\b/i.test(question + answer))
    return false;
  if (/^(introduction|overview|contents|chapter)\??$/i.test(answer)) return false;
  if ((question.match(/\bwhat\b/gi) || []).length >= 2) return false;

  // Reject course-code questions: "What is MATH10282?"
  if (/what (is|are)\s+[A-Z]{2,6}\s?-?\s?\d{2,5}/i.test(question)) return false;
  if (isCourseCodeOrMeta(topic)) return false;
  if (isCourseCodeOrMeta(answer) && answer.length < 20) return false;

  // Answer should look like a real explanation, not another code/title stub
  if (/^[A-Z]{2,6}\d{2,5}/i.test(answer)) return false;
  if (/^introduction to\b/i.test(answer) && answer.length < 40) return false;

  return true;
}

function isUsefulTerm(term: string): boolean {
  const t = term.trim();
  if (t.length < 3 || t.length > 42) return false;
  if (isCourseCodeOrMeta(t)) return false;
  if (/^(there|these|this|that|with|from|into|http)\b/i.test(t)) return false;
  if (t.split(/\s+/).length > 4) return false;
  return true;
}

function normalizeQuestions(
  items: Array<{
    id?: string;
    question?: string;
    expectedAnswer?: string;
    topic?: string;
  }>,
): QuizQuestion[] {
  return items
    .map((q, index) => ({
      id: q.id?.trim() || `q${index + 1}`,
      question: (q.question || "").replace(/\s+/g, " ").trim(),
      expectedAnswer: (q.expectedAnswer || "").replace(/\s+/g, " ").trim(),
      topic: (q.topic || "General").replace(/\s+/g, " ").trim() || "General",
    }))
    .filter(isGoodQuestion)
    .slice(0, 5);
}

/** Parse Gemma pipe format: Q|question|answer|topic */
export function parseQuizPipes(raw: string): QuizQuestion[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const items: QuizQuestion[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\s*Q\s*[\|:]?\s*/i, "Q|");
    if (!cleaned.toUpperCase().startsWith("Q|")) continue;

    const parts = cleaned.split("|").map((p) => p.trim());
    // Q | question | answer | topic
    if (parts.length < 3) continue;

    const question = parts[1];
    const expectedAnswer = parts[2];
    const topic = parts[3] || "General";

    items.push({
      id: `q${items.length + 1}`,
      question,
      expectedAnswer: polishAnswer(expectedAnswer),
      topic,
    });
  }

  const good = normalizeQuestions(items);
  if (good.length < 3) throw new Error("Not enough valid pipe quiz lines");
  return good;
}

function extractJsonObject(raw: string): string | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

export function parseQuizJson(raw: string): QuizQuestion[] {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw new Error("No quiz JSON found");

  const parsed = JSON.parse(jsonText) as {
    questions?: Array<{
      id?: string;
      question?: string;
      expectedAnswer?: string;
      topic?: string;
    }>;
  };

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("Quiz JSON missing questions array");
  }

  const questions = normalizeQuestions(parsed.questions);
  if (questions.length < 3) throw new Error("Not enough valid quiz questions");
  return questions;
}

function isDefinitionLine(line: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9 /&-]{1,40}:\s+.{12,}$/.test(line)) return false;
  const label = line.split(":")[0].trim();
  return isUsefulTerm(label);
}

/** Local quiz from clear definition lines in notes. */
export function quizFromNotes(notes: string): QuizQuestion[] {
  const text = truncateNotes(notes, 4000);
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter((l) => l.length >= 16 && l.length <= 180)
    .filter((l) => !/\?$/.test(l))
    .filter((l) => !isCourseCodeOrMeta(l.split(":")[0] || l));

  const definitions = lines.filter(isDefinitionLine);
  const questions: QuizQuestion[] = [];

  for (const fact of definitions) {
    if (questions.length >= 5) break;
    const match = fact.match(/^([A-Za-z][A-Za-z0-9 /&-]{1,40}):\s+(.+)$/);
    if (!match) continue;

    const term = match[1].trim();
    const meaning = match[2].replace(/\.+$/, "").trim();

    if (!isUsefulTerm(term)) continue;
    if (meaning.length < 12) continue;
    if (/^what\b/i.test(meaning)) continue;
    if (isCourseCodeOrMeta(meaning)) continue;

    const candidate: QuizQuestion = {
      id: `q${questions.length + 1}`,
      question: `What is ${term}?`,
      expectedAnswer: polishAnswer(meaning),
      topic: term,
    };

    if (isGoodQuestion(candidate)) questions.push(candidate);
  }

  if (questions.length < 5) {
    for (const fact of lines) {
      if (questions.length >= 5) break;
      if (/^\s*what\b/i.test(fact)) continue;

      const match = fact.match(
        /^([A-Za-z][A-Za-z0-9 /&-]{1,40})\s+(is|are|means|refers to)\s+(.{12,})$/i,
      );
      if (!match) continue;
      if (/\bwhat\b/i.test(match[1])) continue;
      if (!isUsefulTerm(match[1].trim())) continue;

      const term = match[1].trim();
      const meaning = match[3].replace(/\.+$/, "").trim();
      const verb = match[2].toLowerCase() === "are" ? "are" : "is";

      const candidate: QuizQuestion = {
        id: `q${questions.length + 1}`,
        question: `What ${verb} ${term}?`,
        expectedAnswer: polishAnswer(meaning),
        topic: term,
      };
      if (isGoodQuestion(candidate)) questions.push(candidate);
    }
  }

  // Concept bank for common stats ideas present in the notes
  if (questions.length < 5) {
    const conceptBank: Array<{
      re: RegExp;
      q: string;
      fallback: string;
      topic: string;
    }> = [
      {
        re: /\bpopulation\b/i,
        q: "What is a population in statistics?",
        fallback: "All individuals or items under study",
        topic: "Population",
      },
      {
        re: /\bsample\b/i,
        q: "What is a sample in statistics?",
        fallback: "A subset of the population",
        topic: "Sample",
      },
      {
        re: /\bdescriptive statistics\b/i,
        q: "What is descriptive statistics?",
        fallback:
          "Summarizing a given data set through numerical summaries and graphs",
        topic: "Descriptive Statistics",
      },
      {
        re: /\binferential statistics\b/i,
        q: "What is inferential statistics?",
        fallback:
          "Using sample data to make conclusions or predictions about a population",
        topic: "Inferential Statistics",
      },
      {
        re: /\bqualitative\b/i,
        q: "What is a qualitative variable?",
        fallback: "A categorical variable (nominal or ordinal)",
        topic: "Variables",
      },
      {
        re: /\bquantitative\b/i,
        q: "What is a quantitative variable?",
        fallback: "A numerical variable (discrete or continuous)",
        topic: "Variables",
      },
    ];

    for (const item of conceptBank) {
      if (questions.length >= 5) break;
      if (!item.re.test(text)) continue;
      if (questions.some((q) => q.topic === item.topic)) continue;
      const line = lines.find((l) => item.re.test(l) && l.length > 20);
      const candidate: QuizQuestion = {
        id: `q${questions.length + 1}`,
        question: item.q,
        expectedAnswer: extractConceptAnswer(line, item.topic, item.fallback),
        topic: item.topic,
      };
      if (isGoodQuestion(candidate)) questions.push(candidate);
    }
  }

  if (questions.length < 3) {
    const facts = lines.filter(
      (l) =>
        /\b(is|are|means|used|includes|called)\b/i.test(l) &&
        !/[A-Z]{2,6}\d{2,5}/i.test(l),
    );
    for (const fact of facts) {
      if (questions.length >= 5) break;
      if (/^\s*what\b/i.test(fact)) continue;

      const candidate: QuizQuestion = {
        id: `q${questions.length + 1}`,
        question: `According to your notes, explain: ${fact.slice(0, 70)}${fact.length > 70 ? "…" : ""}`,
        expectedAnswer: polishAnswer(fact),
        topic: fact.split(/[:\-–]/)[0]?.slice(0, 36) || "Notes",
      };
      if (isGoodQuestion(candidate)) questions.push(candidate);
    }
  }

  while (questions.length < 3) {
    const n = questions.length + 1;
    const fallbackLine =
      lines.find((l) => !isCourseCodeOrMeta(l.split(":")[0] || ""))?.slice(0, 100) ||
      "The main subject of the uploaded notes";
    questions.push({
      id: `q${n}`,
      question: "What is the main idea covered in these notes?",
      expectedAnswer: fallbackLine,
      topic: "Overview",
    });
  }

  return questions.slice(0, 5);
}

export function buildQuiz(notes: string, modelRaw?: string): QuizQuestion[] {
  if (modelRaw?.trim()) {
    try {
      const fromPipes = parseQuizPipes(modelRaw);
      if (fromPipes.length >= 3) return fromPipes;
    } catch {
      // try JSON next
    }
    try {
      const fromJson = parseQuizJson(modelRaw);
      if (fromJson.length >= 3) return fromJson;
    } catch {
      // fall through
    }
  }

  return quizFromNotes(notes);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "that",
  "this",
  "these",
  "those",
  "from",
  "by",
  "as",
  "it",
  "its",
  "into",
  "about",
  "through",
  "given",
  "using",
  "use",
  "used",
]);

function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(ing|tion|tions|ness|ment|ments|ies|ied|ely|ly|ed|es|s)$/i, "")
    .slice(0, 12);
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem)
    .filter(Boolean);
}

export type GradeResult = {
  correct: boolean;
  explanation: string;
  revisionTip: string;
  modelAnswer: string;
};

export function gradeLocally(
  expectedAnswer: string,
  userAnswer: string,
  topic = "this idea",
): GradeResult {
  const modelAnswer = polishAnswer(expectedAnswer);
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const expected = norm(expectedAnswer);
  const user = norm(userAnswer);

  if (!user) {
    return {
      correct: false,
      modelAnswer,
      explanation: "You left the answer blank — try one short sentence from the notes.",
      revisionTip: `Key idea for ${topic}: ${modelAnswer}`,
    };
  }

  if (
    user === expected ||
    (user.length >= 12 && (expected.includes(user) || user.includes(expected)))
  ) {
    return {
      correct: true,
      modelAnswer,
      explanation: "Your wording matches the idea in the notes.",
      revisionTip: `Keep this ready: ${modelAnswer}`,
    };
  }

  const eWords = significantWords(expectedAnswer);
  const uWords = new Set(significantWords(userAnswer));
  const hits = eWords.filter((w) => uWords.has(w)).length;
  const ratio = eWords.length ? hits / eWords.length : 0;

  // Soften: 2 key stems or ~35% overlap counts as understanding
  if (ratio >= 0.35 || hits >= 2) {
    return {
      correct: true,
      modelAnswer,
      explanation: "You captured the key idea — good enough for marks.",
      revisionTip: `Cleaner phrasing: ${modelAnswer}`,
    };
  }

  return {
    correct: false,
    modelAnswer,
    explanation:
      "Your answer pointed at a different idea than the notes for this question.",
    revisionTip: `Remember for ${topic}: ${modelAnswer}`,
  };
}

export function buildQuizFeedback(params: {
  graded: GradeResult;
  quiz: QuizState;
  questionNumber: number;
  topic: string;
  finished: boolean;
  nextQuestion?: string;
  finalSummary?: string;
}): QuizFeedback {
  const { graded, quiz, questionNumber, topic, finished, nextQuestion, finalSummary } =
    params;

  return {
    correct: graded.correct,
    score: quiz.score,
    total: quiz.questions.length,
    questionNumber,
    topic,
    modelAnswer: graded.modelAnswer,
    explanation: graded.explanation,
    revisionTip: graded.revisionTip,
    teachPrompt: `Explain ${topic} more simply, in 3 short sentences, using my notes.`,
    nextQuestion,
    finished,
    finalSummary,
  };
}

export function formatQuestionPrompt(quiz: QuizState): string {
  const current = quiz.questions[quiz.currentIndex];
  if (!current) return "No question available.";

  return `Practice Quiz — Question ${quiz.currentIndex + 1} of ${quiz.questions.length}\n\n${current.question}\n\nReply with your answer in chat.`;
}

export function formatFinalSummary(quiz: QuizState): string {
  const total = quiz.questions.length;
  const weak = quiz.weakTopics;
  const strongHint =
    weak.length === 0
      ? "Strong topics: solid across this quiz set"
      : `Strong topics: concepts you got right outside ${weak.join(", ")}`;
  const weakLine =
    weak.length > 0 ? `Weak topics: ${weak.join(", ")}` : "Weak topics: none detected";

  const plan =
    weak.length > 0
      ? `Short revision plan:\nDay 1: Review ${weak[0]}\nDay 2: Practice related questions\nDay 3: Mixed mini-quiz`
      : `Short revision plan:\nDay 1: Quick revision of key definitions\nDay 2: Mixed practice\nDay 3: Explain one concept in your own words`;

  return `Quiz complete ✓\nScore: ${quiz.score}/${total}\n\n${strongHint}\n${weakLine}\n\n${plan}\n\nAsk me to explain a weak topic, or build flashcards.`;
}
