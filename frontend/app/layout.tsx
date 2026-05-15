import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = "https://pokesim.kr";
const siteName = "PokéSim KR";
const title = "PokéSim KR - 포켓몬 카드깡 시뮬레이터";
const description =
  "수집형 카드팩의 박스깡과 1팩 개봉을 가볍게 체험하는 비공식 팬메이드 시뮬레이터입니다.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "PokéSim KR",
    "포켓몬 카드",
    "포켓몬카드",
    "포켓몬 TCG",
    "포켓몬 카드 게임",
    "포켓몬 카드깡",
    "포켓몬 카드깡 시뮬레이터",
    "포켓몬 카드깡 시뮬",
    "포켓몬 카드 시뮬",
    "포켓몬 박스",
    "포켓몬 박스 시뮬",
    "팩 개봉 시뮬레이터",
    "닌자스피너",
    "메가 드림 ex",
    "pokemon card",
    "pokemon card simulator",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    noimageindex: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: true,
      "max-snippet": 160,
      "max-image-preview": "none",
      "max-video-preview": 0,
    },
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
