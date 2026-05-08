import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 정적 배포: out/ 디렉토리에 정적 HTML/CSS/JS만 생성.
  output: "export",
  // ESLint는 별도 명령(`pnpm lint`)으로 돌린다. Cloudflare Pages 빌드 안정성 우선.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // static export 모드에서는 /_next/image 엔드포인트가 없으므로 원본 URL 그대로 사용.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cards.image.pokemonkorea.co.kr" },
      { protocol: "https", hostname: "primary.jwwb.nl" }, // PokeGuardian 일본판 카드 이미지
      { protocol: "https", hostname: "card.yuyu-tei.jp" }, // yuyu-tei 일본 카드샵 이미지
    ],
  },
};

export default nextConfig;
