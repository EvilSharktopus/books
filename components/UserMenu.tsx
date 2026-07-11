"use client";

import { useEffect, useRef, useState } from "react";

interface UserMenuProps {
  name: string;
  light: boolean;
  view: "entry" | "list";
  editMode: boolean;
  bgColor: string | null;
  onToggleEditMode: () => void;
  onApplyBgColor: (color: string | null) => void;
  onSwitchView: (view: "entry" | "list") => void;
  onChangeUser: () => void;
  onOpenWrapped?: () => void;
}

const ITEM_CLASSES =
  "w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2";

export default function UserMenu({
  name,
  light,
  view,
  editMode,
  bgColor,
  onToggleEditMode,
  onApplyBgColor,
  onSwitchView,
  onChangeUser,
  onOpenWrapped,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Menu for ${name}`}
        aria-expanded={open}
        className="block rounded-lg hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title={name}
      >
        {/* Ornate dark book with gold trim, the user's initial on the cover */}
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          {/* page block peeking out bottom/right */}
          <rect x="7" y="5" width="33" height="36" rx="3" fill="#e8dcc0" />
          <rect x="7" y="5" width="33" height="36" rx="3" fill="none" stroke="#b08d3c" strokeWidth="0.8" />
          {/* cover */}
          <rect x="4" y="2" width="34" height="36" rx="3.5" fill="#232946" />
          {/* spine bands */}
          <rect x="4" y="2" width="5" height="36" rx="2.5" fill="#1b2038" />
          <rect x="4" y="7" width="5" height="1.4" fill="#c9a24b" opacity="0.9" />
          <rect x="4" y="31.5" width="5" height="1.4" fill="#c9a24b" opacity="0.9" />
          {/* gold decorative frame */}
          <rect x="11" y="6" width="23" height="28" rx="2.5" fill="none" stroke="#c9a24b" strokeWidth="1.1" />
          <rect x="13" y="8" width="19" height="24" rx="1.8" fill="none" stroke="#c9a24b" strokeWidth="0.5" opacity="0.7" strokeDasharray="1.5 1.6" />
          {/* corner stars */}
          <text x="14.5" y="11.5" fontSize="4.5" fill="#c9a24b">✦</text>
          <text x="26.5" y="11.5" fontSize="4.5" fill="#c9a24b">✦</text>
          <text x="14.5" y="31.5" fontSize="4.5" fill="#c9a24b">✦</text>
          <text x="26.5" y="31.5" fontSize="4.5" fill="#c9a24b">✦</text>
          {/* initial */}
          <text
            x="22.5"
            y="26"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fontFamily="Georgia, 'Times New Roman', serif"
            fill="#e9d8a6"
          >
            {initial}
          </text>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 overflow-hidden">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {name}
          </div>
          <button
            className={ITEM_CLASSES}
            onClick={() => {
              onToggleEditMode();
              if (view !== "entry") onSwitchView("entry");
              setOpen(false);
            }}
          >
            ✏️ {editMode ? "Done editing form" : "Edit form"}
          </button>
          <label className={`${ITEM_CLASSES} cursor-pointer relative`}>
            <span
              className={`inline-block w-4 h-4 rounded-full border ${
                light ? "border-black/20" : "border-black/20"
              }`}
              style={{
                background: bgColor ?? "linear-gradient(135deg, #312e81, #1e1b4b)",
              }}
            />
            Change background
            <input
              type="color"
              value={bgColor ?? "#312e81"}
              onChange={(e) => onApplyBgColor(e.target.value)}
              className="absolute w-0 h-0 opacity-0"
              aria-label="Customize background color"
            />
          </label>
          {bgColor && (
            <button
              className={`${ITEM_CLASSES} pl-10 text-xs text-gray-500`}
              onClick={() => onApplyBgColor(null)}
            >
              Reset background
            </button>
          )}
          <button
            className={ITEM_CLASSES}
            onClick={() => {
              onSwitchView(view === "entry" ? "list" : "entry");
              setOpen(false);
            }}
          >
            {view === "entry" ? "📊 See data" : "➕ New entry"}
          </button>
          <button
            className={ITEM_CLASSES}
            onClick={() => {
              onChangeUser();
              setOpen(false);
            }}
          >
            👤 Change user
          </button>
          {onOpenWrapped && (
            <button
              className={ITEM_CLASSES}
              onClick={() => {
                onOpenWrapped();
                setOpen(false);
              }}
            >
              🎁 Your year in books
            </button>
          )}
        </div>
      )}
    </div>
  );
}
