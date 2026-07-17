import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MwanaAI — Multilingual Learning Companion",
  description:
    "Gemma 4-powered AI tutor for African students. Learn, practice, and revise in English, Luganda, Runyankole, and Kiswahili.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
