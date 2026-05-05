/**
 * 일본판 카드 메타(이름/번호/rarity) + 이미지 URL 자동 수집 도우미.
 *
 * 한국 발매 직후 pokemoncard.co.kr에 비정규 카드(AR/SR/SAR/MUR)가 미업로드된 상태에서,
 * 일본판 데이터(yuyu-tei + PokeGuardian)를 가져와 TSV로 출력.
 * 그 후 scripts/manual-add.ts로 data/sets/<set>.json에 머지.
 *
 * 사용:
 *   pnpm fetch-jp-images -- --set m4-ninja-spinner --jp-code m04 --pokeguardian <slug>
 *   pnpm fetch-jp-images -- --set m-nihil-zero --jp-code m03 --pokeguardian <slug> --only-rarities MUR
 *
 * 옵션:
 *   --only-rarities <CSV>  특정 rarity만 추출 (기본: AR,SR,SAR,UR,MUR,HR)
 *
 * 출력: data/manual/<set>-additions.tsv
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

// pokemoncard.co.kr 데이터에서 'UR' rarity로 분류되는 메가시리즈의 MUR를
// 일본 출처에서도 동일하게 'UR'로 정규화 (시뮬/UI 일관성 유지).
const RARITY_NORMALIZE: Record<string, string> = {
  MUR: "UR",
  HR: "UR", // 단종 등급도 UR로 흡수 (사용 빈도 0)
};

const setCode = arg("set");
const jpCode = arg("jp-code");
const pokeguardianSlug = arg("pokeguardian");
const onlyRaritiesArg = arg("only-rarities");
if (!setCode || !jpCode || !pokeguardianSlug) {
  console.error(
    "Usage: pnpm fetch-jp-images -- --set <code> --jp-code <m04> --pokeguardian <slug> [--only-rarities CSV]",
  );
  process.exit(1);
}
// 사용자 입력 정규화 (MUR을 UR으로 처리)
const allowedRarities = new Set(
  (onlyRaritiesArg ?? "AR,SR,SAR,UR,MUR,HR")
    .split(",")
    .map((s) => s.trim())
    .map((r) => RARITY_NORMALIZE[r] ?? r),
);

const UA = "Mozilla/5.0 (compatible; pokesim-kr-bot/1.0)";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

interface JpCard {
  number: number;
  rarity: string;
  jpName: string;
  yuyuteiImageUrl: string;
}

// yuyu-tei alt 형식: "NNN/총수 RARITY 名前"
// 이미지 URL: https://card.yuyu-tei.jp/poc/100_140/<jp-code>/10NNN.jpg
function parseYuyuTei(html: string): JpCard[] {
  const cards: JpCard[] = [];
  const imgRe =
    /<img[^>]*src="(https:\/\/card\.yuyu-tei\.jp\/poc\/[^"]+\/(\d{5})\.jpg)"[^>]*alt="(\d{3})\/\d+ ([A-Z]+) ([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const [, src, , numStr, rawRarity, name] = m;
    const num = parseInt(numStr, 10);
    const rarity = RARITY_NORMALIZE[rawRarity] ?? rawRarity;
    cards.push({
      number: num,
      rarity,
      jpName: name.trim(),
      yuyuteiImageUrl: src,
    });
  }
  return cards;
}

// PokeGuardian: NNN-high-<hash>.jpg URL을 number별로 매핑
function parsePokeGuardian(html: string): Map<number, string> {
  const map = new Map<number, string>();
  const re = /https:\/\/primary\.jwwb\.nl\/public\/[^"?]*?(\d{3})-high-[a-z0-9]+\.jpg/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const num = parseInt(m[1], 10);
    const url = m[0];
    if (!map.has(num)) map.set(num, url);
  }
  return map;
}

async function main() {
  console.log(`Fetching yuyu-tei ${jpCode} page...`);
  const yuyuteiHtml = await fetchText(`https://yuyu-tei.jp/sell/poc/s/${jpCode}`);
  const jpCards = parseYuyuTei(yuyuteiHtml);
  console.log(`yuyu-tei: ${jpCards.length} cards parsed`);

  console.log(`Fetching PokeGuardian page...`);
  const pgHtml = await fetchText(
    `https://www.pokeguardian.com/sets/set-lists/japanese-sets/${pokeguardianSlug}`,
  );
  const pgImageByNum = parsePokeGuardian(pgHtml);
  console.log(`PokeGuardian: ${pgImageByNum.size} high-res images parsed`);

  const irregular = jpCards.filter((c) => allowedRarities.has(c.rarity));
  console.log(
    `Filtered cards (${[...allowedRarities].join("/")}): ${irregular.length}`,
  );

  // dedupe by number (high rarity duplicates 덮어쓰기)
  const byNumber = new Map<number, JpCard>();
  for (const c of irregular) byNumber.set(c.number, c);
  const sorted = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);

  const lines: string[] = [];
  lines.push("# 자동 생성 — 일본판 메타 + 이미지 URL");
  lines.push(`# 출처: yuyu-tei (이름/rarity/번호) + PokeGuardian (고화질 이미지)`);
  lines.push(`# name_ko 칼럼은 일본어 이름 그대로. 필요 시 직접 편집.`);
  lines.push(`# 생성: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(
    [
      "number",
      "name_ko",
      "rarity",
      "card_type",
      "subtype",
      "hp",
      "type",
      "image_url",
      "_source",
    ].join("\t"),
  );
  for (const c of sorted) {
    const img = pgImageByNum.get(c.number) ?? c.yuyuteiImageUrl;
    // AR/MUR은 항상 포켓몬, ex 접미는 포켓몬, 그 외 SR/SAR은 트레이너로 추정
    const isPokemon =
      c.rarity === "AR" || c.rarity === "MUR" || c.jpName.endsWith("ex");
    const cardType = isPokemon ? "포켓몬" : "트레이너";
    const sourceHint = pgImageByNum.has(c.number) ? "PokeGuardian" : "yuyu-tei";
    lines.push(
      [
        c.number,
        c.jpName,
        c.rarity,
        cardType,
        "",
        "",
        "",
        img,
        `${sourceHint} (https://yuyu-tei.jp/sell/poc/s/${jpCode})`,
      ].join("\t"),
    );
  }

  const outDir = join(REPO_ROOT, "data", "manual");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${setCode}-additions.tsv`);
  writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");

  console.log(`\nGenerated ${sorted.length} entries → ${outPath}`);
  console.log(
    `Next: pnpm manual-add -- --set ${setCode} --tsv ../data/manual/${setCode}-additions.tsv`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
