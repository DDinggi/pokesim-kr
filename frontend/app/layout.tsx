import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = "https://pokesim.kr";
const siteName = "PokéSim KR";
const title = "PokéSim KR - 카드깡 시뮬레이터";
const description =
  "포켓몬카드 박스깡과 1팩 개봉을 가볍게 체험하는 비공식 팬메이드 카드팩 시뮬레이터입니다.";

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
    "수집형 카드",
    "트레이딩 카드",
    "카드팩",
    "카드팩 개봉",
    "카드팩 시뮬레이터",
    "카드깡",
    "카드깡 시뮬레이터",
    "박스깡",
    "박스 개봉",
    "박스 개봉 시뮬레이터",
    "팩 개봉",
    "팩 개봉 시뮬레이터",
    "포켓몬카드",
    "포켓몬 카드",
    "포켓몬카드 시뮬레이터",
    "포켓몬 카드 시뮬레이터",
    "포켓몬 카드팩",
    "포켓몬 카드팩 시뮬레이터",
    "포켓몬 카드팩 개봉",
    "포켓몬 카드 뽑기",
    "포켓몬 카드 뽑기 시뮬레이터",
    "포켓몬 카드 박스 개봉",
    "포켓몬 카드 박스 개봉 시뮬레이터",
    "포켓몬 카드 확률",
    "포켓몬 카드 확률 시뮬레이터",
    "비공식 팬메이드 시뮬레이터",
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
