export type Mode = "learn" | "practice" | "revise";

export type Language = "english" | "luganda" | "runyankole" | "kiswahili";

export type Role = "user" | "assistant" | "system";

export type QuizQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  topic: string;
};

export type QuizState = {
  active: boolean;
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  weakTopics: string[];
};

export type QuizFeedback = {
  correct: boolean;
  score: number;
  total: number;
  questionNumber: number;
  topic: string;
  modelAnswer: string;
  explanation: string;
  revisionTip: string;
  teachPrompt: string;
  nextQuestion?: string;
  finished: boolean;
  finalSummary?: string;
};

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

export type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
  summary?: NoteSummary;
  quizFeedback?: QuizFeedback;
};

export type ChatRequest = {
  mode: Mode;
  language: Language;
  message: string;
  notesContext: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  quiz?: QuizState | null;
  action?: "chat" | "start_quiz" | "grade_answer" | "summarize_notes";
};

export type ChatResponse = {
  reply: string;
  quiz?: QuizState | null;
  xpGained?: number;
  weakTopics?: string[];
  summary?: NoteSummary;
  quizFeedback?: QuizFeedback;
};
