import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cleared",
  description: "Brand deals where the content and the payment clear together.",
};

/**
 * Root layout: loads the two DESIGN.md faces (Bricolage Grotesque for
 * headlines, Figtree for everything else) and the global tokens.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
