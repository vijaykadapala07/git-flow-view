// Box colours per theme. Saved diagrams carry light-theme classDefs; they are
// swapped here at render time so old diagrams follow the current theme.
const TONES = {
  light: {
    toneNeutral: ["#f8fafc", "#94a3b8", "#0f172a"],
    toneBlue: ["#eff6ff", "#3b82f6", "#1e3a8a"],
    toneAmber: ["#fffbeb", "#f59e0b", "#78350f"],
    toneMint: ["#ecfdf5", "#10b981", "#064e3b"],
    toneRose: ["#fff1f2", "#f43f5e", "#881337"],
    toneIndigo: ["#eef2ff", "#6366f1", "#312e81"],
    toneTeal: ["#f0fdfa", "#14b8a6", "#134e4a"],
  },
  dark: {
    toneNeutral: ["#1e2230", "#64748b", "#e2e8f0"],
    toneBlue: ["#16213d", "#60a5fa", "#dbeafe"],
    toneAmber: ["#2a2112", "#fbbf24", "#fef3c7"],
    toneMint: ["#12271f", "#34d399", "#d1fae5"],
    toneRose: ["#2d1520", "#fb7185", "#ffe4e6"],
    toneIndigo: ["#1c1b3a", "#818cf8", "#e0e7ff"],
    toneTeal: ["#112826", "#2dd4bf", "#ccfbf1"],
  },
} as const;

export function applyDiagramPalette(chart: string, dark: boolean): string {
  const tones = TONES[dark ? "dark" : "light"];
  return chart.replace(
    /^(\s*)classDef (tone[A-Za-z]+) .*$/gm,
    (line, indent: string, name: string) => {
      const tone = tones[name as keyof typeof tones];
      if (!tone) return line;
      const [fill, stroke, color] = tone;
      return `${indent}classDef ${name} fill:${fill},stroke:${stroke},stroke-width:1.5px,color:${color}`;
    },
  );
}
