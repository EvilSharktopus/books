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
        {/* Little book with the user's initial on the cover */}
        <svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="7" y="3" width="27" height="34" rx="3" fill="#4f46e5" />
          <rect x="7" y="3" width="6" height="34" rx="3" fill="#312e81" />
          <rect x="13" y="3" width="2" height="34" fill="#312e81" opacity="0.35" />
          <text
            x="23.5"
            y="25.5"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fontFamily="inherit"
            fill="#ffffff"
          >
            {initial}
          </text>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
