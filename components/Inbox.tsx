"use client";

import { useEffect, useState } from "react";
import { AppUser, BookFields, addBook } from "@/lib/books";
import {
  Recommendation,
  listenInbox,
  setRecommendationStatus,
} from "@/lib/recommendations";
import RatingForm from "./RatingForm";
import { placeholderColor } from "./ShelfView";

function Thumb({ cover, title }: { cover: string | null; title: string }) {
  return cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cover} alt="" className="w-10 h-[60px] object-cover rounded border border-gray-200 shrink-0" />
  ) : (
    <div
      className="w-10 h-[60px] rounded shrink-0 flex items-center justify-center p-0.5"
      style={{ background: placeholderColor(title) }}
    >
      <span className="text-white/90 text-[7px] text-center leading-tight line-clamp-3">{title}</span>
    </div>
  );
}

export default function Inbox({
  user,
  open,
  onClose,
  onUnreadCount,
  onAccepted,
}: {
  user: AppUser;
  open: boolean;
  onClose: () => void;
  onUnreadCount?: (n: number) => void;
  onAccepted?: () => void;
}) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [accepting, setAccepting] = useState<Recommendation | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => listenInbox(user.id, setRecs), [user.id]);
  useEffect(() => onUnreadCount?.(recs.length), [recs.length, onUnreadCount]);

  async function dismiss(rec: Recommendation) {
    setRecs((prev) => prev.filter((r) => r.id !== rec.id));
    try {
      await setRecommendationStatus(rec.id, "dismissed");
    } catch (err) {
      console.error("[recs] dismiss failed:", err);
    }
  }

  async function submitAccept(values: BookFields) {
    if (!accepting || saving) return;
    setSaving(true);
    try {
      await addBook(user.id, values);
      await setRecommendationStatus(accepting.id, "accepted");
      setRecs((prev) => prev.filter((r) => r.id !== accepting.id));
      setAccepting(null);
      onAccepted?.();
    } catch (err) {
      console.error("[recs] accept failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[92]" onClick={onClose}>
          <div
            className="absolute right-2 top-16 sm:right-6 w-[92vw] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[70vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-gray-800 mb-3">Recommended to you</p>
            {recs.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No recommendations right now.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {recs.map((rec) => (
                  <div key={rec.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                    <Thumb cover={rec.bookCoverUrl} title={rec.bookTitle} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 leading-tight">{rec.bookTitle}</p>
                      <p className="text-xs text-gray-500 truncate">{rec.bookAuthor}</p>
                      <p className="text-xs text-gray-400 mt-0.5">from {rec.fromUserName}</p>
                      {rec.note && (
                        <p className="text-xs text-gray-600 italic mt-1 bg-gray-50 rounded px-2 py-1">
                          &ldquo;{rec.note}&rdquo;
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setAccepting(rec)}
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-3 py-1"
                        >
                          Add to my list
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(rec)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 rounded-full px-3 py-1"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {accepting && (
        <div
          className="fixed inset-0 z-[96] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAccepting(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-800">
                Rate <span className="text-blue-600">{accepting.bookTitle}</span>
              </p>
              <button onClick={() => setAccepting(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Recommended by {accepting.fromUserName}. Fill in your rating to add it to your list.
            </p>
            <RatingForm
              onSubmit={submitAccept}
              isLoading={saving}
              submitLabel="Add to my list"
              initialValues={{
                title: accepting.bookTitle,
                authors: accepting.bookAuthor,
                cover: accepting.bookCoverUrl ?? "",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
