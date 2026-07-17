export type SummarySlideKind =
  | "overview"
  | "key_concepts"
  | "definitions"
  | "formulae"
  | "examples"
  | "common_mistakes"
  | "quick_revision"
  | "terms"
  | "prerequisites";

export type SummarySlide = {
  id: string;
  kind: SummarySlideKind;
  title: string;
  bullets: string[];
  terms?: string[];
};

export type NoteSummary = {
  title: string;
  slides: SummarySlide[];
};

/** Normalize old or partial summary payloads into the slides shape. */
export function normalizeSummary(input: unknown): NoteSummary | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    title?: unknown;
    slides?: unknown;
    bullets?: unknown;
    terms?: unknown;
    prerequisites?: unknown;
  };

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Study notes";

  if (Array.isArray(raw.slides) && raw.slides.length > 0) {
    const slides: SummarySlide[] = [];
    raw.slides.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      const slide = s as {
        id?: unknown;
        kind?: unknown;
        title?: unknown;
        bullets?: unknown;
        terms?: unknown;
      };
      const bullets = Array.isArray(slide.bullets)
        ? slide.bullets.map((b) => String(b)).filter(Boolean)
        : [];
      const terms = Array.isArray(slide.terms)
        ? slide.terms.map((t) => String(t)).filter(Boolean)
        : undefined;
      if (bullets.length === 0 && (!terms || terms.length === 0)) return;

      const normalized: SummarySlide = {
        id: typeof slide.id === "string" ? slide.id : `slide-${i}`,
        kind: (typeof slide.kind === "string"
          ? slide.kind
          : "key_concepts") as SummarySlideKind,
        title:
          typeof slide.title === "string" && slide.title.trim()
            ? slide.title.trim()
            : "Slide",
        bullets,
      };
      if (terms && terms.length > 0) normalized.terms = terms;
      slides.push(normalized);
    });

    if (slides.length > 0) return { title, slides };
  }

  // Legacy flat summary → one or more slides
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.map((b) => String(b)).filter(Boolean)
    : [];
  const terms = Array.isArray(raw.terms)
    ? raw.terms.map((t) => String(t)).filter(Boolean)
    : [];
  const prerequisites = Array.isArray(raw.prerequisites)
    ? raw.prerequisites.map((p) => String(p)).filter(Boolean)
    : [];

  const slides: SummarySlide[] = [];
  if (bullets.length > 0) {
    slides.push({
      id: "key_concepts",
      kind: "key_concepts",
      title: "Key Concepts",
      bullets,
    });
  }
  if (terms.length > 0) {
    slides.push({
      id: "terms",
      kind: "terms",
      title: "Key Terms",
      bullets: ["Keep these terms clear while revising"],
      terms,
    });
  }
  if (prerequisites.length > 0) {
    slides.push({
      id: "prerequisites",
      kind: "prerequisites",
      title: "Know This First",
      bullets: prerequisites,
    });
  }

  return slides.length > 0 ? { title, slides } : null;
}

const PROMPT_ECHO_RE =
  /\b(json|markdown|placeholder|constraint|commentary|no thinking|json shape|output:|input:|lecture notes on|single json|real facts from|never use)\b/i;

export function truncateNotes(notes: string, maxChars = 5000): string {
  const trimmed = notes.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[Notes truncated for speed]`;
}

export function wantsSummary(message: string): boolean {
  return /\b(summariz|summary|key points|bullet points|condense)\b/i.test(
    message.trim(),
  );
}

export function wantsQuiz(message: string): boolean {
  return /\b(quiz me|start (a |the )?quiz|5-question quiz|practice quiz)\b/i.test(
    message.trim(),
  );
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

function isCourseCode(term: string): boolean {
  return /^[A-Z]{2,6}\s?-?\s?\d{2,5}[A-Z]?$/i.test(term.trim());
}

function isJunkLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (PROMPT_ECHO_RE.test(t)) return true;
  if (/https?:\/\//i.test(t) || /\bdoi\.org\b/i.test(t) || /dx\.doi/i.test(t))
    return true;
  if (/^[a-z]+:\/\//i.test(t) || /^https?$/i.test(t)) return true;
  if (/\b[\w.-]+@[\w.-]+\.\w+\b/.test(t)) return true;
  if (/\([12]\d{3}\)/.test(t) && /,/.test(t)) return true;
  if (/^[A-Z][a-z]+,\s*[A-Z]\./.test(t) || /\bet al\./i.test(t)) return true;
  if (/:\s*$/.test(t) || /\bis:\s*$/i.test(t)) return true;
  if (
    /^(introduction|overview|contents|references|bibliography|appendix)\b/i.test(
      t,
    ) &&
    t.length < 60 &&
    !/introduction to\b/i.test(t)
  )
    return true;
  if (/^\d+\s+[A-Z][a-z]+/.test(t) && t.length < 50 && /:/.test(t)) return true;
  if (/\bwhat is\b.+\?$/i.test(t) && t.length < 55) return true;
  if (isCourseCode(t)) return true;
  return false;
}

function isGoodBullet(text: string): boolean {
  const t = cleanLine(text);
  if (t.length < 24 || t.length > 170) return false;
  if (isJunkLine(t)) return false;
  if (/,\s*$/.test(t)) return false;
  return (
    /\b(is|are|means|refers|used|includes|consists|called|defined|statistics|population|sample|data|variable|probability|example|e\.g)\b/i.test(
      t,
    ) || /[.=:]/.test(t)
  );
}

function isGoodTerm(term: string): boolean {
  const t = cleanLine(term);
  if (t.length < 3 || t.length > 40) return false;
  if (isJunkLine(t) || isCourseCode(t)) return false;
  if (/^(there|these|this|that|with|from|into|http|https|www|doi)\b/i.test(t))
    return false;
  if (/\s+(is|are)$/i.test(t)) return false;
  if (t.split(/\s+/).length > 4) return false;
  if (/[.?!]$/.test(t)) return false;
  if (
    /\b(are|is|was|were|have|has|will|can|the)\b/i.test(t) &&
    t.split(/\s+/).length > 2
  )
    return false;
  return true;
}

function uniquePush(list: string[], item: string, max: number) {
  const t = item.trim().replace(/\s+/g, " ");
  if (!t || list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
  list.push(t.length > 155 ? `${t.slice(0, 152)}…` : t);
  if (list.length > max) list.length = max;
}

/** PDF extractors often return one blob — turn it into usable study lines. */
function notesToRawLines(notes: string): string[] {
  let text = notes.replace(/\r/g, "").trim();
  text = text.replace(/(\w)-\n(\w)/g, "$1$2");

  let rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length < 8 && text.length > 200) {
    rawLines = text
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+|\s*;\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12);
  }

  // Also split long lines that hide "Term: meaning" pairs
  const expanded: string[] = [];
  for (const line of rawLines) {
    if (line.length > 220 && /:\s+/.test(line)) {
      const parts = line.split(/(?<=\.)\s+(?=[A-Z][a-zA-Z0-9 /&-]{1,40}:\s)/);
      if (parts.length > 1) {
        expanded.push(...parts.map((p) => p.trim()).filter(Boolean));
        continue;
      }
    }
    expanded.push(line);
  }

  return expanded;
}

const CONCEPT_BANK: Array<{ re: RegExp; term: string; meaning: string }> = [
  {
    re: /\bdescriptive statistics\b/i,
    term: "Descriptive Statistics",
    meaning:
      "Summarizing a given data set through numerical summaries and graphs",
  },
  {
    re: /\binferential statistics\b/i,
    term: "Inferential Statistics",
    meaning:
      "Using sample data to make conclusions or predictions about a population",
  },
  {
    re: /\bpopulation\b/i,
    term: "Population",
    meaning: "All individuals or items under study",
  },
  {
    re: /\bsample\b/i,
    term: "Sample",
    meaning: "A subset of the population chosen for study",
  },
  {
    re: /\bqualitative\b/i,
    term: "Qualitative Variable",
    meaning: "A categorical variable (nominal or ordinal)",
  },
  {
    re: /\bquantitative\b/i,
    term: "Quantitative Variable",
    meaning: "A numerical variable (discrete or continuous)",
  },
  {
    re: /\bprobability\b/i,
    term: "Probability",
    meaning: "A measure of how likely an event is to occur",
  },
  {
    re: /\bmean\b/i,
    term: "Mean",
    meaning: "The average of numerical values in a data set",
  },
  {
    re: /\bmedian\b/i,
    term: "Median",
    meaning: "The middle value when data are ordered",
  },
  {
    re: /\bvariance\b/i,
    term: "Variance",
    meaning: "A measure of how spread out values are around the mean",
  },
];

function inferTopicTitle(text: string, terms: string[]): string {
  if (/\bdescriptive\b/i.test(text) && /\binferential\b/i.test(text)) {
    return "Descriptive & Inferential Statistics";
  }
  if (/\bphotosynthesis\b/i.test(text)) return "Photosynthesis";
  if (/\bstatistics\b/i.test(text) && /\b(population|sample|data)\b/i.test(text)) {
    return "Introduction to Statistics";
  }
  if (terms.length >= 2) return `${terms[0]} & related ideas`;
  if (terms[0]) return terms[0];
  return "Study notes";
}

function buildOverviewBullets(params: {
  title: string;
  definitions: string[];
  keyConcepts: string[];
  terms: string[];
  text: string;
}): string[] {
  const { title, definitions, keyConcepts, terms, text } = params;
  const bits: string[] = [];

  const focus =
    title !== "Study notes"
      ? title
      : inferTopicTitle(text, terms);

  uniquePush(
    bits,
    `These notes focus on ${focus} — read them in order for revision.`,
    4,
  );

  if (definitions[0]) uniquePush(bits, definitions[0], 4);
  else if (keyConcepts[0]) uniquePush(bits, keyConcepts[0], 4);

  if (terms.length >= 2) {
    uniquePush(
      bits,
      `Core ideas to master: ${terms.slice(0, 4).join(", ")}.`,
      4,
    );
  }

  if (/\bdescriptive\b/i.test(text) && /\binferential\b/i.test(text)) {
    uniquePush(
      bits,
      "Descriptive stats summarize the data you have; inferential stats use a sample to conclude about a population.",
      4,
    );
  }

  return bits.slice(0, 4);
}

function stitchLines(rawLines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let cur = cleanLine(rawLines[i]);
    if (!cur) continue;

    while (
      i + 1 < rawLines.length &&
      (/:\s*$/.test(cur) || /\b(is|are|means)\s*$/i.test(cur))
    ) {
      const next = cleanLine(rawLines[i + 1]);
      if (!next || isJunkLine(next) || /https?:/i.test(next)) break;
      cur = `${cur.replace(/:\s*$/, ":")} ${next}`.replace(/\s+/g, " ").trim();
      i += 1;
    }

    while (i + 1 < rawLines.length && cur.length < 130 && !/[.!?]$/.test(cur)) {
      const next = cleanLine(rawLines[i + 1]);
      if (!next || isJunkLine(next)) break;
      if (/https?:/i.test(next) || /\([12]\d{3}\)/.test(next)) break;
      if (/^[A-Z][a-z]+,\s*[A-Z]\./.test(next)) break;

      const shouldMerge =
        /[,:;]\s*$/.test(cur) ||
        /^[a-z(]/.test(next) ||
        (/\b(both|and|or|with|using|from|into|about)\s*$/i.test(cur) &&
          next.length > 8);

      if (!shouldMerge) break;
      if (/^[A-Z0-9]/.test(next) && /:/.test(next) && next.length < 45) break;

      cur = `${cur} ${next}`.replace(/\s+/g, " ").trim();
      i += 1;
    }

    out.push(cur);
  }
  return out;
}

function pickTitle(lines: string[], fullText: string): string {
  for (const line of lines.slice(0, 20)) {
    const cleaned = cleanLine(line);
    if (cleaned.length < 8 || cleaned.length > 80) continue;
    if (!/^[A-Z]/.test(cleaned)) continue;
    if (isJunkLine(cleaned)) continue;

    if (/introduction to|fundamentals of|principles of/i.test(cleaned)) {
      return cleaned
        .replace(/^\d+\s*/, "")
        .replace(/\s*[:\-–—].*$/, "")
        .slice(0, 70);
    }

    const colonParts = cleaned.split(/\s*:\s*/);
    if (
      colonParts.length >= 2 &&
      isCourseCode(colonParts[0]) &&
      colonParts[1].length >= 8
    ) {
      return colonParts.slice(1).join(": ").slice(0, 70);
    }

    if (
      !/\?$/.test(cleaned) &&
      cleaned.split(/\s+/).length <= 10 &&
      /\b(statistics|biology|chemistry|physics|math|algebra|calculus|probability|photosynthesis)\b/i.test(
        cleaned,
      )
    ) {
      return cleaned.replace(/\s*[:\-–—].*$/, "").slice(0, 70);
    }
  }

  return inferTopicTitle(fullText, []);
}

function isExampleLine(line: string): boolean {
  return /\b(e\.g\.|eg\.|for example|for instance|such as|example:)\b/i.test(
    line,
  );
}

function isDefinitionPair(line: string): { term: string; meaning: string } | null {
  // "Population: ..." or "Statistics is: ..." or "Population is ..."
  const m =
    line.match(/^([A-Za-z][A-Za-z0-9 /&-]{1,40})\s+is:\s+(.{12,})$/i) ||
    line.match(/^([A-Za-z][A-Za-z0-9 /&-]{1,40}):\s+(.{12,})$/) ||
    line.match(
      /^([A-Za-z][A-Za-z0-9 /&-]{1,40})\s+(?:is|are|means|refers to)\s+(.{12,})$/i,
    );
  if (!m) return null;
  let term = m[1].trim().replace(/\s+(is|are)$/i, "").trim();
  const meaning = m[2].replace(/\.+$/, "").trim();
  if (!isGoodTerm(term)) return null;
  if (meaning.length < 12 || isJunkLine(meaning) || /^what\b/i.test(meaning))
    return null;
  return { term, meaning };
}

function makeSlide(
  kind: SummarySlideKind,
  title: string,
  bullets: string[],
  terms?: string[],
): SummarySlide | null {
  if (bullets.length === 0 && (!terms || terms.length === 0)) return null;
  return {
    id: kind,
    kind,
    title,
    bullets: bullets.slice(0, 8),
    terms: terms?.slice(0, 8),
  };
}

export function isUsableSummary(
  summary: NoteSummary | null,
): summary is NoteSummary {
  if (!summary) return false;
  if (!summary.slides || summary.slides.length === 0) return false;
  const totalBullets = summary.slides.reduce(
    (n, s) => n + s.bullets.length + (s.terms?.length || 0),
    0,
  );
  return totalBullets >= 2;
}

function isFormulaLine(line: string): boolean {
  return (
    /[=≈≤≥]/.test(line) ||
    /\b(formula|equation|∑|√|σ|μ|x̄|p\(|n\s*=)/i.test(line)
  );
}

function isMistakeHint(line: string): boolean {
  return /\b(common mistake|do not|don't|avoid|confus|incorrect|wrongly|never|not the same as|≠|versus|vs\.?)\b/i.test(
    line,
  );
}

/** Walk notes start→end and build ordered revision slides. */
export function summaryFromNotes(notes: string): NoteSummary {
  const text = notes.replace(/\r/g, "").trim();
  const rawLines = notesToRawLines(notes);
  const lines = stitchLines(rawLines);

  const overviewBits: string[] = [];
  const keyConcepts: string[] = [];
  const definitions: string[] = [];
  const formulae: string[] = [];
  const examples: string[] = [];
  const mistakes: string[] = [];
  const terms: string[] = [];

  for (const line of lines) {
    if (isJunkLine(line)) continue;
    if (isCourseCode(line.split(":")[0] || "")) continue;

    const def = isDefinitionPair(line);
    if (def) {
      uniquePush(definitions, `${def.term}: ${def.meaning}`, 8);
      if (!terms.includes(def.term) && isGoodTerm(def.term)) terms.push(def.term);
      continue;
    }

    if (isFormulaLine(line) && line.length >= 8) {
      uniquePush(formulae, line, 6);
      continue;
    }

    if (isExampleLine(line) && isGoodBullet(line)) {
      uniquePush(examples, line, 6);
      continue;
    }

    if (isMistakeHint(line) && isGoodBullet(line)) {
      uniquePush(mistakes, line, 5);
      continue;
    }

    if (isGoodBullet(line)) {
      uniquePush(keyConcepts, line, 8);
    }
  }

  // Seed clear definitions when the notes mention known concepts (helps messy PDFs)
  for (const item of CONCEPT_BANK) {
    if (!item.re.test(text)) continue;
    if (!terms.includes(item.term)) terms.push(item.term);
    uniquePush(definitions, `${item.term}: ${item.meaning}`, 8);
    if (terms.length >= 8) break;
  }

  let title = pickTitle(rawLines, text);
  if (title === "Study notes") {
    title = inferTopicTitle(text, terms);
  }

  if (keyConcepts.length < 3) {
    for (const d of definitions) uniquePush(keyConcepts, d, 8);
  }

  overviewBits.push(
    ...buildOverviewBullets({
      title,
      definitions,
      keyConcepts,
      terms,
      text,
    }),
  );

  // Quick revision = top definitions + key concepts condensed
  const quickRevision: string[] = [];
  for (const d of definitions.slice(0, 4)) uniquePush(quickRevision, d, 6);
  for (const k of keyConcepts.slice(0, 3)) uniquePush(quickRevision, k, 6);
  if (quickRevision.length === 0) {
    uniquePush(quickRevision, `Revise the main topic: ${title}`, 3);
  }

  const prerequisites: string[] = [];
  if (/\b(population|sample)\b/i.test(text)) {
    prerequisites.push("Know the difference between a population and a sample");
  }
  if (/\b(descriptive|inferential)\b/i.test(text)) {
    prerequisites.push("Know that descriptive ≠ inferential statistics");
  }
  if (/\b(variable|qualitative|quantitative)\b/i.test(text)) {
    prerequisites.push("Be able to spot qualitative vs quantitative variables");
  }
  if (prerequisites.length === 0 && terms.length > 0) {
    prerequisites.push(`Review definitions of: ${terms.slice(0, 2).join(", ")}`);
  }
  if (prerequisites.length === 0) {
    prerequisites.push("Skim key definitions before practicing questions");
  }

  // Soft common-mistakes defaults when notes imply contrasts
  if (mistakes.length === 0 && /\b(descriptive|inferential)\b/i.test(text)) {
    mistakes.push(
      "Do not confuse descriptive statistics (summarize sample data) with inferential statistics (conclude about a population).",
    );
  }
  if (mistakes.length === 0 && /\b(population|sample)\b/i.test(text)) {
    mistakes.push(
      "A sample is not the whole population — avoid treating sample results as automatic population facts.",
    );
  }

  const slides: SummarySlide[] = [];
  const push = (s: SummarySlide | null) => {
    if (s) slides.push(s);
  };

  push(makeSlide("overview", "Overview", overviewBits));
  push(makeSlide("key_concepts", "Key Concepts", keyConcepts));
  push(makeSlide("definitions", "Important Definitions", definitions));
  push(makeSlide("formulae", "Important Formulae", formulae));
  push(makeSlide("examples", "Examples", examples));
  push(makeSlide("common_mistakes", "Common Mistakes", mistakes));
  push(makeSlide("quick_revision", "Quick Revision Points", quickRevision));
  push(
    makeSlide(
      "terms",
      "Key Terms",
      terms.length > 0 ? [`Keep these terms clear while revising`] : [],
      terms.filter(isGoodTerm),
    ),
  );
  push(makeSlide("prerequisites", "Know This First", prerequisites));

  if (slides.length === 0) {
    slides.push({
      id: "overview",
      kind: "overview",
      title: "Overview",
      bullets: [
        "Could not find clear study sentences in these notes.",
        "Paste notes with full definitions (e.g. Population: …).",
      ],
    });
  }

  return { title, slides };
}

export function buildNoteSummary(notes: string, modelRaw?: string): NoteSummary {
  const local = summaryFromNotes(notes);
  if (!modelRaw?.trim()) return local;

  // Optional model polish: TITLE|... then SLIDE|kind|title then B|...
  const titleLine = modelRaw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^TITLE\s*\|/i.test(l));

  const modelSlides: SummarySlide[] = [];
  let current: SummarySlide | null = null;

  for (const raw of modelRaw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/^TITLE\s*\|/i.test(raw)) continue;

    const slideMatch = raw.match(/^SLIDE\s*\|\s*([^|]+)\|\s*(.+)$/i);
    if (slideMatch) {
      if (current && (current.bullets.length > 0 || (current.terms?.length || 0) > 0)) {
        modelSlides.push(current);
      }
      const kindRaw = slideMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
      const allowed: SummarySlideKind[] = [
        "overview",
        "key_concepts",
        "definitions",
        "formulae",
        "examples",
        "common_mistakes",
        "quick_revision",
        "terms",
        "prerequisites",
      ];
      const mapped =
        kindRaw === "key_ideas" ? "key_concepts" : (kindRaw as SummarySlideKind);
      const kind = allowed.includes(mapped) ? mapped : "key_concepts";
      current = {
        id: `${kind}-${modelSlides.length}`,
        kind,
        title: cleanLine(slideMatch[2]).slice(0, 60),
        bullets: [],
        terms: [],
      };
      continue;
    }

    if (!current) {
      current = {
        id: "key_concepts-0",
        kind: "key_concepts",
        title: "Key Concepts",
        bullets: [],
        terms: [],
      };
    }

    if (/^B\s*\|/i.test(raw)) {
      const bullet = cleanLine(raw.replace(/^B\s*\|/i, ""));
      if (isGoodBullet(bullet) || bullet.length >= 28) {
        if (!isJunkLine(bullet)) current.bullets.push(bullet.slice(0, 160));
      }
    } else if (/^T\s*\|/i.test(raw)) {
      const term = cleanLine(raw.replace(/^T\s*\|/i, ""));
      if (isGoodTerm(term)) current.terms = [...(current.terms || []), term];
    }
  }

  if (current && (current.bullets.length > 0 || (current.terms?.length || 0) > 0)) {
    modelSlides.push(current);
  }

  const usable = modelSlides.filter(
    (s) => s.bullets.length > 0 || (s.terms && s.terms.length > 0),
  );

  const modelOverview = usable.find((s) => s.kind === "overview");
  const weakModelOverview =
    !modelOverview ||
    modelOverview.bullets.some((b) =>
      /these notes cover:\s*study notes|you will meet ideas such as/i.test(b),
    ) ||
    modelOverview.bullets.every((b) => b.length < 40);

  // Prefer local when the model only produced thin/generic slides
  const localDefs =
    local.slides.find((s) => s.kind === "definitions")?.bullets.length || 0;
  const modelDefs =
    usable.find((s) => s.kind === "definitions")?.bullets.length || 0;

  if (usable.length >= 3 && !weakModelOverview && modelDefs >= Math.min(2, localDefs)) {
    const title = titleLine
      ? cleanLine(titleLine.replace(/^TITLE\s*\|/i, "")).slice(0, 70)
      : local.title;
    const summary: NoteSummary = {
      title: title && !isJunkLine(title) ? title : local.title,
      slides: usable.slice(0, 10),
    };
    if (isUsableSummary(summary)) return summary;
  }

  return local;
}

export const SUMMARY_GEMMA_PROMPT = `You are MwanaAI. Read NOTES from beginning to end.
Write concrete revision slides from the notes — never use vague lines like "these notes cover study notes".
Ignore citations, URLs, DOIs, course codes, and junk headings.
Every B line must teach a real idea from the NOTES (definition, contrast, or fact).

Output lines only:
TITLE|specific topic title from the notes
SLIDE|overview|Overview
B|what the notes are about in one clear sentence
B|one core distinction or takeaway from the notes
SLIDE|key_concepts|Key Concepts
B|concept explained in one sentence
SLIDE|definitions|Important Definitions
B|Term: short definition from the notes
SLIDE|formulae|Important Formulae
B|formula or equation (skip slide if none)
SLIDE|examples|Examples
B|example from notes (skip slide if none)
SLIDE|common_mistakes|Common Mistakes
B|typical student mistake to avoid
SLIDE|quick_revision|Quick Revision Points
B|fast revision bullet
SLIDE|terms|Key Terms
T|Term
SLIDE|prerequisites|Know This First
B|what to know first

Keep that order. Skip empty slides. Prefer definitions over fluff.`;
