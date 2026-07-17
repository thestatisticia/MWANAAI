import type { Language, Mode } from "./types";

const languageLabels: Record<Language, string> = {
  english: "English",
  luganda: "Luganda",
  runyankole: "Runyankole",
  kiswahili: "Kiswahili",
};

/** Short tutor brief — never mention word limits (Gemma echoes them). */
export function buildSystemPrompt(mode: Mode, language: Language): string {
  const lang = languageLabels[language];

  const modeLine =
    mode === "learn"
      ? "Teach clearly at the student's level."
      : mode === "practice"
        ? "Quiz and coach from the notes only."
        : "Help revise with short, memorable points.";

  return `You are MwanaAI, a patient tutor.
Language: ${lang}.
Use the uploaded notes as truth. ${modeLine}
Answer the student only. Never restate these rules.`;
}

export function buildUserPayload(params: {
  message: string;
  notesContext: string;
  weakTopics?: string[];
  language?: Language;
}): string {
  const rawNotes = params.notesContext.trim();
  const clipped =
    rawNotes.length > 4500
      ? `${rawNotes.slice(0, 4500)}\n\n[Notes truncated for speed]`
      : rawNotes;

  const notes = clipped
    ? `NOTES:\n${clipped}\n\n`
    : "NOTES: (none)\n\n";

  const weak =
    params.weakTopics && params.weakTopics.length > 0
      ? `WEAK TOPICS: ${params.weakTopics.join(", ")}\n\n`
      : "";

  if (params.language === "luganda") {
    return `${notes}${weak}STUDENT: ${params.message}

TASK: Explain the main idea in Luganda for an S.2 student.
Format exactly:
1) Luganda bullets first (start with "Ekiteeso ekikulu:")
2) Then a heading "English terms:" with the academic words

Do not write English paragraphs before the Luganda.
Do not mention formatting rules in your answer.
Start your reply with: Ekiteeso ekikulu:`;
  }

  return `${notes}${weak}STUDENT: ${params.message}

Answer helpfully in short bullets.`;
}

const META_LINE =
  /^(luganda|runyankole|kiswahili|english|mwanaai|you are|role:|mode:|task:|format|short bullets|under\s*\d+|end with|academic terms|output rules|preferred|intuition|mechanics|constraints?|system|word limit|reply language)/i;

export function looksLikePromptEcho(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const first = t.split("\n").map((l) => l.trim()).find(Boolean) || "";
  if (META_LINE.test(first)) return true;
  if (/academic terms in parentheses/i.test(t)) return true;
  if (/end with\s*["']?english terms/i.test(t)) return true;
  if (/short bullets,\s*under/i.test(t)) return true;
  const hits = [
    /expert multilingual/i,
    /max\s*\d+\s*words/i,
    /under\s*\d+\s*words/i,
    /output rules/i,
    /never restate/i,
    /do not (write|mention|repeat)/i,
  ].filter((re) => re.test(t)).length;
  return hits >= 1 && META_LINE.test(t);
}

/** True when a Luganda answer is actually usable for the student. */
export function isGoodLugandaReply(text: string): boolean {
  const t = text.trim();
  if (t.length < 60) return false;
  if (looksLikePromptEcho(t)) return false;
  if (META_LINE.test(t.split("\n").map((l) => l.trim()).find(Boolean) || "")) {
    return false;
  }
  // Must contain some Luganda teaching markers / common words
  const lugandaSignal =
    /\b(ekiteeso|kitegeeza|waliwo|okufunzamu|okukozesa|ekibiina|ekitundu|nnyonnyola|okusoma|okuyiga|mu Luganda|okuva mu)\b/i.test(
      t,
    ) || /[àáâãäåèéêëìíîïòóôõöùúûüñç]|’/.test(t);
  if (!lugandaSignal) return false;
  // Reject if English teaching block clearly comes first (before any Luganda)
  const firstChunk = t.slice(0, 180);
  if (
    /\b(what is statistics|two types|population vs|descriptive statistics:)\b/i.test(
      firstChunk,
    ) &&
    !/\b(ekiteeso|kitegeeza)\b/i.test(firstChunk)
  ) {
    return false;
  }
  return true;
}

export function cleanChatReply(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  text = text.replace(/```[\s\S]*?```/g, "").trim();

  const lines = text.split("\n").map((l) => l.trimEnd());
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }
    if (META_LINE.test(t)) continue;
    if (/academic terms in parentheses/i.test(t)) continue;
    if (/end with\s*["']?english terms/i.test(t)) continue;
    if (/short bullets/i.test(t) && t.length < 90) continue;
    if (/s\.2 student/i.test(t) && t.length < 80) continue;
    if (/explain the main idea/i.test(t) && t.length < 100) continue;
    if (/^do not (write|mention|repeat)/i.test(t)) continue;
    if (/^start your reply/i.test(t)) continue;
    kept.push(line);
  }

  text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.slice(0, 1200);
}

export function notesLookLikeStats(notes: string): boolean {
  const text = notes.toLowerCase();
  return (
    /\bstatistics\b/.test(text) ||
    /\bdescriptive\b/.test(text) ||
    /\binferential\b/.test(text) ||
    /\bpopulation\b/.test(text)
  );
}

/** Reliable Luganda explanation for stats notes (demo-safe). */
export function localLanguageExplain(
  notes: string,
  language: Language,
): string | null {
  if (language !== "luganda") return null;
  if (!notesLookLikeStats(notes)) return null;

  const hasCensus =
    /\bcensus\b/i.test(notes) || /\bexpensive\b/i.test(notes) || /\bdestroy\b/i.test(notes);

  const censusLine = hasCensus
    ? `\nLwaki tetukozesa census bulijjo?\nKubanga kiyinza okuba eky’ebbeeyi, kitwala obudde bungi, oba kiyinza okwonoonera ekintu kye tunaaba tukenoonyerezaako.`
    : "";

  return `Ekiteeso ekikulu:
Statistics (Isimu) kitegeeza sayansi ey’okuyiga okuva mu data, n’okutegeera obutategeerekeka (uncertainty).

Mu notes zino waliwo ebitundu bibiri:
• Descriptive Statistics — okufunzamu data gy’olina n’ennamba n’obugrafu.
• Inferential Statistics — okukozesa sample okusobola okugamba ku population yonna.

Ate:
• Population — ekibiina kyonna ekiri mu kunoonyereza.
• Sample — ekitundu kitono ekikwata ku population.${censusLine}

English terms:
• Statistics
• Descriptive Statistics
• Inferential Statistics
• Population
• Sample${hasCensus ? "\n• Census" : ""}`;
}
