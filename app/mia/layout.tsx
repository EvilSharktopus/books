import type { Metadata } from "next";
import { Luckiest_Guy, Comic_Neue } from "next/font/google";
import "./mia.css";

const comicHeader = Luckiest_Guy({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-comic-header",
  display: "swap",
});

const comicBody = Comic_Neue({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-comic-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mia's Comic Shelf",
  description: "Graphic novel & chapter book tracker for Mia!",
};

export default function MiaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${comicHeader.variable} ${comicBody.variable}`}>
      {children}
    </div>
  );
}
