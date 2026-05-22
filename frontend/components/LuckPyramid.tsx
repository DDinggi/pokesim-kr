'use client';

import type { WeightedLuckScore } from '../lib/luck';
import { RARITY_TEXT_COLOR } from '../lib/rarity';

const STRONGEST_TRAINERS = ['레드', '지우'];
const CHAMPIONS = ['그린', '목호', '성호', '윤진', '난천', '노간주', '아이리스', '카르네', '단델', '테사'];
const PROTAGONISTS = [
  '심향',
  '금선',
  '휘웅',
  '봄이',
  '광휘',
  '빛나',
  '투지',
  '투희',
  '공명',
  '명희',
  '칼름',
  '세레나',
  '영태',
  '미월',
  '승재',
  '우리',
  '보민',
  '푸름',
];
const ELITES = [
  '칸나',
  '시바',
  '국화',
  '목호',
  '일목',
  '독수',
  '카렌',
  '혁진',
  '회연',
  '미혜',
  '권수',
  '충호',
  '들국화',
  '대엽',
  '오엽',
  '망초',
  '블래리',
  '카틀레야',
  '렌부',
  '파키라',
  '즈미',
  '간피',
  '드라세나',
  '할라',
  '라이치',
  '아세로라',
  '카일리',
  '멀레인',
  '칠리',
  '뽀삐',
  '청목',
  '팔자크',
  '하솔',
  '네리네',
  '타로',
  '제빈',
];
const GYM_LEADERS = [
  '웅',
  '이슬',
  '마티스',
  '민화',
  '독수',
  '초련',
  '강연',
  '비주기',
  '비상',
  '호일',
  '꼭두',
  '유빈',
  '사도',
  '규리',
  '류옹',
  '이향',
  '원규',
  '철구',
  '암페어',
  '민지',
  '종길',
  '은송',
  '풍&란',
  '윤진',
  '강석',
  '유채',
  '자두',
  '맥실러',
  '멜리사',
  '동관',
  '무청',
  '전진',
  '덴트',
  '팟',
  '콘',
  '알로에',
  '아티',
  '카밀레',
  '야콘',
  '풍란',
  '담죽',
  '사간',
  '아이리스',
  '체렌',
  '보미카',
  '시즈',
  '비올라',
  '자크로',
  '코르니',
  '후쿠지',
  '시트론',
  '마슈',
  '고지카',
  '우르프',
  '아킬',
  '야청',
  '순무',
  '채두',
  '어니언',
  '포플러',
  '마쿠와',
  '멜론',
  '두송',
  '금랑',
  '단풍',
  '콜사',
  '모야모',
  '곤포',
  '청목',
  '라임',
  '리파',
  '그루샤',
];
const PARASOL_LADIES = [
  '유리',
  '소라',
  '미나',
  '하나',
  '채원',
  '나래',
  '수아',
  '세린',
  '다희',
  '예린',
  '연우',
  '지아',
  '하윤',
  '서아',
  '가은',
  '민서',
  '채린',
  '루나',
  '아린',
  '소윤',
];
const BUG_CATCHERS = [
  '태오',
  '민준',
  '도윤',
  '진우',
  '서준',
  '현준',
  '준호',
  '민재',
  '시우',
  '지후',
  '하람',
  '건우',
  '유찬',
  '정우',
  '도현',
  '은우',
  '승민',
  '재윤',
  '찬우',
  '규민',
];
const AFTER_SCHOOL_KIDS = [
  '지민',
  '유나',
  '서연',
  '하린',
  '다은',
  '예나',
  '수빈',
  '나은',
  '지우',
  '채아',
  '윤서',
  '아현',
  '소율',
  '민지',
  '하영',
  '서윤',
  '다온',
  '은서',
  '유진',
  '가윤',
];
const SHORTS_KIDS = [
  '오성',
  '태오',
  '준서',
  '현우',
  '민재',
  '동현',
  '준혁',
  '성민',
  '도겸',
  '시온',
  '강우',
  '재민',
  '찬호',
  '우진',
  '건희',
  '민성',
  '승우',
  '하준',
  '연준',
  '윤재',
];
const TEAM_GRUNTS = [
  '로켓단의 조무래기',
  '마그마단 조무래기',
  '아쿠아단 조무래기',
  '갤럭시단의 조무래기',
  '플라스마단 조무래기',
  '플레어단의 조무래기',
  '스컬단 조무래기',
  '옐단 조무래기',
  '스타단의 조무래기',
];
const SCORE_COUNT_ORDER = ['MUR', 'BWR', 'UR', 'HR', 'SAR', 'MA', 'SSR', 'SR'];

type LuckTier = {
  minTierScore: number;
  widthClass: string;
  title: string;
  resultLabel: (seed: string) => string;
  activeClass: string;
  resultClass: string;
};

const LUCK_TIERS: LuckTier[] = [
  {
    minTierScore: 1.55,
    widthClass: 'w-[32%]',
    title: '최강자급',
    resultLabel: (seed) => `최강자 ${pick(STRONGEST_TRAINERS, seed)}급`,
    activeClass: 'from-yellow-200 via-amber-300 to-orange-300 text-gray-950 ring-yellow-100/70 shadow-amber-950/25',
    resultClass: 'text-amber-100',
  },
  {
    minTierScore: 1.3,
    widthClass: 'w-[39%]',
    title: '주인공급',
    resultLabel: (seed) => `주인공 ${pick(PROTAGONISTS, seed)}급`,
    activeClass: 'from-orange-200 via-red-300 to-rose-400 text-gray-950 ring-orange-100/70 shadow-red-950/25',
    resultClass: 'text-orange-100',
  },
  {
    minTierScore: 1,
    widthClass: 'w-[46%]',
    title: '챔피언급',
    resultLabel: (seed) => `챔피언 ${pick(CHAMPIONS, seed)}급`,
    activeClass: 'from-fuchsia-300 via-violet-400 to-indigo-500 text-white ring-violet-200/60 shadow-violet-950/25',
    resultClass: 'text-violet-100',
  },
  {
    minTierScore: 0.85,
    widthClass: 'w-[53%]',
    title: '사천왕급',
    resultLabel: (seed) => `사천왕 ${pick(ELITES, seed)}급`,
    activeClass: 'from-sky-300 via-blue-400 to-indigo-500 text-white ring-sky-200/60 shadow-blue-950/25',
    resultClass: 'text-sky-100',
  },
  {
    minTierScore: 0.65,
    widthClass: 'w-[60%]',
    title: '체육관 관장급',
    resultLabel: (seed) => `체육관 관장 ${pick(GYM_LEADERS, seed)}급`,
    activeClass: 'from-cyan-200 via-teal-300 to-emerald-400 text-gray-950 ring-cyan-100/60 shadow-teal-950/20',
    resultClass: 'text-teal-100',
  },
  {
    minTierScore: 0.4,
    widthClass: 'w-[67%]',
    title: '파라솔 아가씨급',
    resultLabel: (seed) => `파라솔 아가씨 ${pick(PARASOL_LADIES, seed)}급`,
    activeClass: 'from-rose-200 via-pink-300 to-fuchsia-400 text-gray-950 ring-pink-100/60 shadow-pink-950/20',
    resultClass: 'text-pink-100',
  },
  {
    minTierScore: 0.15,
    widthClass: 'w-[74%]',
    title: '곤충채집소년급',
    resultLabel: (seed) => `곤충채집소년 ${pick(BUG_CATCHERS, seed)}급`,
    activeClass: 'from-amber-200 via-orange-300 to-orange-500 text-gray-950 ring-orange-100/60 shadow-orange-950/20',
    resultClass: 'text-orange-100',
  },
  {
    minTierScore: -0.25,
    widthClass: 'w-[81%]',
    title: '학원 끝난 아이급',
    resultLabel: (seed) => `학원 끝난 아이 ${pick(AFTER_SCHOOL_KIDS, seed)}급`,
    activeClass: 'from-slate-300 via-gray-300 to-slate-400 text-gray-950 ring-slate-100/50 shadow-slate-950/20',
    resultClass: 'text-slate-100',
  },
  {
    minTierScore: -0.8,
    widthClass: 'w-[88%]',
    title: '반바지 꼬마급',
    resultLabel: (seed) => `반바지 꼬마 ${pick(SHORTS_KIDS, seed)}급`,
    activeClass: 'from-orange-300 via-red-400 to-rose-500 text-white ring-orange-100/50 shadow-red-950/20',
    resultClass: 'text-rose-100',
  },
  {
    minTierScore: Number.NEGATIVE_INFINITY,
    widthClass: 'w-[95%]',
    title: '조무래기급',
    resultLabel: (seed) => `${pick(TEAM_GRUNTS, seed)}급`,
    activeClass: 'from-gray-500 via-slate-600 to-gray-800 text-white ring-gray-200/40 shadow-black/30',
    resultClass: 'text-gray-100',
  },
];

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick(values: string[], seed: string): string {
  return values[hashSeed(seed) % values.length];
}

type HitCountPart = {
  rarity: string;
  count: number;
};

function getHitCountParts(score: WeightedLuckScore): HitCountPart[] {
  const counts: Record<string, number> = {
    ...score.scoreCounts,
    SAR: score.sarCount,
  };
  if (score.topCount > 0 && !counts.MUR && !counts.BWR && !counts.UR) {
    counts['MUR/BWR'] = score.topCount;
  }
  const parts = SCORE_COUNT_ORDER
    .filter((rarity) => (counts[rarity] ?? 0) > 0)
    .map((rarity) => ({ rarity, count: counts[rarity] }));

  if ((counts['MUR/BWR'] ?? 0) > 0) parts.unshift({ rarity: 'MUR/BWR', count: counts['MUR/BWR'] });
  return parts;
}

function formatOpeningAmount(boxes = 0, packs = 0): string {
  const parts = [];
  if (boxes > 0) parts.push(`${boxes.toLocaleString()}박스`);
  if (packs > 0) parts.push(`${packs.toLocaleString()}팩`);
  return parts.length > 0 ? parts.join(' · ') : '0팩';
}

export function LuckPyramid({
  score,
  seed,
  title = '내 운 피라미드',
  boxes,
  packs,
}: {
  score: WeightedLuckScore | null;
  seed: string;
  title?: string;
  boxes?: number;
  packs?: number;
}) {
  if (!score) return null;

  const activeIndex = LUCK_TIERS.findIndex((tier) => score.luckTierScore >= tier.minTierScore);
  const activeTier = LUCK_TIERS[activeIndex] ?? LUCK_TIERS[LUCK_TIERS.length - 1];
  const activeSeed = `${seed}:${score.topCount}:${score.sarCount}:${score.luckTierScore}`;
  const hitParts = getHitCountParts(score);

  return (
    <section className="rounded-2xl bg-gray-900/55 p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-950/35 px-3 py-1.5 text-xs font-bold text-gray-300 ring-1 ring-white/10">
              <span className="mr-1.5 text-gray-500">개봉</span>
              {formatOpeningAmount(boxes, packs)}
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full bg-gray-950/35 px-3 py-1.5 text-xs font-bold text-gray-300 ring-1 ring-white/10">
              <span className="text-gray-500">힛카드</span>
              {hitParts.length > 0 ? (
                hitParts.map((part, index) => (
                  <span key={part.rarity} className="inline-flex items-center gap-1">
                    {index > 0 && <span className="text-gray-700">·</span>}
                    <span className={getHitTextColor(part.rarity)}>{part.rarity}</span>
                    <span className="text-gray-200">{part.count}</span>
                  </span>
                ))
              ) : (
                <span className="text-gray-400">없음</span>
              )}
            </span>
          </div>
        </div>
        <div className="w-fit max-w-full shrink-0 rounded-2xl bg-gray-950/45 px-4 py-3 ring-1 ring-white/10 lg:self-start lg:text-left">
          <p className="text-[10px] font-black tracking-widest text-gray-500">현재 등급</p>
          <p className={`mt-0.5 whitespace-nowrap text-3xl font-black tracking-tight sm:text-4xl ${activeTier.resultClass}`}>
            {activeTier.resultLabel(activeSeed)}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-2xl space-y-1.5">
        {LUCK_TIERS.map((tier, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={tier.title}
              className={`${tier.widthClass} mx-auto h-7 px-3 text-center transition sm:h-8 ${
                isActive
                  ? `bg-gradient-to-r ${tier.activeClass} shadow-lg ring-1`
                  : 'bg-gradient-to-r from-slate-950/45 via-slate-800/45 to-slate-950/45 text-slate-500 ring-1 ring-white/[0.05]'
              }`}
              aria-current={isActive ? 'true' : undefined}
              style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)' }}
            >
              <div className="flex h-full items-center justify-center gap-2 text-[10px] font-black sm:text-[11px]">
                <span>{tier.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-gray-600">
        힛카드 수에 대한 추정 확률로 계산합니다. 재미용 지표로 봐주세요.
      </p>
    </section>
  );
}

function getHitTextColor(rarity: string): string {
  if (rarity === 'MUR/BWR') return RARITY_TEXT_COLOR.MUR;
  return RARITY_TEXT_COLOR[rarity] ?? 'text-gray-200';
}
