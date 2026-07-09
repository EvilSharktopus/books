import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alberta Social Studies Question Generator",
  description:
    "Generate curriculum-aligned Alberta Social Studies exam questions from uploaded sources.",
};

export default function GeneratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
