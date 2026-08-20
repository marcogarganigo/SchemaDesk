<div align="center">

# Schema Desk

**Turn SQL into beautiful database diagrams.**

Paste DDL, explore relationships, and design your database visually — all in your browser.

</div>

---

## ✨ Features

- **Paste & Parse** — Detect tables, columns, keys, indexes and relationships from DDL instantly.
- **Intelligent Layout** — Tables arrange around their relationships with automatic graph layout. Switch between left-to-right and top-to-bottom flows.
- **Multi-Dialect** — Understands MySQL, PostgreSQL and SQLite syntax out of the box.
- **Format SQL** — Normalize and indent your schema with a single command.
- **Export Anywhere** — Download crisp PNG or SVG diagrams, or copy them straight to your clipboard.
- **Share via Link** — Generate a URL that carries the entire schema — no server needed.
- **Mock Data** — Generate realistic seed data for every table, respecting foreign keys and column types.
- **Schema Docs** — Export a Markdown reference document for your database.
- **Dark & Light** — Full theme support with system preference detection.
- **100% Private** — Everything runs in your browser. Your schema never leaves your machine.

## 🛠 Tech Stack

| Layer | Tool |
|---|---|
| Framework | [Next.js](https://nextjs.org) 16 |
| UI | [React](https://react.dev) 19 · [Tailwind CSS](https://tailwindcss.com) 4 |
| Diagram | [xyflow](https://xyflow.com) · [dagre](https://github.com/dagrejs/dagre) |
| Icons | [Lucide](https://lucide.dev) |
| Animation | [Motion](https://motion.dev) |
| Language | TypeScript 5 |

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and paste some SQL.

## 📦 Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm lint` | Lint with ESLint |

## 📂 Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/
│   ├── diagram/      # React Flow diagram nodes & canvas
│   ├── editor/       # SQL code editor
│   ├── landing/      # Marketing landing page
│   ├── layout/       # App header & shell
│   ├── providers/    # Theme & app providers
│   ├── ui/           # Reusable UI primitives
│   └── visualizer/   # Main visualizer page
├── hooks/            # Custom React hooks
└── lib/
    ├── docs/         # Markdown doc generation
    ├── examples/     # Built-in example schemas
    ├── export/       # PNG / SVG / SQL export
    ├── format/       # SQL formatter
    ├── graph/        # Graph building & layout
    ├── mock/         # Mock data generation
    ├── parser/       # SQL DDL parser
    └── schema/       # Schema types & utilities
```

## 📄 License

MIT
