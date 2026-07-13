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
  onOpenInbox?: () => void;
  inboxCount?: number;
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
  onOpenInbox,
  inboxCount = 0,
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
        className="relative block rounded-lg hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title={name}
      >
        {inboxCount > 0 && (
          <span className="absolute -top-1 -right-1 z-10 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow">
            {inboxCount}
          </span>
        )}
        {/* Dark circle with a gold ring and the user's initial in gold serif */}
        <span
          className="w-11 h-11 rounded-full flex items-center justify-center text-lg"
          style={{
            background: "#2c2822",
            color: "#D9A84E",
            fontFamily: "Georgia, 'Times New Roman', serif",
            boxShadow: "0 0 0 2px #D9A84E, 0 2px 6px rgba(0,0,0,0.55)",
          }}
        >
          {initial}
        </span>
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
          {onOpenInbox && (
            <button
              className={ITEM_CLASSES}
              onClick={() => {
                onOpenInbox();
                setOpen(false);
              }}
            >
              🔔 Recommended to you
              {inboxCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {inboxCount}
                </span>
              )}
            </button>
          )}
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
