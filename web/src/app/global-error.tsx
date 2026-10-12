"use client";

import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { ErrorMessage } from "@/components/errors/error-message";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["opsz"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

/**
 * EP-FR-05: when even the root layout fails, a bare page of its own with the
 * same message and "Reload", in the world's colours and fonts.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} antialiased`}>
      <body className="min-h-dvh bg-ground px-4 text-ink">
        <title>Something went wrong · Cleared</title>
        <main id="main">
          <ErrorMessage error={error} retry={() => window.location.reload()} action="Reload" />
        </main>
      </body>
    </html>
  );
}
