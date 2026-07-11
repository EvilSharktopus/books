"use client";

import { useEffect, useMemo, useState } from "react";
import { BookDoc, listBooks } from "@/lib/books";

interface WrappedProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

interface Fact {
  emoji: string;
  title: string;
  text: string;
}

// Validated against the dark slide surface (dataviz six-checks)
const CLOUD_COLORS = ["#3987e5", "#199e70", "#c98500", "#9085e9", "#d55181"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STOPWORDS = new Set(
  `the a an and or but if then than that this these those it its was were is are be been being i me my we our you your he she his her they them their of in on at to for with about from as by not no so very just really quite also too do did does done have has had having would could should will can may might must there here what which who whom whose when where why how all any both each few more most other some such only own same then once because while during before after above below again further out over under up down off it's i'm don't didn't wasn't isn't aren't couldn't wouldn't shouldn't book books read reading felt feel like liked one two first bit lot got get much many still though even ever never way things thing make made think thought found end story writing written author characters character plot little good great really enjoyed loved love`.split(/\s+/)
);

function wordCloud(books: BookDoc[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of books) {
    for (const raw of (b.notes || "").toLowerCase().split(/[^a-z']+/)) {
      const w = raw.replace(/^'+|'+$/g, "");
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 36)
    .map(([word, count]) => ({ word, count }));
}

function BookRow({ book }: { book: BookDoc }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 text-left">
      {book.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover} alt="" className="w-9 h-14 object-cover rounded shrink-0" />
      ) : (
        <div className="w-9 h-14 rounded bg-white/10 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">{book.title}</p>
        <p className="text-white/60 text-xs truncate">{book.authors}</p>
      </div>
      <span className="ml-auto text-amber-300 font-bold whitespace-nowrap">★ {book.myRating}/10</span>
    </div>
  );
}

export default function Wrapped({ userId, userName, onClose }: WrappedProps) {
  const year = new Date().getFullYear();
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    listBooks(userId)
      .then((all) =>
        setBooks(all.filter((b) => b.dateAdded && b.dateAdded.toDate().getFullYear() === year))
      )
      .catch(() => setBooks([]));
  }, [userId, year]);

  const stats = useMemo(() => {
    if (!books || books.length === 0) return null;
    const rated = books.filter((b) => b.myRating > 0);
    const avgMine = rated.length
      ? rated.reduce((s, b) => s + b.myRating, 0) / rated.length
      : 0;
    const withPublic = books.filter((b) => b.avgRating != null);
    const avgPublic = withPublic.length
      ? withPublic.reduce((s, b) => s + (b.avgRating as number) * 2, 0) / withPublic.length
      : null;
    const pages = books.reduce((s, b) => s + (parseInt(b.pages, 10) || 0), 0);
    const maxRating = Math.max(...rated.map((b) => b.myRating));
    const minRating = Math.min(...rated.map((b) => b.myRating));
    const monthCounts = new Array(12).fill(0);
    for (const b of books) monthCounts[b.dateAdded!.toDate().getMonth()]++;
    const bestMonth = monthCounts.indexOf(Math.max(...monthCounts));
    return {
      count: books.length,
      pages,
      avgMine,
      avgPublic,
      highest: rated.filter((b) => b.myRating === maxRating).slice(0, 3),
      lowest: rated.filter((b) => b.myRating === minRating).slice(0, 3),
      cried: books.filter((b) => b.cried).length,
      translated: books.filter((b) => b.language && b.language !== "English").length,
      bestMonth,
      bestMonthCount: monthCounts[bestMonth],
      cloud: wordCloud(books),
    };
  }, [books]);

  // Fetch Claude-generated fun facts once stats are ready
  useEffect(() => {
    if (!books || !stats) return;
    fetch("/api/wrapped", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName,
        year,
        books: books.map((b) => ({ title: b.title, authors: b.authors, myRating: b.myRating })),
        stats: {
          booksRead: stats.count,
          pagesRead: stats.pages,
          averageRating: stats.avgMine.toFixed(1),
          criedCount: stats.cried,
          translatedCount: stats.translated,
          busiestMonth: MONTHS[stats.bestMonth],
        },
      }),
    })
      .then((r) => r.json())
      .then((d) => setFacts(Array.isArray(d.facts) ? d.facts : []))
      .catch(() => setFacts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books == null]);

  const slides = useMemo(() => {
    if (!stats) return [];
    const maxCloud = stats.cloud[0]?.count ?? 1;
    const s: React.ReactNode[] = [];

    s.push(
      <div key="intro">
        <p className="text-6xl mb-4">📚</p>
        <h2 className="text-3xl font-extrabold text-white mb-3">{userName}&apos;s {year} in Books</h2>
        <p className="text-white/70">A year of stories, one recap. Tap to begin →</p>
      </div>
    );

    s.push(
      <div key="count">
        <p className="text-white/70 mb-2">This year you read</p>
        <p className="text-7xl font-extrabold text-amber-300 mb-2">{stats.count}</p>
        <p className="text-2xl text-white font-semibold mb-6">book{stats.count === 1 ? "" : "s"}</p>
        {stats.pages > 0 && (
          <p className="text-white/70">
            That&apos;s <span className="text-white font-bold">{stats.pages.toLocaleString()}</span> pages —
            about <span className="text-white font-bold">{Math.round(stats.pages / 300)}</span> paperbacks&apos; worth of paper.
          </p>
        )}
      </div>
    );

    s.push(
      <div key="month">
        <p className="text-white/70 mb-2">Your biggest reading month was</p>
        <p className="text-5xl font-extrabold text-amber-300 mb-3">{MONTHS[stats.bestMonth]}</p>
        <p className="text-white/70">
          <span className="text-white font-bold">{stats.bestMonthCount}</span> book{stats.bestMonthCount === 1 ? "" : "s"} finished. What a month.
        </p>
      </div>
    );

    s.push(
      <div key="rating">
        <p className="text-white/70 mb-2">Your average rating</p>
        <p className="text-6xl font-extrabold text-amber-300 mb-4">★ {stats.avgMine.toFixed(1)}</p>
        {stats.avgPublic != null && (
          <p className="text-white/70">
            The rest of the world gave the same books{" "}
            <span className="text-white font-bold">{stats.avgPublic.toFixed(1)}/10</span> —{" "}
            {stats.avgMine > stats.avgPublic
              ? "you're feeling generous 💛"
              : stats.avgMine < stats.avgPublic
                ? "you're a tough critic 🧐"
                : "perfectly in sync 🤝"}
          </p>
        )}
      </div>
    );

    s.push(
      <div key="top" className="w-full">
        <p className="text-white/70 mb-4">👑 Your top-rated {stats.highest.length === 1 ? "book" : "books"}</p>
        <div className="flex flex-col gap-2 w-full">
          {stats.highest.map((b) => <BookRow key={b.id} book={b} />)}
        </div>
      </div>
    );

    s.push(
      <div key="low" className="w-full">
        <p className="text-white/70 mb-4">🥀 ...and the {stats.lowest.length === 1 ? "one" : "ones"} that let you down</p>
        <div className="flex flex-col gap-2 w-full">
          {stats.lowest.map((b) => <BookRow key={b.id} book={b} />)}
        </div>
      </div>
    );

    if (stats.cloud.length >= 8) {
      s.push(
        <div key="cloud">
          <p className="text-white/70 mb-5">The words of your reviews</p>
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 max-w-md mx-auto">
            {stats.cloud.map(({ word, count }, i) => (
              <span
                key={word}
                style={{
                  fontSize: `${Math.round(13 + (count / maxCloud) * 26)}px`,
                  color: CLOUD_COLORS[i % CLOUD_COLORS.length],
                  fontWeight: count / maxCloud > 0.5 ? 800 : 600,
                }}
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (stats.cried > 0 || stats.translated > 0) {
      s.push(
        <div key="extras" className="flex flex-col gap-6">
          {stats.cried > 0 && (
            <div>
              <p className="text-5xl mb-2">💧</p>
              <p className="text-white">
                <span className="font-extrabold text-amber-300 text-2xl">{stats.cried}</span> book{stats.cried === 1 ? "" : "s"} made you cry this year.
              </p>
            </div>
          )}
          {stats.translated > 0 && (
            <div>
              <p className="text-5xl mb-2">🌍</p>
              <p className="text-white">
                You crossed languages <span className="font-extrabold text-amber-300 text-2xl">{stats.translated}</span> time{stats.translated === 1 ? "" : "s"} with works in translation.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (facts && facts.length > 0) {
      s.push(
        <div key="facts" className="w-full">
          <p className="text-white/70 mb-4">✨ Some things you might not know...</p>
          <div className="flex flex-col gap-3 text-left">
            {facts.slice(0, 4).map((f, i) => (
              <div key={i} className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-white font-bold text-sm mb-1">{f.emoji} {f.title}</p>
                <p className="text-white/80 text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    s.push(
      <div key="outro">
        <p className="text-6xl mb-4">🎉</p>
        <h2 className="text-2xl font-extrabold text-white mb-3">Here&apos;s to {year + 1}</h2>
        <p className="text-white/70">May your to-read pile never shrink. Happy reading, {userName}!</p>
      </div>
    );

    return s;
  }, [stats, facts, userName, year]);

  const loading = books === null;
  const empty = books !== null && (!stats || stats.count === 0);

  return (
    <div className="fixed inset-0 z-[100] bg-[#191932]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden select-none"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-4 text-white/60 hover:text-white text-2xl z-10"
        >
          ✕
        </button>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-white/70">Wrapping up your year…</div>
        ) : empty ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-5xl">📖</p>
            <p className="text-white">No books logged in {year} yet — rate a few and come back!</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (slide < slides.length - 1 ? setSlide(slide + 1) : onClose())}
            className="w-full min-h-96 px-8 py-14 flex flex-col items-center justify-center text-center cursor-pointer"
          >
            {slides[slide]}
          </button>
        )}

        {!loading && !empty && (
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-amber-300" : "w-1.5 bg-white/30"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
