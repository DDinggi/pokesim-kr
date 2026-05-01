import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.image.pokemonkorea.co.kr" },
    ],
  },
};

export default nextConfig;
