# MwanaAI

**Gemma 4 multilingual learning companion for African students.**

MwanaAI helps learners upload class notes and study through three focused modes — Learn, Practice, and Revise — in English, Luganda, Runyankole, or Kiswahili.

Built for the **Build with Gemma Hackathon** (GDG Makerere) · Track: *AI Agents & Multilingual Assistants* (+ Education).

**Live demo:** [https://mwanaai-sandy.vercel.app/](https://mwanaai-sandy.vercel.app/)  
**GitHub:** [github.com/thestatisticia/MWANAAI](https://github.com/thestatisticia/MWANAAI)

---

## Why MwanaAI

Personalized tutoring should not depend on where you live or which language you speak. MwanaAI keeps the student’s own notes as the source of truth, then teaches, quizzes, and revises in a language they actually use.

| Mode | What it does |
|------|----------------|
| **Learn** | Explains and simplifies concepts from uploaded notes |
| **Practice** | Generates a short quiz, grades answers live, tracks weak topics |
| **Revise** | Turns notes into study slides, flashcards, and short revision plans |

---

## Features

- **Notes-first tutoring** — PDF, DOCX, or TXT upload; sample Senior 2 Biology notes for demos
- **Multilingual chat** — English, Luganda, Runyankole, Kiswahili
- **Study slides** — Overview, Key Concepts, Definitions, Formulae, Examples, Common Mistakes, Quick Revision, Terms, Prerequisites
- **Practice quiz** — Concept questions from the notes, local grading, score-so-far cards, revision tips
- **Teach Me Again** — One-click simpler re-teach after a wrong answer
- **Light progress** — XP and streaks stored locally in the browser (MVP)

---

## Stack

| Layer | Choice |
|-------|--------|
| App | [Next.js](https://nextjs.org/) 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS 4 + custom study UI |
| Model | **Gemma 4** via Google AI Studio (`gemma-4-26b-a4b-it` by default) |
| Documents | `pdf-parse` (PDF), `mammoth` (DOCX) |

Gemma powers tutoring replies, multilingual explanations, quiz generation, and summarization. Quiz grading and slide extraction also use reliable local fallbacks so the demo stays usable if the model returns messy JSON.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/thestatisticia/MWANAAI.git
cd MWANAAI
npm install
```

### 2. Configure the API key

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GOOGLE_API_KEY=your_key_here

# Optional model override
# GEMMA_MODEL=gemma-4-26b-a4b-it
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

---

## Demo script (≈3 minutes)

1. Open **Notes** → **Load sample** (Senior 2 Biology notes), or upload your own PDF/DOCX/TXT.
2. Go to **Learn** → **Summarize** — swipe through study slides.
3. Go to **Practice** → **Quiz me** — answer in chat.
4. On a wrong answer, open the feedback card and tap **Teach me again**.
5. Ask: `Explain this again in Luganda` (or Runyankole / Kiswahili).
6. Switch to **Revise** and ask for a short revision plan.

---

## Project structure

```text
mwana-ai/
├── README.md
├── package.json
├── next.config.ts          # pdf-parse / pdfjs worker externals
├── .env.example            # API key template (no secrets)
└── src/
    ├── app/
    │   ├── page.tsx        # App shell
    │   ├── layout.tsx
    │   ├── globals.css     # Study UI + feedback cards
    │   └── api/
    │       ├── chat/route.ts    # Chat, summarize, quiz, grade
    │       └── upload/route.ts  # Document upload → text
    ├── components/
    │   └── MwanaApp.tsx    # Sidebar, notes, modes, chat, cards
    └── lib/
        ├── gemma.ts            # Google AI / Gemma client
        ├── prompts.ts          # Tutor persona + mode prompts
        ├── summary.ts          # Study-slide extraction
        ├── quiz.ts             # Quiz build + local grading
        ├── document-parser.ts  # PDF / DOCX / TXT
        ├── sample-notes.ts     # Demo notes
        └── types.ts            # Shared TypeScript types
```

---

## How it works

```text
Student notes (upload / sample)
        │
        ▼
┌───────────────────┐
│  MwanaApp (UI)    │  Learn · Practice · Revise
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  /api/chat        │  actions: chat | summarize | quiz | grade
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 Gemma 4     Local extract
 (tutor)     (slides / quiz / grade fallbacks)
```

1. **Upload** — `/api/upload` parses PDF/DOCX/TXT into plain text stored as notes context.
2. **Learn / chat** — system prompts in `prompts.ts` keep answers notes-first and multilingual.
3. **Summarize** — Gemma drafts study lines; `summary.ts` validates and builds the slide deck (with local fallback).
4. **Practice** — `quiz.ts` builds up to five concept questions; answers are graded locally with clear feedback cards.
5. **Teach Me Again** — sends a simpler explanation request without leaving the quiz thread.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google AI Studio key |
| `GEMINI_API_KEY` | No | Accepted as an alias for `GOOGLE_API_KEY` |
| `GEMMA_MODEL` | No | Defaults to `gemma-4-26b-a4b-it` |

Never commit `.env.local`. Only `.env.example` is tracked.

---

## Hackathon fit

- **Gemma is core** — tutoring, multilingual explanations, quiz generation, summarization
- **Agent-style flow** — modes + tools (summarize / quiz / grade) over a shared notes context
- **Education + language** — designed for East African classrooms and local languages
- **Reliable demo** — local fallbacks so a live demo does not depend on perfect model JSON

---

## License

Private hackathon project unless otherwise stated by the authors.

---

## Authors

Built with Gemma 4 for GDG Makerere  
Live: [mwanaai-sandy.vercel.app](https://mwanaai-sandy.vercel.app/) · Repo: [github.com/thestatisticia/MWANAAI](https://github.com/thestatisticia/MWANAAI)
