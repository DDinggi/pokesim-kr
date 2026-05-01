import { readFileSync } from "node:fs";
import { join } from "node:path";

const CDN_BASE = "https://cards.image.pokemonkorea.co.kr/data/";

interface Card {
  card_num: string;
  number: number;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
}

interface SetData {
  name_ko: string;
  cards: Card[];
}

const RARITY_COLOR: Record<string, string> = {
  C: "bg-gray-400",
  U: "bg-blue-400",
  R: "bg-purple-400",
  RR: "bg-yellow-400",
  SR: "bg-orange-400",
  SAR: "bg-pink-400",
  AR: "bg-cyan-400",
  UR: "bg-red-400",
};

export default function Home() {
  const setData: SetData = JSON.parse(
    readFileSync(
      join(process.cwd(), "public", "sets", "m4-ninja-spinner.json"),
      "utf8"
    )
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">PokéSim KR</h1>
        <p className="text-sm text-gray-400">{setData.name_ko}</p>
      </header>

      <main className="p-6">
        <p className="text-sm text-gray-400 mb-4">
          카드 {setData.cards.length}장
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {setData.cards.map((card) => (
            <div
              key={card.card_num}
              className="group relative flex flex-col items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${CDN_BASE}${card.image_url}`}
                alt={card.name_ko ?? card.card_num}
                className="w-full rounded-lg shadow-md group-hover:scale-105 transition-transform duration-150"
                loading="lazy"
              />
              <div className="mt-1 w-full flex items-center justify-between px-0.5">
                <span className="text-[10px] text-gray-400 truncate">
                  {card.name_ko}
                </span>
                {card.rarity && (
                  <span
                    className={`text-[9px] font-bold px-1 rounded ${RARITY_COLOR[card.rarity] ?? "bg-gray-600"} text-gray-900 shrink-0 ml-1`}
                  >
                    {card.rarity}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
