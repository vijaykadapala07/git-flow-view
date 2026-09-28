import type { Metadata } from "next";
import { FileCode2, MessageSquare, ShieldCheck, Workflow } from "lucide-react";

import { Footer } from "~/components/footer";
import { OpenRepoForm } from "~/components/open-repo-form";

export const metadata: Metadata = {
  title: "Git Flow View",
};

const points = [
  {
    icon: Workflow,
    title: "A reading path per repo",
    text: "A few short diagrams, read in order, explain what the repo holds and how it works.",
  },
  {
    icon: FileCode2,
    title: "Every box opens its file",
    text: "Click a box to see what it is and jump straight to the file.",
  },
  {
    icon: ShieldCheck,
    title: "Every arrow is checked",
    text: "Links are proven against the code, so nothing on the diagram is a guess.",
  },
  {
    icon: MessageSquare,
    title: "Ask Vijay 😉",
    text: "Ask anything; answers read the real code and cite the lines they used.",
  },
];

function MiniDiagram() {
  const box =
    "glass rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm";
  return (
    <div
      aria-hidden="true"
      className="fade-up relative mx-auto mb-10 flex w-fit items-center gap-3"
    >
      <span
        className={`${box} border-sky-400/50 text-sky-600 dark:text-sky-300`}
      >
        repo
      </span>
      <span className="h-px w-8 bg-gradient-to-r from-sky-400/70 to-violet-400/70" />
      <span
        className={`${box} border-violet-400/60 text-violet-600 shadow-violet-500/20 dark:text-violet-300`}
      >
        diagram
      </span>
      <span className="h-px w-8 bg-gradient-to-r from-violet-400/70 to-emerald-400/70" />
      <span
        className={`${box} border-emerald-400/50 text-emerald-600 dark:text-emerald-300`}
      >
        answers
      </span>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-orb top-[-8rem] left-[12%] size-[26rem] bg-indigo-500/40" />
        <div
          className="glow-orb top-[2rem] right-[10%] size-[22rem] bg-fuchsia-500/30"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-20">
        <MiniDiagram />
        <h1 className="fade-up text-gradient text-center text-4xl font-semibold tracking-tight sm:text-6xl">
          Understand a repo
          <br />
          in minutes
        </h1>
        <p
          className="fade-up text-muted-foreground mx-auto mt-5 max-w-xl text-center text-lg"
          style={{ animationDelay: "80ms" }}
        >
          Clickable diagrams that show how a repository is built and how its
          parts connect.
        </p>
        <div className="fade-up mt-10" style={{ animationDelay: "160ms" }}>
          <OpenRepoForm />
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2">
          {points.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="fade-up glass group hover:border-primary/40 hover:shadow-primary/10 rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ animationDelay: `${240 + index * 60}ms` }}
            >
              <span className="from-primary/20 to-primary/5 text-primary ring-primary/20 flex size-9 items-center justify-center rounded-lg bg-gradient-to-br ring-1">
                <Icon className="size-[18px]" />
              </span>
              <p className="mt-3 font-medium">{title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
