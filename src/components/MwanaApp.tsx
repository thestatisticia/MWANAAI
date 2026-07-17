"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SAMPLE_BIOLOGY_NOTES } from "@/lib/sample-notes";
import { createEmptyQuiz } from "@/lib/quiz";
import { wantsSummary, wantsQuiz, normalizeSummary } from "@/lib/summary";
import type {
  ChatMessage,
  ChatResponse,
  Language,
  Mode,
  NoteSummary,
  QuizFeedback,
  QuizState,
} from "@/lib/types";

type NavId = "home" | "notes" | Mode;

type ActionCard = {
  id: string;
  title: string;
  description: string;
  message: string;
  action: "chat" | "start_quiz" | "summarize_notes";
  mode: Mode;
  language?: Language;
};

const MODE_COPY: Record<
  Mode,
  { label: string; title: string; placeholder: string; cards: ActionCard[] }
> = {
  learn: {
    label: "Learn",
    title: "What would you like to understand?",
    placeholder: "Explain photosynthesis like I'm in S.2…",
    cards: [
      {
        id: "learn-simple",
        title: "Explain simply",
        description: "Break down the main idea like I'm in S.2",
        message: "Explain the main idea in simple words like I am in S.2.",
        action: "chat",
        mode: "learn",
      },
      {
        id: "learn-luganda",
        title: "Explain in Luganda",
        description: "Local language first, then English terms",
        message:
          "Explain the main idea in Luganda like I am in S.2, then give the English terms.",
        action: "chat",
        mode: "learn",
        language: "luganda",
      },
      {
        id: "learn-again",
        title: "Teach me again",
        description: "Use an analogy if I'm stuck",
        message: "Teach me again with a simple analogy.",
        action: "chat",
        mode: "learn",
      },
    ],
  },
  practice: {
    label: "Practice",
    title: "Ready to practice?",
    placeholder: quizPlaceholder(),
    cards: [
      {
        id: "practice-quiz",
        title: "Start a quiz",
        description: "5 questions from your notes, graded in chat",
        message: "Start a 5-question quiz from my notes.",
        action: "start_quiz",
        mode: "practice",
      },
      {
        id: "practice-weak",
        title: "Quiz weak topics",
        description: "Focus on what you got wrong before",
        message: "Quiz me on my weak topics.",
        action: "chat",
        mode: "practice",
      },
      {
        id: "practice-harder",
        title: "Harder question",
        description: "One tougher question to stretch you",
        message: "Give me one harder question from my notes.",
        action: "chat",
        mode: "practice",
      },
    ],
  },
  revise: {
    label: "Revise",
    title: "What should we revise?",
    placeholder: "Summarize my notes into key points…",
    cards: [
      {
        id: "revise-summary",
        title: "Summarize notes",
        description: "Key points + prerequisite check",
        message: "Summarize these notes and check prerequisites.",
        action: "summarize_notes",
        mode: "revise",
      },
      {
        id: "revise-flashcards",
        title: "Make flashcards",
        description: "Anki-style Q/A cards for revision",
        message: "Make Anki-style flashcards from my notes.",
        action: "chat",
        mode: "revise",
      },
      {
        id: "revise-plan",
        title: "Revision plan",
        description: "A short 7-day study schedule",
        message: "Build a short 7-day revision plan from my notes and weak topics.",
        action: "chat",
        mode: "revise",
      },
    ],
  },
};

const HOME_ACTION_CARDS: ActionCard[] = [
  {
    id: "home-summarize",
    title: "Summarize my notes",
    description: "Key points, concepts, and what to learn first",
    message: "Summarize these notes and check prerequisites.",
    action: "summarize_notes",
    mode: "revise",
  },
  {
    id: "home-quiz",
    title: "Quiz me",
    description: "Practice questions graded live in chat",
    message: "Start a 5-question quiz from my notes.",
    action: "start_quiz",
    mode: "practice",
  },
  {
    id: "home-luganda",
    title: "Explain in Luganda",
    description: "Understand first in your language",
    message:
      "Explain the main idea in Luganda like I am in S.2, then give the English terms.",
    action: "chat",
    mode: "learn",
    language: "luganda",
  },
  {
    id: "home-flashcards",
    title: "Make flashcards",
    description: "Turn notes into Q/A revision cards",
    message: "Make Anki-style flashcards from my notes.",
    action: "chat",
    mode: "revise",
  },
];

function quizPlaceholder() {
  return "Type your answer…";
}

const LANGUAGE_OPTIONS: Array<{ id: Language; label: string }> = [
  { id: "english", label: "English" },
  { id: "luganda", label: "Luganda" },
  { id: "runyankole", label: "Runyankole" },
  { id: "kiswahili", label: "Kiswahili" },
];

function uid() {
  return crypto.randomUUID();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function IconLearn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V6.8A1.8 1.8 0 0 1 5.8 5H12v14H5.8A1.8 1.8 0 0 1 4 17.2V19Zm8-14h6.2A1.8 1.8 0 0 1 20 6.8v10.4a1.8 1.8 0 0 1-1.8 1.8H12V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconPractice() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h11M8 12h11M8 17h8M5 7h.01M5 12h.01M5 17h.01"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRevise() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M15 4v4h4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8 11h8M8 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 5v14" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.3-5.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M20 5v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 14-7-4 7 4 7-14-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 16c4-8 12-10 16-10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0 4 4m-4-4-4 4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuizFeedbackCard({
  feedback,
  onTeachAgain,
  disabled,
}: {
  feedback: QuizFeedback;
  onTeachAgain: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`quiz-feedback ${feedback.correct ? "ok" : "miss"}`}>
      <div className="quiz-feedback-head">
        <div>
          <p className="summary-kicker">Question {feedback.questionNumber}</p>
          <h3 className="quiz-feedback-title">
            {feedback.correct ? "Correct ✓" : "Not quite"}
          </h3>
        </div>
        <p className="quiz-feedback-score">
          Score so far
          <strong>
            {feedback.score}/{feedback.total}
          </strong>
        </p>
      </div>

      <div className="quiz-feedback-block">
        <p className="quiz-feedback-label">Model answer</p>
        <p className="quiz-feedback-text">{feedback.modelAnswer}</p>
      </div>

      <div className="quiz-feedback-block">
        <p className="quiz-feedback-label">Why</p>
        <p className="quiz-feedback-text">{feedback.explanation}</p>
      </div>

      <div className="quiz-feedback-block tip">
        <p className="quiz-feedback-label">Revision tip</p>
        <p className="quiz-feedback-text">{feedback.revisionTip}</p>
      </div>

      {!feedback.correct && (
        <button
          type="button"
          className="quiz-teach-btn"
          disabled={disabled}
          onClick={() => onTeachAgain(feedback.teachPrompt)}
        >
          Teach me again — {feedback.topic}
        </button>
      )}

      {feedback.nextQuestion && (
        <div className="quiz-next">
          <p className="quiz-feedback-label">Next</p>
          <p className="quiz-feedback-text quiz-next-q">{feedback.nextQuestion}</p>
        </div>
      )}

      {feedback.finished && feedback.finalSummary && (
        <div className="quiz-next">
          <p className="quiz-feedback-label">Quiz complete</p>
          <p className="quiz-feedback-text">{feedback.finalSummary}</p>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ summary }: { summary: NoteSummary }) {
  const normalized = normalizeSummary(summary);
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = normalized?.slides ?? [];
  const safeIndex = Math.min(slideIndex, Math.max(slides.length - 1, 0));
  const slide = slides[safeIndex];

  useEffect(() => {
    setSlideIndex(0);
  }, [normalized?.title, slides.length]);

  if (!normalized || !slide) {
    return (
      <div className="summary-deck">
        <p className="summary-kicker">Summary</p>
        <p className="point-text">
          This summary is outdated. Clear chat and summarize again.
        </p>
      </div>
    );
  }

  const go = (dir: -1 | 1) => {
    setSlideIndex((i) => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };

  return (
    <div className="summary-deck">
      <div className="summary-deck-head">
        <div>
          <p className="summary-kicker">Study slides</p>
          <h3 className="summary-deck-title">
            {normalized.title === "Key points"
              ? "From your notes"
              : normalized.title}
          </h3>
        </div>
        <p className="summary-deck-count">
          {safeIndex + 1} / {slides.length}
        </p>
      </div>

      <div className="summary-slide" data-kind={slide.kind}>
        <p className="summary-slide-label">{slide.title}</p>

        {slide.bullets.length > 0 && (
          <ol className="summary-points">
            {slide.bullets.map((bullet, i) => (
              <li key={`${slide.id}-${i}-${bullet}`}>
                <span className="point-index">{i + 1}</span>
                <span className="point-text">{bullet}</span>
              </li>
            ))}
          </ol>
        )}

        {slide.terms && slide.terms.length > 0 && (
          <div className="term-chips">
            {slide.terms.map((term) => (
              <span key={term} className="term-chip">
                {term}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="summary-deck-nav">
        <button
          type="button"
          className="ghost-btn summary-nav-btn"
          disabled={safeIndex === 0}
          onClick={() => go(-1)}
        >
          Previous
        </button>
        <div className="summary-dots" role="tablist" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`summary-dot ${i === safeIndex ? "active" : ""}`}
              aria-label={`Go to ${s.title}`}
              aria-current={i === safeIndex ? "true" : undefined}
              onClick={() => setSlideIndex(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="solid-btn summary-nav-btn"
          disabled={safeIndex >= slides.length - 1}
          onClick={() => go(1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

type ModeThreads = Record<Mode, ChatMessage[]>;
type ModeQuizzes = Record<Mode, QuizState>;

function emptyThreads(): ModeThreads {
  return { learn: [], practice: [], revise: [] };
}

function emptyQuizzes(): ModeQuizzes {
  return {
    learn: createEmptyQuiz(),
    practice: createEmptyQuiz(),
    revise: createEmptyQuiz(),
  };
}

export default function MwanaApp() {
  const [ready, setReady] = useState(false);
  const [nav, setNav] = useState<NavId>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<Mode>("learn");
  const [language, setLanguage] = useState<Language>("english");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<ModeThreads>(emptyThreads);
  const [quizzes, setQuizzes] = useState<ModeQuizzes>(emptyQuizzes);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isModeView = nav === "learn" || nav === "practice" || nav === "revise";
  const activeMode = isModeView ? nav : mode;
  const messages = threads[activeMode];
  const quiz = quizzes[activeMode];
  const hasConversation =
    messages.some((m) => m.role === "user") ||
    (loading && loadingMode === activeMode);
  const weakTopics = useMemo(() => quiz.weakTopics || [], [quiz.weakTopics]);

  function appendToThread(target: Mode, message: ChatMessage) {
    setThreads((prev) => ({
      ...prev,
      [target]: [...prev[target], message],
    }));
  }

  useEffect(() => {
    setReady(true);
    const savedXp = Number(localStorage.getItem("mwana_xp") || "0");
    const savedStreak = Number(localStorage.getItem("mwana_streak") || "0");
    const lastDay = localStorage.getItem("mwana_last_day");
    const today = todayKey();

    setXp(Number.isFinite(savedXp) ? savedXp : 0);

    if (lastDay === today) {
      setStreak(Number.isFinite(savedStreak) ? savedStreak : 0);
    } else if (lastDay) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0, 10);
      setStreak(lastDay === yKey && Number.isFinite(savedStreak) ? savedStreak : 0);
    }
  }, []);

  useEffect(() => {
    if (!isModeView || !streamRef.current) return;
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, loading, isModeView, activeMode]);

  function persistProgress(nextXp: number, bumpStreak: boolean) {
    const today = todayKey();
    const lastDay = localStorage.getItem("mwana_last_day");

    if (bumpStreak && lastDay !== today) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      localStorage.setItem("mwana_streak", String(nextStreak));
      localStorage.setItem("mwana_last_day", today);
    }

    setXp(nextXp);
    localStorage.setItem("mwana_xp", String(nextXp));
  }

  async function callChat(params: {
    message: string;
    action?: "chat" | "start_quiz" | "grade_answer" | "summarize_notes";
    showUserMessage?: boolean;
    nextMode?: Mode;
    nextLanguage?: Language;
    notesOverride?: string;
  }) {
    const showUserMessage = params.showUserMessage ?? true;
    const action = params.action || "chat";
    const activeModeLocal = params.nextMode || activeMode;
    const activeLanguage = params.nextLanguage || language;
    const notesContext = params.notesOverride ?? notes;
    const threadHistory = threads[activeModeLocal];
    const threadQuiz = quizzes[activeModeLocal];

    if (params.nextMode) {
      setMode(params.nextMode);
      setNav(params.nextMode);
    }
    if (params.nextLanguage) setLanguage(params.nextLanguage);
    if (params.notesOverride !== undefined) setNotes(params.notesOverride);

    if (showUserMessage && params.message.trim()) {
      appendToThread(activeModeLocal, {
        id: uid(),
        role: "user",
        content: params.message.trim(),
      });
    }

    setLoading(true);
    setLoadingAction(action);
    setLoadingMode(activeModeLocal);
    setError(null);

    try {
      const history =
        action === "summarize_notes" || action === "start_quiz"
          ? []
          : threadHistory
              .filter((m) => m.role === "user" || m.role === "assistant")
              .slice(-4)
              .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeModeLocal,
          language: activeLanguage,
          message: params.message,
          notesContext,
          history,
          quiz: threadQuiz,
          action,
        }),
      });

      const data = (await res.json()) as ChatResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (data.quiz) {
        setQuizzes((prev) => ({ ...prev, [activeModeLocal]: data.quiz! }));
      }

      const gained = data.xpGained || 0;
      if (gained > 0) persistProgress(xp + gained, true);

      appendToThread(activeModeLocal, {
        id: uid(),
        role: "assistant",
        content: data.reply,
        summary: data.summary ? normalizeSummary(data.summary) || undefined : undefined,
        quizFeedback: data.quizFeedback,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      appendToThread(activeModeLocal, {
        id: uid(),
        role: "assistant",
        content: `Couldn't finish that.\n\n${msg}`,
      });
    } finally {
      setLoading(false);
      setLoadingAction(null);
      setLoadingMode(null);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const action =
      quiz.active && activeMode === "practice"
        ? "grade_answer"
        : wantsSummary(text)
          ? "summarize_notes"
          : wantsQuiz(text)
            ? "start_quiz"
            : "chat";

    await callChat({
      message: text,
      action,
      nextMode:
        action === "start_quiz"
          ? "practice"
          : action === "summarize_notes"
            ? "revise"
            : undefined,
    });
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as {
        text?: string;
        fileName?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setNotes(data.text || "");
      setFileName(data.fileName || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onNavClick(id: NavId) {
    setError(null);
    setNav(id);

    if (id === "learn" || id === "practice" || id === "revise") {
      setMode(id);
      setInput("");
    }
  }

  function resetModeChat() {
    if (!isModeView) return;
    setThreads((prev) => ({ ...prev, [activeMode]: [] }));
    setQuizzes((prev) => ({ ...prev, [activeMode]: createEmptyQuiz() }));
    setError(null);
    setInput("");
  }

  function goHome() {
    setNav("home");
    setError(null);
  }

  function runActionCard(card: ActionCard) {
    const needsNotes =
      card.action === "summarize_notes" ||
      card.action === "start_quiz" ||
      card.id.includes("flashcards") ||
      card.id.includes("summarize");

    void callChat({
      message: card.message,
      action: card.action,
      nextMode: card.mode,
      nextLanguage: card.language,
      notesOverride:
        needsNotes && !notes.trim() ? SAMPLE_BIOLOGY_NOTES : undefined,
    });
  }

  const navItems: Array<{
    id: NavId;
    label: string;
    icon: ReactNode;
    badge?: string;
  }> = [
    { id: "notes", label: "Notes", icon: <IconNotes />, badge: notes ? "Ready" : undefined },
    { id: "learn", label: "Learn", icon: <IconLearn /> },
    { id: "practice", label: "Practice", icon: <IconPractice /> },
    { id: "revise", label: "Revise", icon: <IconRevise /> },
  ];

  const modeConfig = MODE_COPY[activeMode];

  const composer = (
    <form className="ask-bar" onSubmit={onSend}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          quiz.active && activeMode === "practice"
            ? "Type your answer…"
            : modeConfig.placeholder
        }
        disabled={loading}
      />
      <button
        type="submit"
        className="ask-send"
        disabled={loading || !input.trim()}
        aria-label="Send"
      >
        <IconSend />
      </button>
    </form>
  );

  if (!ready) {
    return <div className="shell shell-loading" aria-busy="true" />;
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <button type="button" className="sidebar-brand" onClick={goHome}>
          <span className="logo-mark" aria-hidden>
            <IconMark />
          </span>
          {!collapsed && <span className="brand-name">MwanaAI</span>}
        </button>

        <div className="sidebar-top">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Collapse sidebar"
          >
            <IconCollapse />
          </button>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${nav === item.id ? "active" : ""}`}
              onClick={() => onNavClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div className="sidebar-foot">
            <label className="mini-label">Language</label>
            <select
              className="mini-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="mini-stats">
              <span>{xp} XP</span>
              <span>{streak}d streak</span>
            </div>
            {weakTopics.length > 0 && (
              <p className="mini-weak">Weak: {weakTopics.join(", ")}</p>
            )}
          </div>
        )}
      </aside>

      <main className="main">
        {nav === "home" ? (
          <section className="landing">
            <div className="landing-inner">
              <div className="landing-mark">
                <IconMark />
              </div>
              <h1>MwanaAI</h1>
              <p className="landing-tagline">
                Your AI learning companion in your language.
              </p>
              <p className="landing-sub">
                Upload your notes, then learn, practice, and revise in English,
                Luganda, Runyankole, or Kiswahili.
              </p>
              <div className="landing-actions">
                <button type="button" className="solid-btn" onClick={() => onNavClick("notes")}>
                  Upload notes
                </button>
                <button type="button" className="ghost-btn" onClick={() => onNavClick("learn")}>
                  Start learning
                </button>
              </div>
              <div className="landing-cards">
                {HOME_ACTION_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className="landing-card"
                    disabled={loading}
                    onClick={() => runActionCard(card)}
                  >
                    <strong>{card.title}</strong>
                    <span>{card.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <div className="main-panel">
            <header className="topbar">
              <button type="button" className="agent-pill" onClick={goHome}>
                <span className="agent-mark">
                  <IconMark />
                </span>
                <span>
                  {nav === "notes"
                    ? "Notes"
                    : MODE_COPY[nav as Mode].label}
                </span>
              </button>
              {isModeView && (
                <button
                  type="button"
                  className="round-btn"
                  onClick={resetModeChat}
                  aria-label="Clear chat"
                >
                  <IconRefresh />
                </button>
              )}
            </header>

            {nav === "notes" ? (
              <section className="notes-panel">
                <div className="notes-head">
                  <div>
                    <h2>Study notes</h2>
                    <p>Upload PDF or Word documents, or paste text below.</p>
                  </div>
                </div>

                <div
                  className={`upload-zone ${uploading ? "uploading" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <IconUpload />
                  <p className="upload-title">
                    {uploading ? "Reading your file…" : "Click to upload PDF or DOCX"}
                  </p>
                  <p className="upload-hint">PDF, DOCX, or TXT · up to 10 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {fileName && (
                  <p className="file-chip">Loaded: {fileName}</p>
                )}

                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (!e.target.value.trim()) setFileName(null);
                  }}
                  placeholder="Or paste lecture notes, syllabus, or past-paper text here…"
                />

                <div className="notes-actions">
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      setNotes(SAMPLE_BIOLOGY_NOTES);
                      setFileName("sample-biology.txt");
                    }}
                  >
                    Load sample
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={loading || !notes.trim()}
                    onClick={() =>
                      callChat({
                        message: "Summarize these notes and check prerequisites.",
                        action: "summarize_notes",
                        nextMode: "revise",
                      })
                    }
                  >
                    Summarize
                  </button>
                  <button
                    type="button"
                    className="solid-btn"
                    disabled={loading || !notes.trim()}
                    onClick={() =>
                      callChat({
                        message: "Start a 5-question quiz from my notes.",
                        action: "start_quiz",
                        nextMode: "practice",
                      })
                    }
                  >
                    Start quiz
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={!notes.trim()}
                    onClick={() =>
                      callChat({
                        message: "Make Anki-style flashcards from my notes.",
                        action: "chat",
                        nextMode: "revise",
                      })
                    }
                  >
                    Flashcards
                  </button>
                </div>

                {error && <p className="error-line">{error}</p>}
              </section>
            ) : (
              <section className="chat-view">
                {!hasConversation ? (
                  <div className="hero mode-hero">
                    <h1>{modeConfig.title}</h1>
                    {!notes.trim() && (
                      <p className="hero-note">
                        Tip: upload notes first for better answers.{" "}
                        <button type="button" className="inline-link" onClick={() => onNavClick("notes")}>
                          Go to Notes
                        </button>
                      </p>
                    )}
                    {composer}
                    <div className="landing-cards mode-cards">
                      {modeConfig.cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          className="landing-card"
                          disabled={loading}
                          onClick={() => runActionCard(card)}
                        >
                          <strong>{card.title}</strong>
                          <span>{card.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chat-active">
                    <div className="chat-stream" ref={streamRef}>
                      {messages.map((m) => (
                        <article
                          key={m.id}
                          className={`msg ${m.role === "user" ? "user" : "assistant"} ${m.summary || m.quizFeedback ? "has-summary" : ""}`}
                        >
                          <p className="msg-role">{m.role === "user" ? "You" : "MwanaAI"}</p>
                          {m.summary ? (
                            <SummaryCards summary={m.summary} />
                          ) : m.quizFeedback ? (
                            <QuizFeedbackCard
                              feedback={m.quizFeedback}
                              disabled={loading}
                              onTeachAgain={(prompt) =>
                                void callChat({
                                  message: prompt,
                                  action: "chat",
                                  showUserMessage: true,
                                })
                              }
                            />
                          ) : (
                            <div className="msg-body">{m.content}</div>
                          )}
                        </article>
                      ))}
                      {loading && loadingMode === activeMode && (
                        <article className="msg assistant">
                          <p className="msg-role">MwanaAI</p>
                          <div className="msg-body thinking">
                            {loadingAction === "summarize_notes"
                              ? "Building short notes…"
                              : loadingAction === "start_quiz"
                                ? "Writing quiz…"
                                : "Replying…"}
                          </div>
                        </article>
                      )}
                    </div>
                    {error && <p className="error-line">{error}</p>}
                    <div className="chat-composer">{composer}</div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
