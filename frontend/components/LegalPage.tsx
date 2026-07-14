import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-800/80 px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4">
          <Link
            href="/"
            className="shrink-0 rounded px-2 py-1 text-xs font-bold text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            ← 메인
          </Link>
          <div>
            <p className="text-xs font-bold text-cyan-300">PokéSim KR</p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="border-b border-gray-800 pb-5 text-xs text-gray-500">
          시행일 및 최종 변경일: {updatedAt}
        </p>
        <article className="legal-content mt-8">{children}</article>
      </main>

      <footer className="border-t border-gray-900 px-5 py-6">
        <nav className="mx-auto flex w-full max-w-4xl flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
          <Link href="/" className="transition hover:text-gray-200">메인</Link>
          <Link href="/privacy" className="transition hover:text-gray-200">개인정보처리방침</Link>
          <Link href="/terms" className="transition hover:text-gray-200">이용약관</Link>
          <a href="mailto:pokesimkr@gmail.com" className="transition hover:text-gray-200">
            문의
          </a>
        </nav>
      </footer>
    </div>
  );
}
