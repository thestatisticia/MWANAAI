import { NextResponse } from "next/server";
import { generateGemmaReply } from "@/lib/gemma";
import {
  buildSystemPrompt,
  buildUserPayload,
  cleanChatReply,
  localLanguageExplain,
  looksLikePromptEcho,
} from "@/lib/prompts";
import {
  buildQuiz,
  buildQuizFeedback,
  createEmptyQuiz,
  formatFinalSummary,
  formatQuestionPrompt,
  gradeLocally,
  QUIZ_GEMMA_PROMPT,
} from "@/lib/quiz";
import {
  buildNoteSummary,
  SUMMARY_GEMMA_PROMPT,
  truncateNotes,
  wantsQuiz,
  wantsSummary,
} from "@/lib/summary";
import type { ChatRequest, ChatResponse, QuizState } from "@/lib/types";

export const runtime = "nodejs";

function uniqueTopics(topics: string[]): string[] {
  return [...new Set(topics.map((t) => t.trim()).filter(Boolean))];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const mode = body.mode || "learn";
    const language = body.language || "english";
    const action = body.action || "chat";
    const notesContext = body.notesContext || "";
    const message = (body.message || "").trim();
    const history = body.history || [];
    let quiz: QuizState = body.quiz || createEmptyQuiz();

    if (!message && action === "chat") {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    // Quiz: Gemma analyzes notes first; validated local fallback if model is messy
    if (action === "start_quiz" || wantsQuiz(message)) {
      if (!notesContext.trim()) {
        return NextResponse.json(
          { error: "Upload or load notes before starting a quiz." },
          { status: 400 },
        );
      }

      const shortNotes = truncateNotes(notesContext, 3500);
      let modelRaw: string | undefined;

      try {
        modelRaw = await generateGemmaReply({
          systemPrompt: QUIZ_GEMMA_PROMPT,
          userMessage: `NOTES:\n${shortNotes}\n\nWrite 5 quiz lines now.`,
          fast: true,
          maxOutputTokens: 550,
          temperature: 0.2,
        });
      } catch {
        modelRaw = undefined;
      }

      const questions = buildQuiz(shortNotes, modelRaw);

      quiz = {
        active: true,
        questions,
        currentIndex: 0,
        score: 0,
        weakTopics: [],
      };

      const response: ChatResponse = {
        reply: formatQuestionPrompt(quiz),
        quiz,
        xpGained: 0,
        weakTopics: [],
      };
      return NextResponse.json(response);
    }

    // Grade: local-first (instant + reliable)
    if (action === "grade_answer" && quiz.active) {
      const current = quiz.questions[quiz.currentIndex];
      if (!current) {
        return NextResponse.json(
          { error: "No active quiz question." },
          { status: 400 },
        );
      }

      const questionNumber = quiz.currentIndex + 1;
      const graded = gradeLocally(
        current.expectedAnswer,
        message,
        current.topic,
      );

      const nextScore = quiz.score + (graded.correct ? 1 : 0);
      const nextWeak = graded.correct
        ? quiz.weakTopics
        : uniqueTopics([...quiz.weakTopics, current.topic]);

      const nextIndex = quiz.currentIndex + 1;
      const finished = nextIndex >= quiz.questions.length;

      quiz = {
        ...quiz,
        score: nextScore,
        weakTopics: nextWeak,
        currentIndex: finished ? quiz.currentIndex : nextIndex,
        active: !finished,
      };

      const finalSummary = finished
        ? formatFinalSummary({ ...quiz, active: false })
        : undefined;
      const nextQuestion = finished ? undefined : formatQuestionPrompt(quiz);

      const quizFeedback = buildQuizFeedback({
        graded,
        quiz,
        questionNumber,
        topic: current.topic,
        finished,
        nextQuestion,
        finalSummary,
      });

      let reply = "";
      if (nextQuestion) reply = nextQuestion;
      if (finalSummary) reply = finalSummary;

      let xpGained = graded.correct ? 10 : 5;

      if (finished) {
        xpGained += 20;
        quiz = { ...quiz, active: false };
      }

      const response: ChatResponse = {
        reply,
        quiz,
        xpGained,
        weakTopics: quiz.weakTopics,
        quizFeedback,
      };
      return NextResponse.json(response);
    }

    // Summarize: Gemma analyzes notes; validated local extract if model is messy
    if (action === "summarize_notes" || wantsSummary(message)) {
      if (!notesContext.trim()) {
        return NextResponse.json(
          { error: "Upload or load notes first." },
          { status: 400 },
        );
      }

      const shortNotes = truncateNotes(notesContext, 6000);
      let modelRaw: string | undefined;

      try {
        modelRaw = await generateGemmaReply({
          systemPrompt: SUMMARY_GEMMA_PROMPT,
          userMessage: `NOTES:\n${shortNotes}\n\nWrite the study card lines now. Use real facts from the NOTES.`,
          fast: true,
          maxOutputTokens: 700,
          temperature: 0.15,
        });
      } catch {
        modelRaw = undefined;
      }

      const summary = buildNoteSummary(shortNotes, modelRaw);

      const response: ChatResponse = {
        reply: "Summary ready",
        summary,
        quiz,
        xpGained: 5,
      };
      return NextResponse.json(response);
    }

    // Learn / Practice / Revise chat via Gemma
    const systemPrompt = buildSystemPrompt(mode, language);

    const userMessage = buildUserPayload({
      notesContext,
      message,
      weakTopics: quiz.weakTopics,
      language,
    });

    let reply = "";
    try {
      reply = await generateGemmaReply({
        systemPrompt,
        userMessage,
        history: history.slice(-4),
        maxOutputTokens: 450,
        temperature: 0.35,
        // Fast path puts the student ask last and reduces instruction echoing
        fast: true,
      });
      reply = cleanChatReply(reply);
    } catch (err) {
      const fallback = localLanguageExplain(notesContext, language);
      if (fallback) {
        reply = fallback;
      } else {
        throw err;
      }
    }

    if (!reply || looksLikePromptEcho(reply)) {
      const fallback = localLanguageExplain(notesContext, language);
      reply =
        fallback ||
        "Nsonyiwa — nemezzawo bukopi bwa instructions. Gezaako nate: “Nnyonnyola statistics mu Luganda.”";
    }

    const response: ChatResponse = {
      reply,
      quiz,
      xpGained: 2,
      weakTopics: quiz.weakTopics,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
