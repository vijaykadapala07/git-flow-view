"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

// Optional owner for bare names, set in .env; without it a name needs its owner.
const DEFAULT_OWNER = process.env.NEXT_PUBLIC_DEFAULT_OWNER?.trim() ?? "";

/** Accepts "owner/repo", a GitHub URL, or a bare name when DEFAULT_OWNER is set. */
function parseRepo(input: string): string | null {
  const value = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const parts = value.split("/");
  const valid = /^[\w.-]+$/;
  if (DEFAULT_OWNER && parts.length === 1 && valid.test(parts[0]!))
    return `${DEFAULT_OWNER}/${parts[0]}`;
  if (parts.length >= 2 && valid.test(parts[0]!) && valid.test(parts[1]!))
    return `${parts[0]}/${parts[1]}`;
  return null;
}

export function OpenRepoForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const repo = parseRepo(value);
        if (!repo) {
          setError("Use owner/repo or a GitHub URL.");
          return;
        }
        router.push(`/${repo.toLowerCase()}`);
      }}
    >
      <div className="glass focus-within:border-primary/60 focus-within:shadow-primary/25 flex items-center gap-2 rounded-2xl border p-2 shadow-xl shadow-black/5 transition-all duration-300 focus-within:shadow-2xl">
        <Search className="text-muted-foreground ml-2 size-5 shrink-0" />
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder="owner/repo or a GitHub URL"
          aria-label="Repository"
          autoFocus
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
        >
          Open <ArrowRight className="size-4" />
        </button>
      </div>
      {error && (
        <p className="mt-1 text-center text-xs text-red-600">{error}</p>
      )}
    </form>
  );
}
