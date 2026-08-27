import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book Shelf",
  description: "Rate the books you've read and share what you thought.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
