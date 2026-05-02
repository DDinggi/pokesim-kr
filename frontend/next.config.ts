import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.image.pokemonkorea.co.kr" },
      { protocol: "https", hostname: "primary.jwwb.nl" }, // PokeGuardian 일본판 카드 이미지
      { protocol: "https", hostname: "card.yuyu-tei.jp" }, // yuyu-tei 일본 카드샵 이미지
    ],
  },
};

export default nextConfig;
