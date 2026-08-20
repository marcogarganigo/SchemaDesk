"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Braces,
  ClipboardPaste,
  Database,
  Download,
  FileUp,
  LayoutTemplate,
  Moon,
  MousePointerClick,
  Network,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { IconButton } from "@/components/ui/icon-button";
import { KoFiButton } from "@/components/ui/kofi-button";
import { Logo } from "@/components/ui/logo";
import { DiagramPreview } from "./diagram-preview";

const DIALECTS = ["MySQL", "PostgreSQL", "SQLite"];

const STEPS = [
  {
    icon: ClipboardPaste,
    title: "Paste or import SQL",
    description:
      "Drop in DDL from MySQL, PostgreSQL or SQLite — paste it or import a .sql file. Everything is parsed instantly, in your browser.",
  },
  {
    icon: Network,
    title: "Auto layout",
    description:
      "Tables arrange themselves around their relationships in a clean, readable flow.",
  },
  {
    icon: Download,
    title: "Export & share",
    description:
      "Ship crisp PNG or SVG exports of exactly your diagram — or copy it straight to the clipboard.",
  },
];

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Paste & parse",
    description:
      "Detect tables, columns, keys, indexes and relationships from DDL — instantly.",
  },
  {
    icon: LayoutTemplate,
    title: "Intelligent layout",
    description:
      "Tables arrange around their relationships. Switch between left-to-right and top-to-bottom flows.",
  },
  {
    icon: Database,
    title: "Multi-dialect",
    description:
      "Understands MySQL, PostgreSQL and SQLite syntax out of the box.",
  },
  {
    icon: Braces,
    title: "Format SQL",
    description:
      "Normalize and indent your schema with a single command.",
  },
  {
    icon: Share2,
    title: "Export anywhere",
    description:
      "Download PNG or SVG exports — or copy the diagram straight to your clipboard.",
  },
  {
    icon: ShieldCheck,
    title: "Local & private",
    description:
      "Everything runs in your browser. Your schema never leaves your machine.",
  },
];

function SectionHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {label}
      </div>
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted">
        {description}
      </p>
    </div>
  );
}

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // Read a .sql file and queue it for the visualizer, then navigate there.
  const handleImportSql = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".sql,.txt,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        if (!text.trim()) return;
        try {
          sessionStorage.setItem(
            "schema-desk:pending-import",
            JSON.stringify({ name: file.name.replace(/\.(sql|txt)$/i, ""), sql: text }),
          );
        } catch {
          // Storage unavailable — still open the visualizer.
        }
        router.push("/visualizer");
      };
      reader.readAsText(file);
    };
    input.click();
  }, [router]);

  return (
    <div className="flex min-h-full flex-1 flex-col overflow-y-auto bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/75 px-5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Logo size="md" />
        </div>
        <div className="flex-1" />
        <IconButton label="Toggle theme" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
        <KoFiButton variant="icon" />
        <Link
          href="/visualizer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Open Visualizer
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </nav>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[460px]"
            style={{
              background:
                "radial-gradient(680px 340px at 50% 0%, var(--accent-soft), transparent 70%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-5xl px-5 pt-20 pb-12 text-center sm:pt-24">
            <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1 text-[12px] font-medium text-secondary shadow-[var(--shadow-node)]">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Paste SQL. Get a diagram.
            </div>
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Turn SQL into beautiful{" "}
              <span className="text-gradient">database diagrams.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-muted sm:text-lg">
              Visualize your database schema instantly. Paste SQL, explore
              relationships, and design your database visually.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/visualizer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 text-[14px] font-medium text-accent-contrast transition-all hover:bg-accent-strong hover:shadow-[0_10px_28px_-8px_var(--accent)] sm:w-auto"
              >
                Open Visualizer
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/visualizer?example=blog"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-elevated px-6 text-[14px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-raised sm:w-auto"
              >
                Try an Example
              </Link>
              <button
                type="button"
                onClick={handleImportSql}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-elevated px-6 text-[14px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-raised sm:w-auto"
              >
                <FileUp className="h-4 w-4 text-accent" />
                Import SQL
              </button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
              {DIALECTS.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 font-mono text-[11.5px] text-secondary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
                  {d}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="mx-auto w-full max-w-5xl px-5">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -top-10 bottom-0 opacity-70"
              style={{
                background:
                  "radial-gradient(520px 260px at 50% 45%, var(--accent-soft), transparent 72%)",
              }}
            />
            <div className="relative rounded-xl">
              <DiagramPreview />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-24">
          <SectionHeader
            label="How it works"
            title="From SQL to diagram in seconds."
            description="No accounts, no setup, no exports of your data. Just paste your schema and go."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <span className="absolute right-5 top-5 font-mono text-[12px] text-faint">
                  0{i + 1}
                </span>
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-accent">
                  <s.icon className="h-4 w-4" />
                </span>
                <h3 className="text-[14.5px] font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-24">
          <SectionHeader
            label="Features"
            title="Everything you need to design schemas."
            description="A focused set of tools that feel fast and precise — built for developers, not demos."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-accent">
                  <f.icon className="h-4 w-4" />
                </span>
                <h3 className="text-[14px] font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-5xl px-5 py-24">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-16 text-center sm:px-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 h-64"
              style={{
                background:
                  "radial-gradient(480px 240px at 50% 0%, var(--accent-soft), transparent 70%)",
              }}
            />
            <h2 className="relative text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              See your schema differently.
            </h2>
            <p className="relative mt-3 text-[15px] text-muted">
              Free, instant, and entirely in your browser.
            </p>
            <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/visualizer"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-6 text-[14px] font-medium text-accent-contrast transition-all hover:bg-accent-strong hover:shadow-[0_10px_28px_-8px_var(--accent)]"
              >
                Start visualizing
                <ArrowRight className="h-4 w-4" />
              </Link>
              <KoFiButton variant="pill" className="h-11 px-6 text-[14px]">
                Support on Ko-fi
              </KoFiButton>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo />
          </div>
          <p className="text-[12px] text-muted">
            © {new Date().getFullYear()} Schema Desk — built for developers.
          </p>
          <div className="flex items-center gap-5 text-[12.5px] text-muted">
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <Link
              href="/visualizer"
              className="transition-colors hover:text-foreground"
            >
              Visualizer
            </Link>
            <KoFiButton variant="text">Support on Ko-fi</KoFiButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
