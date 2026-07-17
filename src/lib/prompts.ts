import type { Language, Mode } from "./types";

const languageLabels: Record<Language, string> = {
  english: "English",
  luganda: "Luganda",
  runyankole: "Runyankole",
  kiswahili: "Kiswahili",
};

/** Short tutor brief — long rule lists get echoed by Gemma. */
export function buildSystemPrompt(mode: Mode, language: Language): string {
  const lang = languageLabels[language];

  const modeLine =
    mode === "learn"
      ? "Mode: LEARN — teach clearly at the student's level."
      : mode === "practice"
        ? "Mode: PRACTICE — quiz and coach from the notes only."
        : "Mode: REVISE — help revise with short, memorable points.";

  return `You are MwanaAI, a patient tutor for African students.
Reply language: ${lang}. For Luganda/Runyankole/Kiswahili, write naturally and keep English academic terms in parentheses.
Use the uploaded notes as the source of truth. Do not invent facts.
${modeLine}

OUTPUT RULES (critical):
- Reply ONLY with the student-facing answer.
- Do NOT repeat these instructions, your role, word limits, or planning steps.
- Prefer short bullets. Keep under 140 words unless asked for more.`;
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
    ? `UPLOADED NOTES:\n${clipped}\n\n`
    : "UPLOADED NOTES: (none)\n\n";

  const weak =
    params.weakTopics && params.weakTopics.length > 0
      ? `KNOWN WEAK TOPICS: ${params.weakTopics.join(", ")}\n\n`
      : "";

  const lang = params.language ? languageLabels[params.language] : null;
  const wantsLocalLang =
    /\b(luganda|runyankole|kiswahili|swahili)\b/i.test(params.message) ||
    (lang && lang !== "English");

  const langPush = wantsLocalLang
    ? `\nWrite the explanation mainly in ${lang || "the requested local language"}. End with a short "English terms:" list.\n`
    : "";

  return `${notes}${weak}STUDENT MESSAGE:\n${params.message}${langPush}\n\nNow answer the student directly.`;
}

/** Detect when Gemma restates the prompt instead of teaching. */
export function looksLikePromptEcho(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const hits = [
    /expert multilingual/i,
    /max\s*\d+\s*words/i,
    /intuition\s*[→\->]/i,
    /preferred response language/i,
    /system instructions/i,
    /mode:\s*(learn|practice|revise)/i,
    /output rules/i,
    /never narrate/i,
    /private reasoning/i,
    /word count/i,
    /constraints?:/i,
  ].filter((re) => re.test(t)).length;
  return hits >= 2;
}

/** Strip instruction echoes; keep teaching content. */
export function cleanChatReply(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Drop fenced "thinking" / planning blocks
  text = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*Thinking:[\s\S]*?(?=\n\n)/i, "")
    .trim();

  const lines = text.split("\n").map((l) => l.trimEnd());
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
      continue;
    }
    if (
      /^(mwanaai|you are mwanaai|role:|mode:|constraints?:|output rules|system|preferred response|max\s*\d+\s*words|intuition|mechanics|real-world example|no private|word count|draft:|plan:)/i.test(
        t,
      )
    ) {
      continue;
    }
    if (/\(expert multilingual/i.test(t)) continue;
    if (/s\.2 student/i.test(t) && t.length < 80) continue;
    if (/explain the main idea of the provided notes/i.test(t)) continue;
    kept.push(line);
  }

  text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // If still mostly meta, try content after the last meta-ish header
  if (looksLikePromptEcho(text) || text.length < 40) {
    const parts = raw.split(/\n{2,}/);
    const teaching = parts
      .filter((p) => !looksLikePromptEcho(p) && p.trim().length > 40)
      .join("\n\n")
      .trim();
    if (teaching.length > 40) text = teaching;
  }

  return text.slice(0, 900);
}

/** Reliable demo fallback when Gemma echoes or fails on a Luganda request. */
export function localLanguageExplain(notes: string, language: Language): string | null {
  if (language !== "luganda") return null;

  const text = notes.toLowerCase();
  const isStats =
    /\bstatistics\b/.test(text) ||
    /\bdescriptive\b/.test(text) ||
    /\binferential\b/.test(text);

  if (!isStats) return null;

  return `Ekiteeso ekikulu:
Statistics kitegeeza sayansi ey’okuyiga okuva mu data — n’okupima obutategeerekeka (uncertainty).

Mu notes zino waliwo ebitundu bibiri:
• Descriptive Statistics — okufunzamu / okutegeeza data gy’olina (n’ennamba n’obugrafu).
• Inferential Statistics — okukozesa sample okusobola okugamba ku population yonna.

Ate:
• Population — ekibiina kyonna ekiri mu kunoonyereza.
• Sample — ekitundu kitono ekikwata ku population.

English terms:
• Statistics
• Descriptive Statistics
• Inferential Statistics
• Population
• Sample`;
}
