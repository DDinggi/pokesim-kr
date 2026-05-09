import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Cloudflare Pages + @cloudflare/next-on-pages: next/image 자동 리사이즈/포맷 변환을 Workers에서 처리.
  // ESLint는 별도 명령(`pnpm lint`)으로 돌린다. Cloudflare Pages 빌드 안정성 우선.
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "img.pokesim.kr" },
      { protocol: "https", hostname: "cards.image.pokemonkorea.co.kr" },
      { protocol: "https", hostname: "primary.jwwb.nl" }, // PokeGuardian 일본판 카드 이미지
      { protocol: "https", hostname: "card.yuyu-tei.jp" }, // yuyu-tei 일본 카드샵 이미지
    ],
  },
};

export default nextConfig;
