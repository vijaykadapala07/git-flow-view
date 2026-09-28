import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Header } from "~/components/header";
import { CSPostHogProvider } from "./providers";
import { SITE_URL } from "~/lib/site";

export const metadata: Metadata = {
  title: "Git Flow View",
  description:
    "Clickable, fact-checked diagrams that explain your repositories to people new to them.",
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} font-sans`}
    >
      <body className="flex min-h-screen flex-col">
        <CSPostHogProvider>
          <Header />
          <div className="flex-grow">{children}</div>
        </CSPostHogProvider>
      </body>
    </html>
  );
}
