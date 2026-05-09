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
  title: 'PokéSim KR | 포켓몬 카드깡 시뮬레이터',
  description: '한국 포켓몬 카드 박스깡을 가상으로 즐겨보세요. 최신 확장팩을 선택하고 무료로 카드깡 시뮬레이션을 할 수 있습니다.',
  keywords: [
    '포켓몬', '포켓몬스터', '포켓몬카드', '포카', 
    '카드깡', '박스깡', '팩깡', '시뮬레이터', 
    'TCG', '포케심', 'PokéSim'
  ],
  openGraph: {
    title: 'PokéSim KR | 포켓몬 카드깡 시뮬레이터',
    description: '한국 포켓몬 카드 박스깡을 가상으로 즐겨보세요!',
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
