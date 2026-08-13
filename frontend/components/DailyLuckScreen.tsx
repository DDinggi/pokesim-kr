'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getBoxThumbnailImageSrc } from '../lib/boxImages';
import {
  DAILY_LUCK_ROTATION_EPOCH,
  getDailyLuckFortune,
  getDailyLuckSet,
  getNextKstResetAt,
  isDailyLuckResultCard,
  shortSetName,
  type DailyLuckFortune,
  type DailyLuckSnapshot,
} from '../lib/dailyLuck';
import {
  CARD_GLOW,
  RARITY_BADGE,
  rarityLabel,
  sortByRarity,
} from '../lib/rarity';
import {
  CARD_IMAGES_ENABLED,
  CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED,
  resolveCardImageUrl,
} from '../lib/images';
import { trackUserEvent } from '../lib/statsTracker';
import type { Card, SetMeta } from '../lib/types';
import { simulateBox } from '../lib/simulator';
import { CardModal } from './CardModal';

interface DailyLuckScreenProps {
  sets: SetMeta[];
  accessToken: string | null;
  authenticated: boolean;
  displayName: string | null;
  onBackToMain: () => void;
  accountBar?: ReactNode;
}

const DAILY_LUCK_REFRESH_INTERVAL_MS = 30_000;

function parseApiError(value: unknown): string {
  if (
    value
    && typeof value === 'object'
    && 'error' in value
    && typeof (value as { error?: unknown }).error === 'string'
  ) {
    return (value as { error: string }).error;
  }
  return '오늘의 운을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function formatRemaining(resetAt: string, now: number): string {
  const remaining = Math.max(0, new Date(resetAt).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}시간 ${minutes}분 뒤 갱신`;
}

function shiftDate(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

function cardsFromNums(set: SetMeta | null, cardNums: string[]): Card[] {
  if (!set) return [];
  const byCardNum = new Map(set.cards.map((card) => [card.card_num, card]));
  return cardNums.flatMap((cardNum) => {
    const card = byCardNum.get(cardNum);
    return card ? [card] : [];
  });
}

function resultCards(set: SetMeta | null, snapshot: DailyLuckSnapshot | null): Card[] {
  const packs = snapshot?.mine?.result.packCardNums;
  return cardsFromNums(set, Array.isArray(packs) ? packs.flat() : []);
}

function formatReferenceValue(valueKrw: number): string {
  return `약 ${Math.max(0, Math.round(valueKrw)).toLocaleString()}원급`;
}

function localPreviewMode(): 'empty' | 'result' | null {
  if (typeof window === 'undefined') return null;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return null;
  const value = new URLSearchParams(window.location.search).get('debugDailyLuck');
  return value === 'empty' || value === 'result' ? value : null;
}

function createLocalPreview(set: SetMeta, mode: 'empty' | 'result'): DailyLuckSnapshot {
  const dayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const base: DailyLuckSnapshot = {
    dayKst,
    isFinal: false,
    nextResetAt: getNextKstResetAt(dayKst),
    setCode: set.code,
    setName: shortSetName(set.name_ko),
    participantCount: mode === 'result' ? 63 : 42,
    leaderboard: [],
    mine: null,
  };
  if (mode === 'empty') return base;

  const box = simulateBox(
    set.cards,
    set.box_size,
    set.type,
    set.pack_size,
    `daily-luck-preview:${dayKst}:${set.code}`,
    set.code,
  );
  const cards = box.packs.flatMap((pack) => pack.cards);
  const hits = sortByRarity(cards.filter(isDailyLuckResultCard));
  const totalCards = cards.length;
  const packCardNums = box.packs.map((pack) => pack.cards.map((card) => card.card_num));
  const topCard = hits[0] ?? null;
  const mine = {
    rank: 7,
    publicName: '테스트 트레이너',
    nicknamePublic: true,
    openedAt: `${dayKst}T03:00:00.000Z`,
    result: {
      boxCount: 1,
      boxPriceKrw: set.box_price_krw,
      packCount: set.box_size,
      packCardNums,
      hitCardNums: hits.map((card) => card.card_num),
      rarityCounts: box.summary,
      hitCount: hits.length,
      topCardNum: topCard?.card_num ?? null,
      topRarity: topCard?.rarity ? rarityLabel(topCard.rarity, topCard) : null,
      observedValueKrw: 150_000,
      scorePercentile: 0.76,
      totalCards,
    },
  };
  return {
    ...base,
    leaderboard: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      name: index === 6 ? mine.publicName : `트레이너 ${String(index + 1).padStart(2, '0')}`,
      hitCardNums: hits.slice(0, Math.max(1, 3 - Math.floor(index / 4))).map((card) => card.card_num),
      observedValueKrw: 210_000 - index * 10_000,
      isMine: index === 6,
    })),
    mine,
  };
}

export function DailyLuckScreen({
  sets,
  accessToken,
  authenticated,
  displayName,
  onBackToMain,
  accountBar,
}: DailyLuckScreenProps) {
  const [snapshot, setSnapshot] = useState<DailyLuckSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishNickname, setPublishNickname] = useState(true);
  const [nicknameOverride, setNicknameOverride] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [openedCard, setOpenedCard] = useState<Card | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const trackedDay = useRef<string | null>(null);
  const nickname = nicknameOverride ?? (displayName ?? '').slice(0, 12);
  const hasDailyLuckResult = Boolean(snapshot?.mine);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    const previewMode = localPreviewMode();
    const previewSet = getDailyLuckSet(sets);
    if (previewMode && previewSet) {
      setSnapshot(createLocalPreview(previewSet, previewMode));
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/daily-luck', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseApiError(body));
      setSnapshot(body as DailyLuckSnapshot);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : parseApiError(null));
    } finally {
      setLoading(false);
    }
  }, [accessToken, sets]);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch('/api/daily-luck', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: 'no-store',
    });
    if (!response.ok) return;
    const body = await response.json().catch(() => null);
    if (body) setSnapshot(body as DailyLuckSnapshot);
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    if (!hasDailyLuckResult || localPreviewMode()) return;

    let active = true;
    let refreshing = false;
    const refreshWhenVisible = async () => {
      if (!active || refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      try {
        await refreshSnapshot();
      } catch {
        return;
      } finally {
        refreshing = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshWhenVisible();
    };
    const timer = window.setInterval(
      () => void refreshWhenVisible(),
      DAILY_LUCK_REFRESH_INTERVAL_MS,
    );
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasDailyLuckResult, refreshSnapshot]);

  useEffect(() => {
    if (!snapshot || trackedDay.current === snapshot.dayKst) return;
    trackedDay.current = snapshot.dayKst;
    trackUserEvent({
      eventName: 'view_daily_leaderboard',
      setCode: snapshot.setCode,
      metadata: {
        participantCount: snapshot.participantCount,
        hasResult: Boolean(snapshot.mine),
      },
    });
  }, [snapshot]);

  const fallbackSet = getDailyLuckSet(sets);
  const set = snapshot
    ? sets.find((candidate) => candidate.code === snapshot.setCode) ?? fallbackSet
    : fallbackSet;
  const allCards = useMemo(() => resultCards(set, snapshot), [set, snapshot]);
  const hitCards = useMemo(
    () => sortByRarity(allCards.filter(isDailyLuckResultCard)),
    [allCards],
  );
  const fortune = useMemo(
    () => snapshot?.mine ? getDailyLuckFortune(snapshot.mine, snapshot.dayKst) : null,
    [snapshot],
  );

  const handleOpen = async () => {
    if (!accessToken || opening) return;
    if (publishNickname && !nickname.trim()) {
      setError('랭킹에 표시할 닉네임을 입력해주세요.');
      return;
    }

    setOpening(true);
    setError(null);
    try {
      const [response] = await Promise.all([
        fetch('/api/daily-luck', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publishNickname,
            nickname: publishNickname ? nickname : null,
          }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 1_600)),
      ]);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseApiError(body));
      const nextSnapshot = body as DailyLuckSnapshot;
      setSnapshot(nextSnapshot);
      trackUserEvent({
        eventName: 'complete_daily_luck',
        setCode: nextSnapshot.setCode,
        metadata: {
          rank: nextSnapshot.mine?.rank ?? 0,
          participantCount: nextSnapshot.participantCount,
          nicknamePublic: nextSnapshot.mine?.nicknamePublic ?? false,
          boxCount: 1,
        },
      });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : parseApiError(null));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex min-w-0 items-center gap-4 min-[1400px]:block">
            <button
              type="button"
              onClick={onBackToMain}
              className="shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs text-gray-400 transition hover:bg-white/5 hover:text-white min-[1400px]:absolute min-[1400px]:right-full min-[1400px]:top-1/2 min-[1400px]:mr-4 min-[1400px]:-translate-y-1/2"
            >
              ← 메인
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">오늘의 운</h1>
              <p className="mt-1 text-xs text-gray-500">하루 한 박스 · 매일 자정 갱신</p>
            </div>
          </div>
          {accountBar ? <div className="w-full sm:ml-auto sm:w-auto">{accountBar}</div> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid items-center gap-6 border-b border-gray-800 pb-8 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-yellow-300">
              Daily Box · {snapshot?.dayKst ?? '오늘'}
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              {snapshot?.setName ?? (set ? shortSetName(set.name_ko) : '오늘의 세트')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
              오늘의 한 박스로 운세를 확인해보세요.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-gray-500">
              <span>{snapshot ? `${snapshot.participantCount.toLocaleString()}명 참여` : '참여 현황 확인 중'}</span>
              {snapshot ? <span>{formatRemaining(snapshot.nextResetAt, now)}</span> : null}
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-44 sm:w-52 md:w-56">
            {set ? (
              <Image
                src={getBoxThumbnailImageSrc(set.code)}
                alt={set.name_ko}
                fill
                priority
                sizes="224px"
                className={`object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)] ${opening ? 'animate-pulse' : ''}`}
              />
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-300 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-bold text-red-100">{error}</p>
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              className="rounded px-2 py-1 text-xs font-bold text-red-100 hover:bg-red-400/10"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {loading && !snapshot ? (
          <div className="flex min-h-56 items-center justify-center">
            <p className="animate-pulse text-sm font-bold text-gray-500">오늘의 박스를 준비하는 중...</p>
          </div>
        ) : snapshot?.mine && fortune ? (
          <DailyResult
            snapshot={snapshot}
            fortune={fortune}
            hitCards={hitCards}
            allCards={allCards}
            showAllCards={showAllCards}
            onToggleAllCards={() => setShowAllCards((shown) => !shown)}
            onCardClick={setOpenedCard}
          />
        ) : snapshot ? (
          <DailyDrawForm
            authenticated={authenticated}
            nickname={nickname}
            publishNickname={publishNickname}
            opening={opening}
            onNicknameChange={setNicknameOverride}
            onPublishNicknameChange={setPublishNickname}
            onOpen={() => void handleOpen()}
          />
        ) : null}

        {snapshot ? (
          <DailyLeaderboard
            key={snapshot.dayKst}
            snapshot={snapshot}
            sets={sets}
            accessToken={accessToken}
            onCardClick={setOpenedCard}
          />
        ) : null}

      </main>

      {openedCard ? <CardModal card={openedCard} onClose={() => setOpenedCard(null)} /> : null}
    </div>
  );
}

function DailyDrawForm({
  authenticated,
  nickname,
  publishNickname,
  opening,
  onNicknameChange,
  onPublishNicknameChange,
  onOpen,
}: {
  authenticated: boolean;
  nickname: string;
  publishNickname: boolean;
  opening: boolean;
  onNicknameChange: (value: string) => void;
  onPublishNicknameChange: (value: boolean) => void;
  onOpen: () => void;
}) {
  if (opening) return <DailyOmikujiLoading />;

  return (
    <section className="py-10 sm:py-12">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs font-black uppercase tracking-widest text-yellow-300">오늘의 운세 뽑기</p>
        <h3 className="mt-2 text-2xl font-black sm:text-3xl">
          한 박스로 오늘의 운을 시험해보세요
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          하루 한 번, 운세와 순위가 정해집니다.
        </p>

        {authenticated ? (
          <div className="mx-auto mt-7 max-w-sm space-y-3 text-left">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-gray-400">랭킹 닉네임</span>
              <input
                value={nickname}
                maxLength={12}
                disabled={!publishNickname || opening}
                onChange={(event) => onNicknameChange(event.target.value)}
                className="h-11 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-sm font-bold text-white outline-none transition focus:border-yellow-300 disabled:text-gray-600"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={publishNickname}
                disabled={opening}
                onChange={(event) => onPublishNicknameChange(event.target.checked)}
                className="h-4 w-4 accent-yellow-400"
              />
              TOP 10에 닉네임 공개
            </label>
          </div>
        ) : (
          <p className="mx-auto mt-7 max-w-md border-l-2 border-cyan-300/70 pl-4 text-left text-sm leading-relaxed text-gray-400">
            계정마다 하루 한 번만 결과를 남기기 위해 Google 로그인이 필요해요.
            일반 박스 개봉은 로그인 없이 계속 이용할 수 있습니다.
          </p>
        )}

        <button
          type="button"
          onClick={onOpen}
          disabled={!authenticated || opening}
          className="mt-7 h-12 min-w-56 rounded-md bg-yellow-400 px-7 text-sm font-black text-gray-950 shadow-[0_12px_30px_rgba(250,204,21,0.16)] transition hover:bg-yellow-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none"
        >
          {authenticated ? '오늘의 한 박스 열기' : '로그인 후 참여하기'}
        </button>
      </div>
    </section>
  );
}

function DailyOmikujiLoading() {
  return (
    <section className="py-10 sm:py-12" aria-live="polite" aria-label="오늘의 운세를 뽑는 중">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="overflow-hidden rounded-xl border border-red-200/20 bg-gray-900 shadow-[0_18px_40px_rgba(0,0,0,0.32)]" aria-hidden="true">
          <Image
            src="/daily-omikuji.gif"
            alt=""
            width={1105}
            height={1105}
            priority
            unoptimized
            className="h-52 w-52 object-contain sm:h-60 sm:w-60"
          />
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-yellow-300">오늘의 제비</p>
        <h3 className="mt-2 text-2xl font-black sm:text-3xl">한 박스의 운을 섞는 중...</h3>
        <p className="mt-3 text-sm text-gray-500">결과는 한 번만 정해집니다.</p>
      </div>
    </section>
  );
}

function DailyResult({
  snapshot,
  fortune,
  hitCards,
  allCards,
  showAllCards,
  onToggleAllCards,
  onCardClick,
}: {
  snapshot: DailyLuckSnapshot;
  fortune: DailyLuckFortune;
  hitCards: Card[];
  allCards: Card[];
  showAllCards: boolean;
  onToggleAllCards: () => void;
  onCardClick: (card: Card) => void;
}) {
  const luckyPoint = fortune.luckyNote.replace(/^행운 포인트\s*·\s*/, '');
  const referenceValueKrw = snapshot.mine?.result.observedValueKrw ?? 0;
  const referenceValueLabel = formatReferenceValue(referenceValueKrw);
  const representativeCard = hitCards.find(
    (card) => card.card_num === snapshot.mine?.result.topCardNum,
  ) ?? hitCards[0] ?? null;
  const gradeCharacters = Array.from(fortune.gradeHanja);
  return (
    <>
      <section
        className="relative -mx-4 mt-8 overflow-hidden border-y border-[#75453b] bg-[#211613] bg-cover bg-center px-4 py-9 sm:-mx-6 sm:px-6 sm:py-12"
        style={{ backgroundImage: "url('/daily-fortune-backdrop.webp')" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/10"
        />
        <div className="relative mx-auto max-w-4xl px-1 py-3 sm:px-10 sm:py-6">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/daily-fortune-backdrop.webp')",
              backgroundSize: 'auto 162%',
            }}
          />
          <article
            className="relative mx-auto w-full max-w-2xl p-2 text-[#211d19] [clip-path:polygon(5px_0,38%_2px,72%_0,calc(100%_-_6px)_2px,100%_7px,calc(100%_-_2px)_48%,100%_calc(100%_-_7px),calc(100%_-_8px)_100%,62%_calc(100%_-_2px),31%_100%,6px_calc(100%_-_1px),0_calc(100%_-_8px),2px_53%,0_6px)] [filter:drop-shadow(0_22px_32px_rgba(28,8,6,0.5))]"
            style={{
              backgroundColor: '#f4ead8',
              backgroundImage: [
                'radial-gradient(circle at 18% 8%, rgba(255,255,255,0.72), transparent 30%)',
                'repeating-linear-gradient(0deg, rgba(112,72,40,0.026) 0, rgba(112,72,40,0.026) 1px, transparent 1px, transparent 4px)',
                'repeating-linear-gradient(90deg, rgba(112,72,40,0.018) 0, rgba(112,72,40,0.018) 1px, transparent 1px, transparent 7px)',
                'linear-gradient(135deg, #f8f1e5 0%, #f1e5d2 100%)',
              ].join(', '),
            }}
          >
          <ScrollRail side="left" />
          <ScrollRail side="right" />
          <div className="relative mx-1 border-y border-[#a12b32]/45 px-5 py-6 sm:px-8 sm:py-8">
            <span
              aria-hidden="true"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center border border-[#9f2430]/70 font-serif text-base font-bold text-[#9f2430] sm:h-10 sm:w-10 sm:text-lg"
            >
              運
            </span>
            <p className="pr-10 text-center text-lg font-black tracking-tight text-[#9f2430] sm:text-xl">
              오늘의 운세
            </p>

            <div className="mt-5 grid grid-cols-[90px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-8">
              <div className="relative flex min-h-40 items-center justify-center overflow-hidden border border-[#9f2430]/25 bg-[#eee3d1] px-2 py-4 sm:min-h-48">
                {representativeCard && CARD_IMAGES_ENABLED && representativeCard.image_url ? (
                  <button
                    type="button"
                    onClick={() => onCardClick(representativeCard)}
                    className="absolute inset-0 transition hover:brightness-110"
                    title={representativeCard.name_ko ?? representativeCard.card_num}
                    aria-label={`${representativeCard.name_ko ?? representativeCard.card_num} 상세 보기`}
                  >
                    <Image
                      src={resolveCardImageUrl(representativeCard.image_url, { size: 256 })}
                      alt=""
                      fill
                      sizes="128px"
                      unoptimized
                      className="scale-105 object-cover opacity-[0.28] saturate-50 contrast-90"
                    />
                  </button>
                ) : null}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#eee3d1]/55" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-1 border border-[#9f2430]/15" />
                <p className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center font-serif font-black text-[#9f2430] drop-shadow-[0_1px_0_rgba(255,248,235,0.9)] ${gradeCharacters.length >= 3 ? 'gap-0.5 text-[2.55rem] sm:gap-1 sm:text-[3.35rem]' : 'gap-1 text-[3.1rem] sm:gap-2 sm:text-7xl'}`}>
                  {gradeCharacters.map((character, characterIndex) => (
                    <span key={`${character}-${characterIndex}`} className="block leading-none">
                      {character}
                    </span>
                  ))}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-[#9f2430] sm:text-base">{fortune.gradeLabel}</p>
                <h3 className="mt-2 text-lg font-black leading-snug sm:text-2xl">{fortune.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#514a42] sm:text-base">{fortune.message}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-[#9f2430]/25 pt-4">
              <div className="flex items-end justify-between gap-4 border-b border-[#9f2430]/15 pb-4">
                <div>
                  <p className="text-xs font-black text-[#9f2430] sm:text-sm">이번 한 박스 참고가</p>
                  <p className="mt-1 text-xs text-[#756d63] sm:text-sm">카드 가격 합계</p>
                </div>
                <p className="shrink-0 text-2xl font-black text-[#9f2430] sm:text-3xl">
                  {referenceValueLabel}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 items-start gap-6 pb-1">
                <div>
                  <p className="text-xs font-black text-[#9f2430] sm:text-sm">행운 포인트</p>
                  <p className="mt-1 text-sm font-bold text-[#514a42] sm:text-base">{luckyPoint}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[#9f2430] sm:text-sm">오늘 내 순위</p>
                  <p className="mt-1 text-2xl font-black sm:text-3xl">
                    {snapshot.mine?.rank.toLocaleString()}위
                  </p>
                  <p className="text-xs text-[#756d63] sm:text-sm">
                    {snapshot.participantCount.toLocaleString()}명 참여
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 pb-1 pt-2 text-[10px] font-bold tracking-wide text-[#8a6f60] sm:px-6 sm:text-xs">
            <span>{snapshot.dayKst.replaceAll('-', '.')}</span>
            <span className="ml-auto">PokéSim KR · pokesim.kr</span>
          </div>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-xl font-black">오늘 뽑은 AR 이상 카드</h3>
          <span className="text-xs font-bold text-gray-500">{hitCards.length}장</span>
        </div>
        {hitCards.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
            {hitCards.map((card, index) => (
              <DailyCard
                key={`${card.card_num}-${index}`}
                card={card}
                onClick={() => onCardClick(card)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 border-l-2 border-gray-700 pl-4 text-sm text-gray-500">
            이번 박스에서는 AR 이상 카드가 나오지 않았어요.
          </p>
        )}
      </section>

      <section className="mt-8 border-t border-gray-800 pt-6">
        <button
          type="button"
          onClick={onToggleAllCards}
          className="flex w-full items-center justify-between gap-4 py-2 text-left"
        >
          <span>
            <span className="block text-sm font-black text-white">오늘의 한 박스 전체 결과</span>
            <span className="mt-1 block text-xs text-gray-500">{allCards.length}장</span>
          </span>
          <span className="text-xs font-bold text-gray-400">{showAllCards ? '접기 ↑' : '전체 보기 ↓'}</span>
        </button>
        {showAllCards ? (
          <div className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
            {allCards.map((card, index) => (
              <DailyCard
                key={`${card.card_num}-${index}`}
                card={card}
                onClick={() => onCardClick(card)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}

function ScrollRail({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 z-20 w-2.5 drop-shadow-[0_0_3px_rgba(38,19,12,0.45)] sm:w-3 ${side === 'left' ? 'left-0.5' : 'right-0.5'}`}
      style={{
        backgroundImage: "url('/daily-fortune-backdrop.webp')",
        backgroundPosition: side === 'left' ? '2% center' : '98% center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto 162%',
      }}
    />
  );
}

function DailyLeaderboard({
  snapshot,
  sets,
  accessToken,
  onCardClick,
}: {
  snapshot: DailyLuckSnapshot;
  sets: SetMeta[];
  accessToken: string | null;
  onCardClick: (card: Card) => void;
}) {
  const latestArchiveDay = shiftDate(snapshot.dayKst, -1);
  const hasArchivedDays = latestArchiveDay >= DAILY_LUCK_ROTATION_EPOCH;
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDay, setSelectedDay] = useState(
    hasArchivedDays ? latestArchiveDay : DAILY_LUCK_ROTATION_EPOCH,
  );
  const [historySnapshot, setHistorySnapshot] = useState<DailyLuckSnapshot | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequestId = useRef(0);
  const todaySet = sets.find((candidate) => candidate.code === snapshot.setCode) ?? null;
  const historySet = historySnapshot
    ? sets.find((candidate) => candidate.code === historySnapshot.setCode) ?? null
    : null;
  const mineOutsideTopTen = snapshot.mine && snapshot.mine.rank > 10 ? snapshot.mine : null;

  const loadRankingDay = useCallback(async (day: string) => {
    if (day < DAILY_LUCK_ROTATION_EPOCH || day > latestArchiveDay) return;
    setSelectedDay(day);
    setHistoryError(null);
    const requestId = historyRequestId.current + 1;
    historyRequestId.current = requestId;
    setHistorySnapshot(null);
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/daily-luck?day=${encodeURIComponent(day)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(parseApiError(body));
      if (historyRequestId.current === requestId) {
        setHistorySnapshot(body as DailyLuckSnapshot);
      }
    } catch (loadError) {
      if (historyRequestId.current === requestId) {
        setHistoryError(loadError instanceof Error ? loadError.message : parseApiError(null));
      }
    } finally {
      if (historyRequestId.current === requestId) setHistoryLoading(false);
    }
  }, [accessToken, latestArchiveDay]);

  const canGoPrevious = selectedDay > DAILY_LUCK_ROTATION_EPOCH;
  const canGoNext = selectedDay < latestArchiveDay;
  const toggleHistory = () => {
    const nextShown = !showHistory;
    setShowHistory(nextShown);
    if (nextShown && hasArchivedDays && !historySnapshot && !historyLoading) {
      void loadRankingDay(selectedDay);
    }
  };

  return (
    <section className="mt-12 border-t border-gray-800 pt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black tracking-widest text-yellow-300">TODAY TOP 10</p>
          <h3 className="mt-1 text-xl font-black">오늘의 랭킹</h3>
        </div>
        <span className="text-xs font-bold text-gray-500">
          {snapshot.participantCount.toLocaleString()}명 참여 · 실시간 순위
        </span>
      </div>

      {snapshot.leaderboard.length > 0 ? (
        <ol className="mt-5 divide-y divide-gray-800 border-y border-gray-800">
          {snapshot.leaderboard.map((entry) => (
            <LeaderboardRow
              key={`${entry.rank}-${entry.name}`}
              rank={entry.rank}
              name={entry.name}
              isMine={entry.isMine}
              cards={cardsFromNums(todaySet, entry.hitCardNums).slice(0, 3)}
              observedValueKrw={entry.observedValueKrw}
              onCardClick={onCardClick}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-5 py-8 text-center text-sm text-gray-500">아직 오늘의 첫 도전자가 없어요.</p>
      )}

      {mineOutsideTopTen ? (
        <div className="mt-3 border-l-2 border-cyan-300/60 bg-cyan-300/[0.04] px-4 py-3 text-sm">
          <span className="font-black text-cyan-200">내 순위 {mineOutsideTopTen.rank}위</span>
          <span className="ml-3 text-gray-400">{mineOutsideTopTen.publicName}</span>
        </div>
      ) : null}

      <div className="mt-7 border-t border-gray-800 pt-3">
        <button
          type="button"
          onClick={toggleHistory}
          className="flex w-full items-center justify-between py-3 text-left text-sm font-bold text-gray-400 transition hover:text-white"
          aria-expanded={showHistory}
        >
          <span>지난 날짜 랭킹 보기</span>
          <span aria-hidden="true">{showHistory ? '접기 −' : '펼치기 +'}</span>
        </button>

        {showHistory ? (
          <div className="pb-2 pt-3">
            {hasArchivedDays ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadRankingDay(shiftDate(selectedDay, -1))}
                    disabled={!canGoPrevious || historyLoading}
                    className="border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    이전
                  </button>
                  <input
                    type="date"
                    min={DAILY_LUCK_ROTATION_EPOCH}
                    max={latestArchiveDay}
                    value={selectedDay}
                    onChange={(event) => void loadRankingDay(event.target.value)}
                    className="border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm font-bold text-gray-200 [color-scheme:dark]"
                    aria-label="지난 랭킹 날짜"
                  />
                  <button
                    type="button"
                    onClick={() => void loadRankingDay(shiftDate(selectedDay, 1))}
                    disabled={!canGoNext || historyLoading}
                    className="border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    다음
                  </button>
                  <span className="ml-auto text-xs font-bold text-gray-500">
                    {historySnapshot
                      ? `${historySnapshot.participantCount.toLocaleString()}명 참여 · 최종 순위`
                      : null}
                  </span>
                </div>

                {historyError ? (
                  <p className="mt-4 border-l-2 border-red-300 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                    {historyError}
                  </p>
                ) : historyLoading ? (
                  <p className="mt-5 py-8 text-center text-sm font-bold text-gray-500">지난 랭킹을 불러오는 중...</p>
                ) : historySnapshot && historySnapshot.leaderboard.length > 0 ? (
                  <ol className="mt-5 divide-y divide-gray-800 border-y border-gray-800">
                    {historySnapshot.leaderboard.map((entry) => (
                      <LeaderboardRow
                        key={`${historySnapshot.dayKst}-${entry.rank}-${entry.name}`}
                        rank={entry.rank}
                        name={entry.name}
                        isMine={entry.isMine}
                        cards={cardsFromNums(historySet, entry.hitCardNums).slice(0, 3)}
                        observedValueKrw={entry.observedValueKrw}
                        onCardClick={onCardClick}
                      />
                    ))}
                  </ol>
                ) : (
                  <p className="mt-5 py-8 text-center text-sm text-gray-500">이 날짜에는 참여 기록이 없어요.</p>
                )}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-gray-500">내일부터 지난 랭킹을 확인할 수 있어요.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LeaderboardRow({
  rank,
  name,
  isMine,
  cards,
  observedValueKrw,
  onCardClick,
}: {
  rank: number;
  name: string;
  isMine: boolean;
  cards: Card[];
  observedValueKrw: number;
  onCardClick: (card: Card) => void;
}) {
  const podiumColor = rank === 1
    ? 'text-yellow-300'
    : rank === 2
      ? 'text-slate-300'
      : 'text-amber-600';
  return (
    <li className={`flex min-h-16 items-center gap-3 px-2 py-2.5 sm:px-3 ${isMine ? 'bg-cyan-300/[0.05]' : ''}`}>
      {rank <= 3 ? (
        <span className={`flex w-8 shrink-0 flex-col items-center text-[11px] font-black leading-none ${podiumColor}`} aria-label={`${rank}위`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-1 h-4 w-4">
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
            <path d="M5 20h14" />
          </svg>
          {rank}
        </span>
      ) : (
        <span className="w-8 shrink-0 text-center text-sm font-black text-gray-500">{rank}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-200">
        {name}{isMine ? <span className="ml-2 text-[10px] text-cyan-300">ME</span> : null}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex gap-1">
          {cards.map((card, index) => (
            <button
              key={`${card.card_num}-${index}`}
              type="button"
              onClick={() => onCardClick(card)}
              className="relative h-11 w-8 overflow-hidden rounded-sm bg-gray-800 transition hover:brightness-110"
              title={card.name_ko ?? card.card_num}
            >
              {CARD_IMAGES_ENABLED && card.image_url ? (
                <Image
                  src={resolveCardImageUrl(card.image_url, { size: 256 })}
                  alt=""
                  fill
                  sizes="32px"
                  unoptimized
                  className="object-cover"
                />
              ) : null}
            </button>
          ))}
        </div>
        <span className="w-[4.75rem] text-right text-[10px] font-black text-yellow-200 sm:w-24 sm:text-xs">
          {formatReferenceValue(observedValueKrw)}
        </span>
      </div>
    </li>
  );
}

function DailyCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const [errored, setErrored] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const showImage = CARD_IMAGES_ENABLED && Boolean(card.image_url) && !errored;
  const glow = card.rarity ? CARD_GLOW[card.rarity] ?? '' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-image-frame relative block aspect-[5/7] w-full overflow-hidden rounded-md bg-gray-800 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 ${glow}`}
      title={card.name_ko ?? card.card_num}
    >
      {showImage ? (
        <Image
          src={resolveCardImageUrl(card.image_url, useOriginal ? {} : { size: 256 })}
          alt={card.name_ko ?? card.card_num}
          fill
          sizes="(max-width: 640px) 20vw, 10vw"
          unoptimized
          draggable={false}
          className="object-cover"
          onError={() => {
            if (!useOriginal && CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED) {
              setUseOriginal(true);
            } else {
              setErrored(true);
            }
          }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[9px] text-gray-400">
          {card.name_ko ?? card.card_num}
        </span>
      )}
      {card.rarity ? (
        <span className={`absolute bottom-0.5 right-0.5 rounded px-1 py-px text-[8px] font-bold ${RARITY_BADGE[card.rarity] ?? 'bg-gray-700 text-white'}`}>
          {rarityLabel(card.rarity, card)}
        </span>
      ) : null}
    </button>
  );
}
