"use client";

import { useEffect } from "react";

// The opening of Wrapped: a closed book with the title on its cover. The
// cover swings open, a few pages flip, and the first slide takes over.
// Tap anywhere to skip.

const DURATION_MS = 4400;
const PAGES = [0, 1, 2, 3];

export default function WrappedIntro({
  name,
  year,
  onDone,
}: {
  name: string;
  year: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label={`${name} Wrapped Books ${year}. Tap to skip the intro.`}
      className="relative w-full h-[30rem] flex items-center justify-center cursor-pointer overflow-hidden"
    >
      <style>{`
        .wi-scene { perspective: 1600px; animation: wiOut .45s ease-in 3.9s both; }
        .wi-book { position: relative; width: 9.5rem; height: 14rem; transform-style: preserve-3d;
          animation: wiRise .7s cubic-bezier(.34,1.4,.64,1) both, wiCentre 1s ease-in-out 1.3s both; }
        .wi-leaf { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; }
        .wi-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 3px 8px 8px 3px; }
        .wi-back { transform: rotateY(180deg); border-radius: 8px 3px 3px 8px; }
        .wi-cover { animation: wiFlip 1s cubic-bezier(.45,.05,.3,1) 1.3s both; z-index: 10; }
        .wi-page { animation: wiFlip .75s cubic-bezier(.45,.05,.3,1) both; }
        .wi-paper { background: linear-gradient(90deg, #e9e2d0 0%, #faf6ea 12%, #fdfaf1 100%); }
        .wi-paper-back { background: linear-gradient(270deg, #e9e2d0 0%, #faf6ea 12%, #fdfaf1 100%); }
        .wi-face.wi-paper, .wi-face.wi-paper-back { box-shadow: inset 0 0 0 1px #d8cfb8, 0 6px 14px #0004; }
        /* A turning page darkens as it lifts and casts a shadow on the page beneath */
        .wi-shade { position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, #0007, #0002 60%, #0000);
          opacity: 0; animation: wiShade .75s ease-in-out both; animation-delay: inherit; }
        @keyframes wiShade { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        .wi-lines { position: absolute; inset: 18% 14%; background: repeating-linear-gradient(#0000 0 9px, #c9c1ad 9px 10px); opacity: .7; }
        @keyframes wiRise { from { opacity: 0; transform: translateY(30px) scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes wiCentre { to { transform: translateX(50%); } }
        @keyframes wiFlip { to { transform: rotateY(-180deg); } }
        @keyframes wiOut { to { opacity: 0; transform: scale(1.5); } }
      `}</style>
      <div className="wi-scene">
        <div className="wi-book">
          {/* the page block the book rests on */}
          <div className="wi-face wi-paper shadow-2xl">
            <div className="wi-lines" />
          </div>
          {PAGES.map((i) => (
            <div
              key={i}
              className="wi-leaf wi-page"
              style={{ animationDelay: `${2.15 + i * 0.3}s`, zIndex: 9 - i }}
            >
              <div className="wi-face wi-paper" style={{ animationDelay: "inherit" }}>
                <div className="wi-lines" />
                <div className="wi-shade" />
              </div>
              <div className="wi-face wi-back wi-paper-back" style={{ animationDelay: "inherit" }}>
                <div className="wi-lines" />
                <div className="wi-shade" />
              </div>
            </div>
          ))}
          <div className="wi-leaf wi-cover">
            <div
              className="wi-face flex flex-col items-center justify-center text-center px-3 shadow-2xl"
              style={{
                background: "linear-gradient(150deg, #4c1d95 0%, #312e81 60%, #1e1b4b 100%)",
                boxShadow: "inset 0 0 0 3px #1e1b4b, inset 0 0 0 5px #fcd34d, inset 10px 0 14px -8px #0009",
              }}
            >
              <span className="text-2xl mb-2">📚</span>
              <span className="text-amber-300 font-extrabold text-2xl leading-tight break-words max-w-full">{name}</span>
              <span className="text-white font-bold text-sm tracking-[0.3em] uppercase mt-2">Wrapped</span>
              <span className="text-white/80 text-xs tracking-[0.2em] uppercase mt-1">Books {year}</span>
            </div>
            <div className="wi-face wi-back wi-paper-back" />
          </div>
        </div>
      </div>
      <span className="absolute bottom-2 inset-x-0 text-white/40 text-xs">Tap to skip</span>
    </button>
  );
}
