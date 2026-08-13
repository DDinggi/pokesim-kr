import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  DAILY_LUCK_BOX_COUNT,
  DAILY_LUCK_ROTATION_EPOCH,
  getDailyLuckSetCode,
  getKstDate,
  getNextKstResetAt,
  isDailyLuckResultCard,
  shortSetName,
  type DailyLuckResult,
  type DailyLuckSnapshot,
} from './dailyLuck';
import { getServerDailyLuckSet } from './dailyLuckSets.server';
import {
  getDailyLuckReferencePriceSet,
  getDailyLuckReferenceValueKrw,
} from './dailyLuckPrices';
import { createLuckOpening, summarizeWeightedLuckEvent } from './luck';
import { rarityLabel, sortByRarity } from './rarity';
import { simulateBox } from './simulator';
import type { SetMeta } from './types';

const DAILY_LUCK_SCORE_VERSION = 5;
const MAX_PUBLIC_NICKNAME_LENGTH = 12;
const BLOCKED_NICKNAME_PATTERNS = [
  /(?:씨|시|씹)[1l|!]*발/iu,
  /(?:ㅆㅂ|ㅅㅂ)/u,
  /개(?:새|세|색|쉐)[1l|!]*(?:끼|기)/iu,
  /(?:좆|좇|존나)/u,
  /^(?:병신|븅신|ㅂㅅ)(?:[0-9]|년|놈|새끼|아)*$/u,
  /^(?:보지|자지|창녀)(?:[0-9]|년|놈|새끼|털|아)*$/u,
  /(?:느금마|니애미|니에미|니엄마)/u,
  /(?:motherfucker|fucking|fuck)/iu,
] as const;

interface DailyLuckRequestBody {
  publishNickname?: unknown;
  nickname?: unknown;
}

interface DailyLuckRunRow {
  day_kst: string;
  user_id: string;
  set_code: string;
  seed: string;
  public_name: string;
  nickname_public: boolean;
  score_value_krw: number;
  score_percentile: number;
  luck_tier_score: number;
  tie_breaker: number;
  result: DailyLuckResult;
  score_version: number;
}

export class DailyLuckError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    throw new DailyLuckError('오늘의 운 서버 설정을 확인하고 있습니다.', 503);
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

async function readAuthenticatedUser(
  supabase: SupabaseClient,
  token: string | null,
  required: true,
): Promise<User>;
async function readAuthenticatedUser(
  supabase: SupabaseClient,
  token: string | null,
  required: false,
): Promise<User | null>;
async function readAuthenticatedUser(
  supabase: SupabaseClient,
  token: string | null,
  required: boolean,
): Promise<User | null> {
  if (!token) {
    if (required) throw new DailyLuckError('하루 한 번 참여하려면 Google 로그인이 필요해요.', 401);
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new DailyLuckError('로그인 정보를 다시 확인해주세요.', 401);
  }
  return data.user;
}

function normalizePublicNickname(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DailyLuckError('랭킹에 표시할 닉네임을 확인해주세요.', 400);
  }

  const nickname = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!nickname || nickname.length > MAX_PUBLIC_NICKNAME_LENGTH) {
    throw new DailyLuckError(
      `닉네임은 1자 이상 ${MAX_PUBLIC_NICKNAME_LENGTH}자 이하로 입력해주세요.`,
      400,
    );
  }
  if (
    !/^[\p{L}\p{N} _.-]+$/u.test(nickname)
    || /(?:https?:|www\.|@)/i.test(nickname)
  ) {
    throw new DailyLuckError('닉네임에 사용할 수 없는 문자가 포함되어 있어요.', 400);
  }
  const compactNickname = nickname.replace(/[\s._-]+/g, '');
  if (BLOCKED_NICKNAME_PATTERNS.some((pattern) => pattern.test(compactNickname))) {
    throw new DailyLuckError('다른 사람이 불편하지 않은 닉네임을 사용해주세요.', 400);
  }
  return nickname;
}

function anonymousTrainerName(userId: string, dayKst: string): string {
  let hash = 2166136261;
  const source = `${dayKst}:${userId}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `트레이너 ${(hash >>> 0).toString(36).toUpperCase().slice(0, 4).padStart(4, '0')}`;
}

function randomTieBreaker(): number {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return random[0];
}

function createDailyLuckResult(set: SetMeta): {
  seed: string;
  scoreValueKrw: number;
  scorePercentile: number;
  luckTierScore: number;
  tieBreaker: number;
  result: DailyLuckResult;
} {
  const seed = `daily-box-${crypto.randomUUID()}`;
  const box = simulateBox(
    set.cards,
    set.box_size,
    set.type,
    set.pack_size,
    seed,
    set.code,
  );
  const cards = box.packs.flatMap((pack) => pack.cards);
  const score = summarizeWeightedLuckEvent(
    cards,
    createLuckOpening(set, { boxes: DAILY_LUCK_BOX_COUNT }),
    set,
  );
  const hitCards = sortByRarity(cards.filter(isDailyLuckResultCard));
  const topCard = hitCards[0] ?? null;
  const referencePriceSet = getDailyLuckReferencePriceSet(set.code);
  if (!referencePriceSet) {
    throw new DailyLuckError('오늘의 세트 기준가를 준비하지 못했습니다.', 500);
  }
  const scorePercentile = Math.max(0, Math.min(1, score?.valuePercentile ?? 0));
  const scoreValueKrw = getDailyLuckReferenceValueKrw(set.code, hitCards);

  return {
    seed,
    scoreValueKrw,
    scorePercentile,
    luckTierScore: score?.luckTierScore ?? 0,
    tieBreaker: randomTieBreaker(),
    result: {
      boxCount: DAILY_LUCK_BOX_COUNT,
      boxPriceKrw: referencePriceSet.boxPriceKrw,
      packCount: box.packs.length,
      packCardNums: box.packs.map((pack) => pack.cards.map((card) => card.card_num)),
      hitCardNums: hitCards.map((card) => card.card_num),
      rarityCounts: box.summary,
      hitCount: hitCards.length,
      topCardNum: topCard?.card_num ?? null,
      topRarity: topCard?.rarity ? rarityLabel(topCard.rarity, topCard) : null,
      observedValueKrw: scoreValueKrw,
      scorePercentile,
      totalCards: cards.length,
    },
  };
}

function parseSnapshot(
  raw: unknown,
  dayKst: string,
  set: SetMeta,
  isFinal = false,
): DailyLuckSnapshot {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const cardsByNum = new Map(set.cards.map((card) => [card.card_num, card]));
  const leaderboard: DailyLuckSnapshot['leaderboard'] = Array.isArray(source.leaderboard)
    ? source.leaderboard.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const row = entry as Record<string, unknown>;
        const rank = Number(row.rank);
        if (!Number.isInteger(rank) || rank < 1) return [];
        const hitCardNums = Array.isArray(row.hitCardNums)
          ? row.hitCardNums.filter((cardNum): cardNum is string => typeof cardNum === 'string')
          : [];
        const rawObservedValueKrw = Number(row.observedValueKrw);
        const observedValueKrw = Number.isFinite(rawObservedValueKrw)
          ? Math.max(0, Math.round(rawObservedValueKrw))
          : getDailyLuckReferenceValueKrw(
              set.code,
              hitCardNums.flatMap((cardNum) => {
                const card = cardsByNum.get(cardNum);
                return card ? [card] : [];
              }),
            );
        return [{
          rank,
          name: typeof row.name === 'string' && row.name.trim() ? row.name : '트레이너',
          hitCardNums,
          observedValueKrw,
          isMine: row.isMine === true,
        }];
      })
    : [];

  return {
    dayKst,
    isFinal,
    nextResetAt: getNextKstResetAt(dayKst),
    setCode: set.code,
    setName: shortSetName(set.name_ko),
    participantCount: Number(source.participantCount) || 0,
    leaderboard,
    mine: source.mine && typeof source.mine === 'object'
      ? source.mine as DailyLuckSnapshot['mine']
      : null,
  };
}

async function fetchSnapshot(
  supabase: SupabaseClient,
  dayKst: string,
  set: SetMeta,
  userId: string | null,
): Promise<DailyLuckSnapshot> {
  const { data, error } = await supabase.rpc('get_daily_luck_snapshot', {
    p_day: dayKst,
    p_user_id: userId,
  });
  if (error) {
    throw new DailyLuckError('오늘의 운을 불러오지 못했습니다.', 500);
  }
  return parseSnapshot(data, dayKst, set);
}

function resolveToday(): { dayKst: string; set: SetMeta } {
  const dayKst = getKstDate();
  const setCode = getDailyLuckSetCode(dayKst);
  const set = getServerDailyLuckSet(setCode);
  if (!set) throw new DailyLuckError('오늘의 세트를 준비하지 못했습니다.', 500);
  return { dayKst, set };
}

function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

async function removeStaleDailyLuckRuns(
  supabase: SupabaseClient,
  dayKst: string,
): Promise<void> {
  const { error } = await supabase
    .from('daily_luck_runs')
    .delete()
    .eq('day_kst', dayKst)
    .neq('score_version', DAILY_LUCK_SCORE_VERSION);
  if (error) {
    throw new DailyLuckError('오늘의 운 기준을 갱신하지 못했습니다.', 500);
  }
}

export async function getDailyLuckSnapshot(
  token: string | null,
  requestedDay: string | null = null,
): Promise<DailyLuckSnapshot> {
  const supabase = createServerSupabase();
  const user = await readAuthenticatedUser(supabase, token, false);
  const { dayKst, set } = resolveToday();
  if (requestedDay && requestedDay !== dayKst) {
    if (
      !isValidDay(requestedDay)
      || requestedDay < DAILY_LUCK_ROTATION_EPOCH
      || requestedDay > dayKst
    ) {
      throw new DailyLuckError('조회할 랭킹 날짜를 확인해주세요.', 400);
    }

    const archiveSetCode = getDailyLuckSetCode(requestedDay);
    const archiveSet = getServerDailyLuckSet(archiveSetCode);
    if (!archiveSet) {
      throw new DailyLuckError('해당 날짜의 세트를 불러오지 못했어요.', 500);
    }

    const { error: archiveError } = await supabase.rpc('archive_daily_luck_day', {
      p_day: requestedDay,
    });
    if (archiveError) {
      throw new DailyLuckError('지난 랭킹을 확정하지 못했어요.', 500);
    }

    const { data, error } = await supabase.rpc('get_daily_luck_archive_snapshot', {
      p_day: requestedDay,
      p_user_id: user?.id ?? null,
    });
    if (error) {
      throw new DailyLuckError('지난 랭킹을 불러오지 못했어요.', 500);
    }
    return parseSnapshot(data, requestedDay, archiveSet, true);
  }

  await removeStaleDailyLuckRuns(supabase, dayKst);
  return fetchSnapshot(supabase, dayKst, set, user?.id ?? null);
}

export async function openDailyLuck(
  token: string | null,
  body: DailyLuckRequestBody,
): Promise<DailyLuckSnapshot> {
  const supabase = createServerSupabase();
  const user = await readAuthenticatedUser(supabase, token, true);
  const { dayKst, set } = resolveToday();
  await removeStaleDailyLuckRuns(supabase, dayKst);
  const { data: existing, error: existingError } = await supabase
    .from('daily_luck_runs')
    .select('user_id')
    .eq('day_kst', dayKst)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingError) throw new DailyLuckError('오늘의 참여 기록을 확인하지 못했습니다.', 500);
  if (existing) return fetchSnapshot(supabase, dayKst, set, user.id);

  const publishNickname = body.publishNickname === true;
  const publicName = publishNickname
    ? normalizePublicNickname(body.nickname)
    : anonymousTrainerName(user.id, dayKst);
  const generated = createDailyLuckResult(set);
  const row: DailyLuckRunRow = {
    day_kst: dayKst,
    user_id: user.id,
    set_code: set.code,
    seed: generated.seed,
    public_name: publicName,
    nickname_public: publishNickname,
    score_value_krw: generated.scoreValueKrw,
    score_percentile: generated.scorePercentile,
    luck_tier_score: generated.luckTierScore,
    tie_breaker: generated.tieBreaker,
    result: generated.result,
    score_version: DAILY_LUCK_SCORE_VERSION,
  };

  const { error } = await supabase.from('daily_luck_runs').insert(row);
  if (error && error.code !== '23505') {
    throw new DailyLuckError('오늘의 결과를 저장하지 못했습니다.', 500);
  }
  return fetchSnapshot(supabase, dayKst, set, user.id);
}
