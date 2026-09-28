import Link from "next/link";

export function Footer() {
  return (
    <footer className="text-muted-foreground border-t py-6 text-center text-sm">
      Made by Vijay · Based on{" "}
      <Link
        href="https://github.com/ahmedkhaleel2004/gitdiagram"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        GitDiagram
      </Link>
    </footer>
  );
}
