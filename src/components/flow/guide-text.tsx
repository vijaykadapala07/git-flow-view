import type { ReactNode } from "react";

// The guide uses a small Markdown subset: "## " headings, "- " bullets,
// **bold** and `code`. Nothing is inserted as HTML.
function inline(text: string): ReactNode[] {
  return Array.from(
    text.matchAll(/`[^`]+`|\*\*[^*]+\*\*|[^`*]+|[`*]/g),
    (match) => {
      const part = match[0];
      // A `path:line` citation shows as a file chip.
      if (/^`[\w./-]+\.\w+:\d+(-\d+)?`$/.test(part))
        return (
          <code
            key={match.index}
            className="border-primary/30 bg-primary/10 text-primary mx-0.5 inline-flex items-center rounded-md border px-1.5 py-px font-mono text-[0.75em] whitespace-nowrap"
          >
            {part.slice(1, -1)}
          </code>
        );
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
        return (
          <code
            key={match.index}
            className="bg-accent rounded px-1 py-0.5 font-mono text-[0.8em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      if (part.startsWith("**") && part.endsWith("**") && part.length > 3)
        return (
          <strong key={match.index} className="text-foreground font-semibold">
            {inline(part.slice(2, -2))}
          </strong>
        );
      return part;
    },
  );
}

export interface GuideSection {
  title: string;
  lines: string[];
}

const EVIDENCE = /^(Proof for every arrow|Left out)/;

/** Splits the explanation into sections; proof sections go to `evidence`. */
export function parseGuide(text: string): {
  sections: GuideSection[];
  evidence: GuideSection[];
} {
  const sections: GuideSection[] = [];
  let current: GuideSection = { title: "", lines: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      if (current.title || current.lines.length) sections.push(current);
      current = { title: heading[1]!, lines: [] };
    } else if (line.trim()) current.lines.push(line.trim());
  }
  if (current.title || current.lines.length) sections.push(current);
  return {
    sections: sections.filter((section) => !EVIDENCE.test(section.title)),
    evidence: sections.filter((section) => EVIDENCE.test(section.title)),
  };
}

export function GuideLines({ lines }: { lines: string[] }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="marker:text-muted-foreground ml-4 list-disc space-y-1.5"
      >
        {bullets.map((bullet, index) => (
          <li key={index}>{inline(bullet)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) bullets.push(line.replace(/^[-*]\s+/, ""));
    else {
      flush();
      blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return (
    <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
      {blocks}
    </div>
  );
}
