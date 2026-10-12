"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookDoc, listBooks, listUsers } from "@/lib/books";
import { placeholderColor } from "./ShelfView";
import CoverImage from "./CoverImage";
import { normaliseCountry } from "@/lib/countries";
import { authorTokens, plausiblePages } from "@/lib/bookMatch";
import { Columns, Donut, RankedBars } from "./WrappedCharts";

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

// Words that say nothing about the books themselves: grammar, filler,
// hedges and generic reading vocabulary. Contractions ("didn't") are
// dropped separately, so they don't need listing here.
const STOPWORDS = new Set(
  `the a an and or but if then than that this these those it its was were is are be been being i me my we our you your he she his her they them their of in on at to for with about from as by not no so very just really quite also too do did does done have has had having would could should will can may might must there here what which who whom whose when where why how all any both each few more most other some such only own same once because while during before after above below again further out over under up down off into onto upon within without through throughout until since around across along toward towards book books read reading reread felt feel feels feeling like liked one two three first second last next bit lot lots got get gets getting much many still though although even ever never always often sometimes way ways things thing make makes made making think thought found find end ending story stories writing written write writes author authors characters character plot little good great enjoyed loved love sort kind kinds maybe sure actually mostly normally usually probably definitely certainly especially totally completely slightly somewhat fairly highly truly simply basically pretty rather enough almost already well okay fine overall part parts time times day days year years long short wanted want wants know knew known seem seems seemed keep kept need needs look looked looking said says tell told going goes went come came comes coming take took give gave works work worked working picked pick recommend recommended recommendation idea point reason ones side half whole else another every everything something nothing anything someone everyone people person mind stuff left right turn turned turns follow followed hear heard draw drawn different interesting enjoy`.split(/\s+/)
);

// Plural/singular pairs that should count as one word in the cloud.
const IRREGULAR: Record<string, string> = {
  women: "woman", men: "man", lives: "life", children: "child",
  wives: "wife", people: "person",
};

function wordCloud(
  books: BookDoc[],
  exclude: Set<string>
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of books) {
    const text = (b.notes || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // é → e
      .replace(/[\u2018\u2019\u02bc`]/g, "'"); // curly apostrophes
    // Count each word once per review, so the cloud shows what recurs
    // across books rather than one review repeating itself.
    const seen = new Set<string>();
    for (const raw of text.split(/[^a-z']+/)) {
      let w = raw.replace(/^'+|'+$/g, "").replace(/'s$/, "");
      if (w.includes("'")) continue; // contraction: didn't, I'm, wasn't…
      w = IRREGULAR[w] ?? w;
      if (w.length < 4 || STOPWORDS.has(w) || exclude.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  // Fold simple plurals into their singular when both appear ("parts" → "part").
  for (const [w, c] of [...counts]) {
    const base = w.endsWith("s") ? w.slice(0, -1) : null;
    if (base && counts.has(base)) {
      counts.set(base, (counts.get(base) ?? 0) + c);
      counts.delete(w);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 36)
    .map(([word, count]) => ({ word, count }));
}

// --- Books read by more than one person -----------------------------------

function normTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019'`]/g, "")
    .split(/[:(]/)[0] // drop subtitles
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same book? Title must match; authors must share a name when both are known
 *  (so "The Strangers" by Vermette ≠ "Strangers" by Burden, but
 *  "Liza Ridzen" = "Lisa Ridzen"). */
function sameBook(a: BookDoc, b: BookDoc): boolean {
  if (!a.title || normTitle(a.title) !== normTitle(b.title)) return false;
  if (!a.authors.trim() || !b.authors.trim()) return true;
  const ta = authorTokens(a.authors);
  return [...authorTokens(b.authors)].some((t) => ta.has(t));
}

interface SharedRead {
  mine: BookDoc;
  theirs: BookDoc;
}

interface OtherReader {
  name: string;
  shared: SharedRead[];
}

/** Cover image, or a colored placeholder block with the title. */
function Cover({
  book,
  className,
  style,
}: {
  book: BookDoc;
  className?: string;
  style?: React.CSSProperties;
}) {
  return book.cover ? (
    <CoverImage src={book.cover} alt={book.title} className={`object-cover ${className ?? ""}`} style={style} />
  ) : (
    <div
      className={`flex items-center justify-center p-1 ${className ?? ""}`}
      style={{ ...style, background: placeholderColor(book.title) }}
    >
      <span className="text-white/90 text-[9px] font-medium text-center leading-tight line-clamp-4">
        {book.title}
      </span>
    </div>
  );
}

/** Fanned stack of covers, like books pulled off the shelf. */
function CoverFan({ books }: { books: BookDoc[] }) {
  const shown = books.slice(0, 5);
  const mid = (shown.length - 1) / 2;
  return (
    <div className="flex justify-center items-end mb-6" style={{ height: 130 }}>
      {shown.map((b, i) => (
        <Cover
          key={b.id}
          book={b}
          className="w-[72px] h-[108px] rounded shadow-xl shrink-0 wrapped-pop"
          style={{
            transform: `rotate(${(i - mid) * 9}deg) translateY(${Math.abs(i - mid) * 10}px)`,
            marginLeft: i === 0 ? 0 : -22,
            zIndex: i,
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Featured big-cover row for top/bottom books. */
function FeaturedBooks({ books }: { books: BookDoc[] }) {
  return (
    <div className="flex justify-center gap-4 flex-wrap">
      {books.map((b, i) => (
        <div key={b.id} className="w-28 wrapped-pop" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="relative">
            <Cover book={b} className="w-28 h-[168px] rounded-lg shadow-2xl" />
            <span className="absolute -top-2 -right-2 bg-amber-300 text-gray-900 text-sm font-extrabold rounded-full w-9 h-9 flex items-center justify-center shadow-lg">
              {b.myRating}
            </span>
          </div>
          <p className="text-white text-xs font-semibold mt-2 line-clamp-2 leading-tight">{b.title}</p>
          <p className="text-white/50 text-[11px] truncate">{b.authors}</p>
        </div>
      ))}
    </div>
  );
}

export default function Wrapped({ userId, userName, onClose }: WrappedProps) {
  const year = new Date().getFullYear();
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  const [favAdded, setFavAdded] = useState<BookDoc[]>([]);
  const [others, setOthers] = useState<OtherReader[]>([]);
  const [readerNames, setReaderNames] = useState<Set<string>>(new Set());
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    listBooks(userId)
      .then((all) => {
        setBooks(
          all.filter(
            (b) =>
              !b.favoriteOnly &&
              b.dateAdded &&
              b.dateAdded.toDate().getFullYear() === year
          )
        );
        setFavAdded(
          all.filter(
            (b) =>
              b.favorite &&
              b.favoritedAt &&
              b.favoritedAt.toDate().getFullYear() === year
          )
        );
      })
      .catch(() => setBooks([]));
  }, [userId, year]);

  // Everyone else's shelves, to find books two readers have in common. A
  // pair counts if either reader logged it this year. Failures here only
  // hide the slide.
  useEffect(() => {
    let cancelled = false;
    const inYear = (b: BookDoc) =>
      !!b.dateAdded && b.dateAdded.toDate().getFullYear() === year;
    (async () => {
      const users = await listUsers();
      if (cancelled) return;
      setReaderNames(
        new Set(users.flatMap((u) => u.name.toLowerCase().split(/\s+/)))
      );
      const shelves = await Promise.all(
        users.map(async (u) => ({ user: u, books: await listBooks(u.id) }))
      );
      if (cancelled) return;
      const mine = (shelves.find((s) => s.user.id === userId)?.books ?? []).filter(
        (b) => !b.favoriteOnly
      );
      const result: OtherReader[] = [];
      for (const { user, books: theirBooks } of shelves) {
        if (user.id === userId) continue;
        const shared: SharedRead[] = [];
        for (const m of mine) {
          const t = theirBooks.find((tb) => !tb.favoriteOnly && sameBook(m, tb));
          if (t && (inYear(m) || inYear(t))) shared.push({ mine: m, theirs: t });
        }
        if (shared.length) result.push({ name: user.name, shared });
      }
      result.sort((a, b) => b.shared.length - a.shared.length);
      setOthers(result);
    })().catch((err) => console.warn("[wrapped] shared reads unavailable:", err));
    return () => {
      cancelled = true;
    };
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
    // Implausible stored counts (sample editions, "10 pages") are ignored.
    const pages = books.reduce((s, b) => s + (parseInt(plausiblePages(b.pages), 10) || 0), 0);
    const maxRating = Math.max(...rated.map((b) => b.myRating));
    const minRating = Math.min(...rated.map((b) => b.myRating));
    const monthCounts = new Array(12).fill(0);
    for (const b of books) monthCounts[b.dateAdded!.toDate().getMonth()]++;
    const bestMonth = monthCounts.indexOf(Math.max(...monthCounts));
    const byRating = [...rated].sort((a, b) => b.myRating - a.myRating);

    // Ratings 1–10 histogram
    const ratingCounts = new Array(10).fill(0);
    for (const b of rated) if (b.myRating >= 1 && b.myRating <= 10) ratingCounts[b.myRating - 1]++;

    // Author countries (free text, normalised)
    const countryMap = new Map<string, { name: string; flag: string; count: number }>();
    let countryKnown = 0;
    for (const b of books) {
      const c = normaliseCountry(b.authorCountry || "");
      if (!c) continue;
      countryKnown++;
      const e = countryMap.get(c.name) ?? { ...c, count: 0 };
      e.count++;
      countryMap.set(c.name, e);
    }
    const countries = [...countryMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    // Author gender, in a fixed order so colours follow the category
    const genderOrder = ["Female", "Male"];
    const genderMap = new Map<string, number>();
    for (const b of books) {
      const g = (b.authorGender || "").trim();
      if (g) genderMap.set(g, (genderMap.get(g) ?? 0) + 1);
    }
    const genders = [...genderMap.entries()]
      .sort((a, b) => {
        const ia = genderOrder.indexOf(a[0]), ib = genderOrder.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
      })
      .map(([label, count]) => ({ label, count }));
    const genderKnown = genders.reduce((n, g) => n + g.count, 0);

    // Extremes: publication year and length
    const withYear = books
      .map((b) => ({ b, y: parseInt(b.year, 10) }))
      .filter((x) => x.y >= 1000)
      .sort((a, z) => a.y - z.y);
    const withPages = books
      .map((b) => ({ b, p: parseInt(plausiblePages(b.pages), 10) }))
      .filter((x) => x.p > 0)
      .sort((a, z) => a.p - z.p);

    // Where they heard about books
    const sourceMap = new Map<string, number>();
    for (const b of books) {
      const src = (b.source || "").trim();
      if (src) sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }
    const sources = [...sourceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));
    const sourceKnown = sources.reduce((n, x) => n + x.count, 0);
    // Headline scout: the biggest named source ("Other" is not a scout)
    const topScout = sources.find((x) => x.label.toLowerCase() !== "other") ?? null;

    // You vs the world (public averages are on a 5-point scale)
    const vsWorld = rated
      .filter((b) => b.avgRating != null)
      .map((b) => ({ b, diff: b.myRating - (b.avgRating as number) * 2 }))
      .sort((a, z) => z.diff - a.diff);
    const gem = vsWorld[0] && vsWorld[0].diff >= 1.5 ? vsWorld[0] : null;
    const hotTake = vsWorld.length && vsWorld[vsWorld.length - 1].diff <= -1.5
      ? vsWorld[vsWorld.length - 1]
      : null;

    const languages = [...new Set(
      books.map((b) => (b.originalLanguage || "").trim()).filter(Boolean)
    )];

    return {
      monthCounts,
      ratingCounts,
      fiction: books.filter((b) => b.type === "Fiction").length,
      nonFiction: books.filter((b) => b.type === "Non-Fiction").length,
      countries,
      countryKnown,
      genders,
      genderKnown,
      oldest: withYear[0] ?? null,
      newest: withYear[withYear.length - 1] ?? null,
      yearKnown: withYear.length,
      shortest: withPages[0] ?? null,
      longest: withPages[withPages.length - 1] ?? null,
      sources,
      sourceKnown,
      topScout,
      gem,
      hotTake,
      languages,
      count: books.length,
      pages,
      avgMine,
      avgPublic,
      highest: rated.filter((b) => b.myRating === maxRating).slice(0, 3),
      lowest: rated.filter((b) => b.myRating === minRating).slice(0, 3),
      top3: byRating.slice(0, 3),
      top5: byRating.slice(0, 5),
      cried: books.filter((b) => b.cried).length,
      translated: books.filter((b) => b.language && b.language !== "English").length,
      bestMonth,
      bestMonthCount: monthCounts[bestMonth],
      // Leave out readers' and authors' names: they're not what the books were about.
      cloud: wordCloud(
        books,
        new Set([...readerNames, ...books.flatMap((b) => [...authorTokens(b.authors)])])
      ),
      pagesKnown: books.filter((b) => plausiblePages(b.pages)).length,
      withCovers: books.filter((b) => b.cover),
    };
  }, [books, readerNames]);

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
          fiction: stats.fiction,
          nonFiction: stats.nonFiction,
          authorCountries: stats.countries.map((c) => c.name).join(", "),
          topBookSource: stats.topScout?.label ?? "",
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
    const fanBooks = stats.withCovers.length >= 3 ? stats.withCovers : books ?? [];
    // The chart runs to the current month (all twelve when Wrapped opens in December).
    const monthsSoFar = Math.max(stats.bestMonth + 1, new Date().getMonth() + 1);
    const withPagesEnough = stats.pagesKnown >= 3;
    const s: React.ReactNode[] = [];

    s.push(
      <div key="intro">
        <CoverFan books={fanBooks.slice(0, 5)} />
        <h2 className="text-3xl font-extrabold text-white mb-3">{userName}&apos;s {year} in Books</h2>
        <p className="text-white/70">A year of stories, one recap →</p>
      </div>
    );

    s.push(
      <div key="count">
        <div className="grid grid-cols-6 gap-1.5 max-w-xs mx-auto mb-6">
          {fanBooks.slice(0, 18).map((b, i) => (
            <Cover
              key={b.id}
              book={b}
              className="w-full rounded-sm shadow wrapped-pop"
              style={{ aspectRatio: "2/3", animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
        <p className="text-white/70 mb-1">This year you read</p>
        <p className="text-6xl font-extrabold text-amber-300 mb-1">{stats.count}</p>
        <p className="text-xl text-white font-semibold mb-3">book{stats.count === 1 ? "" : "s"}</p>
        {stats.pages > 0 && (
          <p className="text-white/70 text-sm">
            {stats.pagesKnown < stats.count ? "At least " : ""}
            <span className="text-white font-bold">{stats.pages.toLocaleString()}</span>
            {" pages — about "}
            <span className="text-white font-bold">{Math.max(1, Math.round(stats.pages / 300))}</span>
            {" paperbacks' worth."}
          </p>
        )}
        {stats.fiction + stats.nonFiction > 0 && (
          <p className="text-white/70 text-sm mt-2">
            <span className="text-white font-bold">{stats.fiction}</span> fiction ·{" "}
            <span className="text-white font-bold">{stats.nonFiction}</span> non-fiction
          </p>
        )}
      </div>
    );

    s.push(
      <div key="month">
        <CoverFan
          books={(books ?? [])
            .filter((b) => b.dateAdded && b.dateAdded.toDate().getMonth() === stats.bestMonth)
            .slice(0, 5)}
        />
        <p className="text-white/70 mb-2">Your biggest reading month was</p>
        <p className="text-5xl font-extrabold text-amber-300 mb-3">{MONTHS[stats.bestMonth]}</p>
        <p className="text-white/70">
          <span className="text-white font-bold">{stats.bestMonthCount}</span> book{stats.bestMonthCount === 1 ? "" : "s"} finished. What a month.
        </p>
        <div className="mt-6 w-full">
          <Columns
            values={stats.monthCounts.slice(0, monthsSoFar)}
            labels={MONTHS.slice(0, monthsSoFar).map((m) => m[0])}
            highlight={new Set([stats.bestMonth])}
            unit=" books"
          />
        </div>
      </div>
    );

    s.push(
      <div key="rating">
        <p className="text-white/70 mb-2">Your average rating</p>
        <p className="text-6xl font-extrabold text-amber-300 mb-4 wrapped-pop">★ {stats.avgMine.toFixed(1)}</p>
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
        <div className="mt-6 w-full">
          <p className="text-white/50 text-xs mb-1">How you scored the year</p>
          <Columns
            values={stats.ratingCounts}
            labels={stats.ratingCounts.map((_, i) => String(i + 1))}
            highlight={new Set([stats.ratingCounts.indexOf(Math.max(...stats.ratingCounts))])}
            unit=" books"
          />
        </div>
      </div>
    );

    s.push(
      <div key="top" className="w-full">
        <p className="text-white/70 mb-5">👑 Your top-rated {stats.highest.length === 1 ? "book" : "books"}</p>
        <FeaturedBooks books={stats.highest} />
      </div>
    );

    s.push(
      <div key="low" className="w-full">
        <p className="text-white/70 mb-5">🥀 ...and the {stats.lowest.length === 1 ? "one" : "ones"} that let you down</p>
        <FeaturedBooks books={stats.lowest} />
      </div>
    );

    if (stats.gem || stats.hotTake) {
      s.push(
        <div key="vsworld" className="w-full flex flex-col gap-6">
          {[
            stats.gem && { tag: "💎 Hidden gem", pick: stats.gem, line: "You loved it more than the world did" },
            stats.hotTake && { tag: "🌶️ Hot take", pick: stats.hotTake, line: "The world liked it a lot more than you did" },
          ]
            .filter((x): x is { tag: string; pick: { b: BookDoc; diff: number }; line: string } => !!x)
            .map(({ tag, pick, line }, i) => (
              <div key={tag} className="flex items-center gap-4 text-left max-w-sm mx-auto wrapped-pop" style={{ animationDelay: `${i * 150}ms` }}>
                <Cover book={pick.b} className="w-16 h-24 rounded shadow-xl shrink-0" />
                <div>
                  <p className="text-amber-300 font-bold text-sm">{tag}</p>
                  <p className="text-white font-semibold leading-tight">{pick.b.title}</p>
                  <p className="text-white/60 text-xs mb-1">{line}</p>
                  <p className="text-white text-sm">
                    You <span className="font-extrabold">{pick.b.myRating}</span>
                    <span className="text-white/50"> · </span>
                    World <span className="font-extrabold">{((pick.b.avgRating as number) * 2).toFixed(1)}</span>
                  </p>
                </div>
              </div>
            ))}
        </div>
      );
    }

    for (const other of others) {
      const rows = [...other.shared].sort(
        (a, b) =>
          Math.abs(b.mine.myRating - b.theirs.myRating) -
          Math.abs(a.mine.myRating - a.theirs.myRating)
      );
      const rated = rows.filter((r) => r.mine.myRating > 0 && r.theirs.myRating > 0);
      const agreed = rated.filter(
        (r) => Math.abs(r.mine.myRating - r.theirs.myRating) <= 1
      ).length;
      const split = rated[0] && Math.abs(rated[0].mine.myRating - rated[0].theirs.myRating) >= 2
        ? rated[0]
        : null;
      s.push(
        <div key={`shared-${other.name}`} className="w-full">
          <p className="text-white/70 mb-1">👯 Books you and {other.name} both read</p>
          <p className="text-white/50 text-xs mb-5">
            {rated.length > 0 &&
              `You agreed within a point on ${agreed} of ${rated.length}.`}
          </p>
          <div className="flex flex-col gap-2.5 max-w-sm mx-auto text-left">
            {rows.slice(0, 5).map(({ mine, theirs }, i) => (
              <div
                key={mine.id}
                className="flex items-center gap-3 bg-white/10 rounded-xl p-2 wrapped-pop"
                style={{ animationDelay: `${i * 110}ms` }}
              >
                <Cover book={mine.cover ? mine : theirs} className="w-10 h-[60px] rounded shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{mine.title}</p>
                  <p className="text-white/50 text-[11px] truncate">{mine.authors || theirs.authors}</p>
                </div>
                <div className="flex gap-1.5 shrink-0 text-center">
                  <div className="w-12">
                    <p className="text-amber-300 font-extrabold text-lg leading-none">
                      {mine.myRating || "–"}
                    </p>
                    <p className="text-white/50 text-[10px] mt-1">You</p>
                  </div>
                  <div className="w-12">
                    <p className="text-sky-300 font-extrabold text-lg leading-none">
                      {theirs.myRating || "–"}
                    </p>
                    <p className="text-white/50 text-[10px] mt-1 truncate">{other.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {rows.length > 5 && (
            <p className="text-white/50 text-xs mt-3">…and {rows.length - 5} more</p>
          )}
          {split && (
            <p className="text-white/70 text-sm mt-5">
              Biggest split: <span className="text-white font-semibold">{split.mine.title}</span>
              {split.mine.myRating > split.theirs.myRating
                ? ` — you liked it more.`
                : ` — ${other.name} liked it more.`}
            </p>
          )}
        </div>
      );
    }

    // Only show a data slide when enough books carry the field to say something.
    const noteOf = (known: number, what: string) => (
      <p className="text-white/40 text-[11px] mt-5">
        Based on the {known} of {stats.count} books where you noted {what}.
      </p>
    );

    if (stats.countryKnown >= 4 && stats.countries.length >= 2) {
      const shown = stats.countries.slice(0, 8);
      s.push(
        <div key="countries" className="w-full">
          <p className="text-white/70 mb-2">🗺️ Your passport stamps</p>
          <p className="text-white text-2xl font-extrabold mb-5">
            Authors from <span className="text-amber-300">{stats.countries.length}</span> countries
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto text-left">
            {shown.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 wrapped-pop" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="text-2xl leading-none">{c.flag}</span>
                <span className="text-white text-sm truncate flex-1">{c.name}</span>
                <span className="text-white font-bold text-sm tabular-nums">{c.count}</span>
              </div>
            ))}
          </div>
          {stats.countries.length > shown.length && (
            <p className="text-white/50 text-xs mt-2">…and {stats.countries.length - shown.length} more</p>
          )}
          {noteOf(stats.countryKnown, "the author's country")}
        </div>
      );
    }

    if (stats.genderKnown >= 5 && stats.genders.length >= 2) {
      s.push(
        <div key="gender" className="w-full">
          <p className="text-white/70 mb-5">✍️ Who wrote your year</p>
          <Donut slices={stats.genders} />
          {noteOf(stats.genderKnown, "the author's gender")}
        </div>
      );
    }

    {
      type Tile = { label: string; value: string; b: BookDoc };
      const tiles: Tile[] = [];
      if (stats.yearKnown >= 3 && stats.oldest && stats.newest && stats.oldest.y !== stats.newest.y) {
        tiles.push({ label: "Oldest", value: String(stats.oldest.y), b: stats.oldest.b });
        tiles.push({ label: "Newest", value: String(stats.newest.y), b: stats.newest.b });
      }
      if (withPagesEnough && stats.shortest && stats.longest && stats.shortest.p !== stats.longest.p) {
        tiles.push({ label: "Longest", value: `${stats.longest.p} pp`, b: stats.longest.b });
        tiles.push({ label: "Shortest", value: `${stats.shortest.p} pp`, b: stats.shortest.b });
      }
      if (tiles.length) {
        const span = stats.oldest && stats.newest ? stats.newest.y - stats.oldest.y : 0;
        s.push(
          <div key="extremes" className="w-full">
            <p className="text-white/70 mb-5">📏 Your year at the extremes</p>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {tiles.map((t, i) => (
                <div key={t.label} className="bg-white/10 rounded-xl p-3 flex gap-3 items-center text-left wrapped-pop" style={{ animationDelay: `${i * 110}ms` }}>
                  <Cover book={t.b} className="w-10 h-[60px] rounded shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white/50 text-[11px] uppercase tracking-wide">{t.label}</p>
                    <p className="text-amber-300 font-extrabold text-lg leading-tight">{t.value}</p>
                    <p className="text-white text-xs truncate">{t.b.title}</p>
                  </div>
                </div>
              ))}
            </div>
            {span >= 20 && tiles.some((t) => t.label === "Oldest") && (
              <p className="text-white/70 text-sm mt-5">
                Your books span <span className="text-white font-bold">{span}</span> years of writing.
              </p>
            )}
          </div>
        );
      }
    }

    if (stats.sourceKnown >= 5 && stats.sources.length >= 2 && stats.topScout) {
      s.push(
        <div key="scout" className="w-full">
          <p className="text-white/70 mb-2">🔎 Your top book scout</p>
          <p className="text-5xl font-extrabold text-amber-300 mb-1">{stats.topScout.label}</p>
          <p className="text-white/70 mb-6">
            found <span className="text-white font-bold">{stats.topScout.count}</span> of your books this year
          </p>
          <RankedBars rows={stats.sources.slice(0, 5)} />
        </div>
      );
    }

    if (stats.cloud.length >= 8) {
      s.push(
        <div key="cloud">
          <p className="text-white/70 mb-5">The words of your reviews</p>
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 max-w-md mx-auto">
            {stats.cloud.map(({ word, count }, i) => (
              <span
                key={word}
                className="wrapped-pop"
                style={{
                  fontSize: `${Math.round(13 + (count / maxCloud) * 26)}px`,
                  color: CLOUD_COLORS[i % CLOUD_COLORS.length],
                  fontWeight: count / maxCloud > 0.5 ? 800 : 600,
                  animationDelay: `${i * 30}ms`,
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
            <div className="wrapped-pop">
              <p className="text-5xl mb-2">💧</p>
              <p className="text-white">
                <span className="font-extrabold text-amber-300 text-2xl">{stats.cried}</span> book{stats.cried === 1 ? "" : "s"} made you cry this year.
              </p>
            </div>
          )}
          {stats.translated > 0 && (
            <div className="wrapped-pop" style={{ animationDelay: "150ms" }}>
              <p className="text-5xl mb-2">🌍</p>
              <p className="text-white">
                You crossed languages <span className="font-extrabold text-amber-300 text-2xl">{stats.translated}</span> time{stats.translated === 1 ? "" : "s"} with works in translation.
              </p>
              {stats.languages.length > 0 && (
                <p className="text-white/70 text-sm mt-2">
                  Translated from {stats.languages.slice(0, -1).join(", ")}
                  {stats.languages.length > 1 ? " and " : ""}
                  {stats.languages[stats.languages.length - 1]}.
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    if (favAdded.length > 0) {
      s.push(
        <div key="favadded" className="w-full">
          <CoverFan books={favAdded} />
          <p className="text-white/70 mb-2">This year you crowned</p>
          <p className="text-5xl font-extrabold text-amber-300 mb-2">{favAdded.length}</p>
          <p className="text-white font-semibold">
            new all-time favourite{favAdded.length === 1 ? "" : "s"} ⭐
          </p>
        </div>
      );
    }

    if (facts && facts.length > 0) {
      s.push(
        <div key="facts" className="w-full">
          <p className="text-white/70 mb-4">✨ Some things you might not know...</p>
          <div className="flex flex-col gap-3 text-left">
            {facts.slice(0, 4).map((f, i) => (
              <div key={i} className="bg-white/10 rounded-xl px-4 py-3 wrapped-pop" style={{ animationDelay: `${i * 120}ms` }}>
                <p className="text-white font-bold text-sm mb-1">{f.emoji} {f.title}</p>
                <p className="text-white/80 text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Final slide: a Spotify-style summary card, sized for a phone screenshot.
    {
      const topWords = stats.cloud.slice(0, 5).map((w) => w.word);
      const second =
        topWords.length >= 3
          ? { title: "Top Words", items: topWords }
          : stats.countries.length >= 2
            ? { title: "Top Countries", items: stats.countries.slice(0, 5).map((c) => `${c.flag} ${c.name}`) }
            : null;
      const tiles: { label: string; value: string }[] = [
        { label: "Books read", value: String(stats.count) },
        { label: "Average rating", value: `★ ${stats.avgMine.toFixed(1)}` },
        stats.pages > 0
          ? { label: stats.pagesKnown < stats.count ? "Pages (at least)" : "Pages", value: stats.pages.toLocaleString() }
          : { label: "Fiction", value: `${stats.fiction}/${stats.count}` },
        stats.topScout
          ? { label: "Top book scout", value: stats.topScout.label }
          : { label: "Biggest month", value: MONTHS[stats.bestMonth] },
      ];
      s.push(
        <div key="summary" className="w-full flex flex-col items-center">
          <div
            className="relative w-full max-w-[330px] rounded-2xl overflow-hidden text-left shadow-2xl ring-1 ring-white/10"
            style={{ background: "linear-gradient(170deg, #0f0e24 0%, #1c1748 55%, #2a1650 100%)" }}
          >
            {/* colour band behind the covers */}
            <div
              className="absolute inset-x-0 top-0 h-40"
              style={{ background: "linear-gradient(135deg, #fcd34d 0%, #f472b6 50%, #7c3aed 100%)", opacity: 0.85 }}
            />
            <div className="relative px-5 pt-4 pb-5">
              <p className="text-[11px] font-extrabold tracking-[0.2em] uppercase text-gray-900/80">
                {userName}&apos;s {year} in Books
              </p>
              <div className="mt-3 mb-1">
                <CoverFan books={stats.top3} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-1">
                <div className={second ? "" : "col-span-2"}>
                  <p className="text-white/50 text-[11px] font-bold uppercase tracking-wide mb-1.5">Top Books</p>
                  <ol className="flex flex-col gap-1">
                    {stats.top5.map((b, i) => (
                      <li key={b.id} className="flex gap-1.5 text-white text-[13px] leading-tight">
                        <span className="text-amber-300 font-extrabold w-3 shrink-0">{i + 1}</span>
                        <span className="truncate font-semibold">{b.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {second && (
                  <div>
                    <p className="text-white/50 text-[11px] font-bold uppercase tracking-wide mb-1.5">{second.title}</p>
                    <ol className="flex flex-col gap-1">
                      {second.items.map((w, i) => (
                        <li key={w} className="flex gap-1.5 text-white text-[13px] leading-tight">
                          <span className="text-amber-300 font-extrabold w-3 shrink-0">{i + 1}</span>
                          <span className="truncate font-semibold capitalize">{w}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5">
                {tiles.map((t) => (
                  <div key={t.label}>
                    <p className="text-white/50 text-[11px] font-bold uppercase tracking-wide">{t.label}</p>
                    <p className="text-white text-xl font-extrabold leading-tight truncate">{t.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/10">
                <p className="text-white/70 text-xs">Here&apos;s to {year + 1} 📚</p>
                <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase">BookShelf Wrapped</p>
              </div>
            </div>
          </div>
          <p className="text-white/50 text-xs mt-4">📸 Screenshot this card to share it</p>
        </div>
      );
    }

    return s;
  }, [stats, facts, favAdded, others, userName, year, books]);

  const next = useCallback(() => {
    setSlide((s) => (s < slides.length - 1 ? s + 1 : s));
  }, [slides.length]);
  const prev = useCallback(() => setSlide((s) => Math.max(0, s - 1)), []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  const loading = books === null;
  const empty = books !== null && (!stats || stats.count === 0);

  return (
    <div className="fixed inset-0 z-[100] bg-[#191932]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <style>{`
        @keyframes wrappedIn { from { opacity: 0; transform: translateY(18px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes wrappedPop { from { opacity: 0; transform: translateY(14px) scale(.7); } to { opacity: 1; } }
        .wrapped-slide { animation: wrappedIn .45s ease both; }
        .wrapped-pop { animation: wrappedPop .5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes wrappedGrow { from { transform: scaleX(0); } to { transform: none; } }
        .wrapped-grow { transform-origin: left; animation: wrappedGrow .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .wrapped-slide, .wrapped-pop, .wrapped-grow { animation: none; } }
      `}</style>
      <div
        className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden select-none"
        style={{ background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-4 text-white/60 hover:text-white text-2xl z-20"
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
          <div className="relative w-full min-h-96 px-8 py-14 flex flex-col items-center justify-center text-center">
            <div key={slide} className="wrapped-slide w-full flex flex-col items-center">
              {slides[slide]}
            </div>
            {/* Tap zones: left third goes back, right two-thirds go forward */}
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
              tabIndex={-1}
            />
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer"
              tabIndex={-1}
            />
          </div>
        )}

        {!loading && !empty && (
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5 z-20">
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
