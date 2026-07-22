import type { Metadata } from "next";
import { Luckiest_Guy, Comic_Neue } from "next/font/google";
import "./ramona.css";

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
  title: "Ramona's Comic Shelf",
  description: "Graphic novel & chapter book tracker for Ramona!",
};

export default function RamonaLayout({
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
