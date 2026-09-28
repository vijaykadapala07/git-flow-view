import Link from "next/link";
import { Workflow } from "lucide-react";

import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 h-14 border-b backdrop-blur">
      <div className="flex h-full items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Workflow className="size-4" />
          </span>
          Git Flow View
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
