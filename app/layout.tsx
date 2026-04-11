import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alberta Social Studies Question Generator",
  description:
    "Generate curriculum-aligned Alberta Social Studies exam questions from uploaded sources.",
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
