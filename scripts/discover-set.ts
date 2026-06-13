#!/usr/bin/env tsx
/**
 * pokemoncard.co.kr 검색 API로 새 세트의 식별 정보를 한 번에 뽑는다.
 * 새 박스 추가 0단계(디스커버리)용. 결과로 스켈레톤/collect/fullahead에 필요한
 * 폴더 prefix·파일 prefix·card_num prefix·번호 범위·shop code를 출력한다.
 *
 * 사용 (레포 루트):
 *   pnpm --dir scripts discover -- "일격마스터"
 *   pnpm --dir scripts discover -- "칠흑의 가이스트" --prefix S6K
 *   pnpm --dir scripts discover -- "쌍벽의 파이터" --delay-ms 1000
 *
 * 옵션:
 *   --prefix <FILEPREFIX>  특정 파일 prefix(S5I 등)만 보고 싶을 때 필터
 *   --delay-ms <n>         페이지 간 대기(기본 800ms)
 *   --max-pages <n>        안전 상한(기본 50)
 */
import process from "node:process";

const BASE_URL = "https://pokemoncard.co.kr";
const DEFAULT_DELAY_MS = 800;

interface SearchResult {
  CardNum: string;
  feature_image: string;
}

// pnpm이 넘기는 단독 "--" 구분자는 제거하고 파싱한다.
const argv = process.argv.slice(2).filter((a) => a !== "--");
function readArg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const searchText = readArg("search") ?? positional[0];
const prefixFilter = readArg("prefix")?.toUpperCase();
const delayMs = Number(readArg("delay-ms")) >= 0 ? Number(readArg("delay-ms")) : DEFAULT_DELAY_MS;
const maxPages = Number(readArg("max-pages")) > 0 ? Number(readArg("max-pages")) : 50;

if (!searchText) {
  console.error('Usage: pnpm --dir scripts discover -- "<검색어>" [--prefix S5I]');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripPhpNotices = (t: string) => {
  const i = t.indexOf("{");
  return i === -1 ? t : t.slice(i);
};

async function searchPage(text: string, cursor: number) {
  const fd = new FormData();
  fd.append("action", "search_text_cards");
  fd.append("search_text", text);
  fd.append("search_params", "all");
  fd.append("limit", String(cursor));
  const res = await fetch(`${BASE_URL}/v2/ajax2_dev2`, {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest", Referer: `${BASE_URL}/cards` },
    body: fd,
  });
  let data: { count?: number; limit?: number; result?: Record<string, SearchResult> };
  try {
    data = JSON.parse(stripPhpNotices(await res.text()));
  } catch {
    return { count: 0, limit: 0, results: [] as SearchResult[] };
  }
  return {
    count: data.count ?? 0,
    limit: data.limit ?? 0,
    results: data.result ? (Object.values(data.result) as SearchResult[]) : [],
  };
}

interface Group {
  filePrefix: string;
  folder: string;
  shopCode: string;
  cardNumPrefix: string;
  count: number;
  minNum: number;
  maxNum: number;
  sampleImage: string;
  sampleCardNum: string;
}

function parse(result: SearchResult) {
  const img = (result.feature_image ?? "").replace(/\?.*$/, "");
  const folder = img.replace(/\/[^/]+$/, "/");
  const m = img.match(/\/([A-Za-z0-9]+)_(\d+)\.(?:png|jpg|jpeg|webp)$/i);
  const filePrefix = m?.[1] ?? "(unknown)";
  const number = m ? Number(m[2]) : NaN;
  const cardNum = String(result.CardNum).trim().replace(/\s+/g, "");
  const cardNumPrefix = cardNum.replace(/\d{3}$/, "");
  return { img, folder, filePrefix, number, cardNum, cardNumPrefix };
}

async function main() {
  console.log(`\n검색어: "${searchText}"${prefixFilter ? `  (prefix=${prefixFilter})` : ""}\n`);

  const groups = new Map<string, Group>();
  let cursor = 0;
  let total = 0;

  for (let page = 0; page < maxPages; page++) {
    const { count, limit, results } = await searchPage(searchText, cursor);
    for (const r of results) {
      const p = parse(r);
      if (prefixFilter && p.filePrefix.toUpperCase() !== prefixFilter) continue;
      total++;
      const key = p.filePrefix;
      const g = groups.get(key);
      if (!g) {
        groups.set(key, {
          filePrefix: p.filePrefix,
          folder: p.folder,
          shopCode: p.filePrefix.toLowerCase(),
          cardNumPrefix: p.cardNumPrefix,
          count: 1,
          minNum: p.number,
          maxNum: p.number,
          sampleImage: p.img,
          sampleCardNum: p.cardNum,
        });
      } else {
        g.count++;
        if (Number.isFinite(p.number)) {
          g.minNum = Math.min(g.minNum, p.number);
          g.maxNum = Math.max(g.maxNum, p.number);
        }
      }
    }
    if (count === 0) break;
    cursor = limit;
    await sleep(delayMs);
  }

  if (groups.size === 0) {
    console.log("결과 없음. 검색어를 바꿔서 다시 시도 (예: 띄어쓰기 제거).");
    return;
  }

  const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
  console.log(`총 ${total}장, ${sorted.length}개 prefix\n`);
  for (const g of sorted) {
    console.log(`■ ${g.filePrefix}  (${g.count}장, #${g.minNum}~${g.maxNum})`);
    console.log(`   폴더 prefix     : ${g.folder}`);
    console.log(`   card_num prefix : ${g.cardNumPrefix}`);
    console.log(`   fullahead shop  : ${g.shopCode}`);
    console.log(`   seed image_url  : ${g.folder}${g.filePrefix}_001.png`);
    console.log(`   sample          : ${g.sampleCardNum}  ${g.sampleImage}`);
    console.log("");
  }

  const main = sorted[0];
  console.log("다음 단계 힌트:");
  console.log(`  collect: pnpm --dir scripts collect -- --set <code> --search-text "${searchText}"`);
  console.log(`  seed   : "image_url": "${main.folder}${main.filePrefix}_001.png"`);
  if (sorted.length > 1) {
    console.log(`  주의   : prefix 여러 개(${sorted.map((g) => g.filePrefix).join(", ")}) — 자매 세트/프로모 폴더 공유.`);
    console.log(`           collect 후 파일 prefix로 교차오염 확인. 특정 prefix만 보려면 --prefix 사용.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
