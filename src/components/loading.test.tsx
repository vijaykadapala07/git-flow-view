import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Loading from "~/components/loading";
import { GuideLines, parseGuide } from "~/components/flow/guide-text";

afterEach(() => {
  cleanup();
});

describe("generation experience", () => {
  it("shows an accessible route loading state", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading diagram");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(screen.queryByText("Loading diagram…")).not.toBeInTheDocument();
  });

  it("renders the guide as text and escapes markup", () => {
    const { sections } = parseGuide(
      "## Architecture\n<script>alert(1)</script>\n- **Important and `src/app`**",
    );
    render(<GuideLines lines={sections[0]!.lines} />);
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.getByText("src/app").tagName).toBe("CODE");
  });

  it("moves proof sections out of the guide", () => {
    const guide = parseGuide(
      "## What this shows\nText\n## Proof for every arrow\n- a -> b",
    );
    expect(guide.sections.map((section) => section.title)).toEqual([
      "What this shows",
    ]);
    expect(guide.evidence.map((section) => section.title)).toEqual([
      "Proof for every arrow",
    ]);
  });
});
