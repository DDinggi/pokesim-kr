import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'PokéSim KR | 카드팩 시뮬레이터',
  description: '카드팩 개봉 경험을 가볍게 체험하는 비공식 팬메이드 시뮬레이터입니다.',
  robots: {
    index: false,
    follow: false,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  openGraph: {
    title: 'PokéSim KR | 카드팩 시뮬레이터',
    description: '카드팩 개봉 경험을 가볍게 체험하는 비공식 팬메이드 시뮬레이터입니다.',
    url: 'https://pokesim.kr',
    siteName: 'PokéSim KR',
    locale: 'ko_KR',
    type: 'website',
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
