"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookDoc, listBooks, listUsers } from "@/lib/books";
import { placeholderColor } from "./ShelfView";
import CoverImage from "./CoverImage";
import { loadCoverImage } from "@/lib/coverUrl";

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

function authorTokens(authors: string): Set<string> {
  return new Set(
    authors
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 3)
  );
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

/** Draw and share a summary card image. */
async function shareCard(
  userName: string,
  year: number,
  count: number,
  avg: number,
  topBooks: BookDoc[]
) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, W * 0.4, H);
  grad.addColorStop(0, "#1e1b4b");
  grad.addColorStop(0.55, "#312e81");
  grad.addColorStop(1, "#4c1d95");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fcd34d";
  ctx.font = "bold 46px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(`📚 ${year} in Books`, W / 2, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText(userName, W / 2, 195);

  // Covers (drawn with CORS; fall back to colored blocks if blocked)
  const cw = 240, ch = 360, gap = 40;
  const startX = (W - (cw * 3 + gap * 2)) / 2;
  const coverY = 280;
  for (let i = 0; i < Math.min(3, topBooks.length); i++) {
    const b = topBooks[i];
    const x = startX + i * (cw + gap);
    let drawn = false;
    if (b.cover) {
      try {
        const img = await loadCoverImage(b.cover);
        ctx.drawImage(img, x, coverY, cw, ch);
        drawn = true;
      } catch {
        drawn = false;
      }
    }
    if (!drawn) {
      ctx.fillStyle = placeholderColor(b.title);
      ctx.fillRect(x, coverY, cw, ch);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 26px Georgia, serif";
      const words = b.title.split(" ");
      let line = "", ty = coverY + 80;
      for (const word of words) {
        if ((line + " " + word).trim().length > 14) {
          ctx.fillText(line.trim(), x + cw / 2, ty, cw - 24);
          line = word;
          ty += 36;
        } else line = `${line} ${word}`;
      }
      if (line.trim()) ctx.fillText(line.trim(), x + cw / 2, ty, cw - 24);
    }
    // rating badge
    ctx.fillStyle = "#fcd34d";
    ctx.beginPath();
    ctx.arc(x + cw - 14, coverY + 14, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1b4b";
    ctx.font = "bold 38px Georgia, serif";
    ctx.fillText(String(b.myRating), x + cw - 14, coverY + 28);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 30px Georgia, serif";
  ctx.fillText("Top rated this year", W / 2, coverY + ch + 64);

  // Stats
  const statY = 880;
  ctx.fillStyle = "#fcd34d";
  ctx.font = "bold 130px Georgia, serif";
  ctx.fillText(String(count), W / 2 - 220, statY + 120);
  ctx.fillText(avg.toFixed(1), W / 2 + 220, statY + 120);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText("books read", W / 2 - 220, statY + 180);
  ctx.fillText("average rating", W / 2 + 220, statY + 180);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "28px Georgia, serif";
  ctx.fillText("Book Ratings · Wrapped", W / 2, H - 60);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Could not render card");
  const file = new File([blob], `books-wrapped-${year}.png`, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${userName}'s ${year} in Books` });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `books-wrapped-${year}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function Wrapped({ userId, userName, onClose }: WrappedProps) {
  const year = new Date().getFullYear();
  const [books, setBooks] = useState<BookDoc[] | null>(null);
  const [favAdded, setFavAdded] = useState<BookDoc[]>([]);
  const [others, setOthers] = useState<OtherReader[]>([]);
  const [readerNames, setReaderNames] = useState<Set<string>>(new Set());
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [slide, setSlide] = useState(0);
  const [sharing, setSharing] = useState(false);

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
    const pages = books.reduce((s, b) => s + (parseInt(b.pages, 10) || 0), 0);
    const maxRating = Math.max(...rated.map((b) => b.myRating));
    const minRating = Math.min(...rated.map((b) => b.myRating));
    const monthCounts = new Array(12).fill(0);
    for (const b of books) monthCounts[b.dateAdded!.toDate().getMonth()]++;
    const bestMonth = monthCounts.indexOf(Math.max(...monthCounts));
    const byRating = [...rated].sort((a, b) => b.myRating - a.myRating);
    return {
      count: books.length,
      pages,
      avgMine,
      avgPublic,
      highest: rated.filter((b) => b.myRating === maxRating).slice(0, 3),
      lowest: rated.filter((b) => b.myRating === minRating).slice(0, 3),
      top3: byRating.slice(0, 3),
      cried: books.filter((b) => b.cried).length,
      translated: books.filter((b) => b.language && b.language !== "English").length,
      bestMonth,
      bestMonthCount: monthCounts[bestMonth],
      // Leave out readers' and authors' names: they're not what the books were about.
      cloud: wordCloud(
        books,
        new Set([...readerNames, ...books.flatMap((b) => [...authorTokens(b.authors)])])
      ),
      pagesKnown: books.filter((b) => parseInt(b.pages, 10) > 0).length,
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

    s.push(
      <div key="outro">
        <CoverFan books={stats.top3} />
        <h2 className="text-2xl font-extrabold text-white mb-2">Here&apos;s to {year + 1}</h2>
        <p className="text-white/70 mb-6">May your to-read pile never shrink, {userName}!</p>
        <button
          type="button"
          disabled={sharing}
          onClick={async (e) => {
            e.stopPropagation();
            setSharing(true);
            try {
              await shareCard(userName, year, stats.count, stats.avgMine, stats.top3);
            } catch {
              // user cancelled the share sheet, or rendering failed — no-op
            } finally {
              setSharing(false);
            }
          }}
          className="relative z-20 px-6 py-3 rounded-full bg-amber-300 text-gray-900 font-bold text-sm hover:bg-amber-200 disabled:opacity-60 shadow-lg"
        >
          {sharing ? "Making your card…" : "📤 Share your year"}
        </button>
      </div>
    );

    return s;
  }, [stats, facts, favAdded, others, userName, year, books, sharing]);

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
