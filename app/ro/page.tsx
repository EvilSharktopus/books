"use client";

import React, { useState, useEffect } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  KidsBookDoc,
  KidsBookFields,
  RamonaUser,
  addKidsBook,
  deleteKidsBook,
  getOrCreateRamonaUser,
  listKidsBooks,
  saveRamonaPalette,
} from "@/lib/kidsBooks";
import RamonaRatingForm from "@/components/RamonaRatingForm";
import RamonaShelf from "@/components/RamonaShelf";

export default function RamonaPage() {
  const [user, setUser] = useState<RamonaUser | null>(null);
  const [books, setBooks] = useState<KidsBookDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"shelf" | "add-book">("shelf");
  const [activePalette, setActivePalette] = useState("classic");
  const [submitting, setSubmitting] = useState(false);

  // Author Celebration State
  const [celebratedAuthor, setCelebratedAuthor] = useState<string | null>(null);

  // 1. Load or Create Ramona user & fetch settings
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    getOrCreateRamonaUser()
      .then((ramonaUser) => {
        setUser(ramonaUser);
        if (ramonaUser.ramonaPalette) {
          setActivePalette(ramonaUser.ramonaPalette);
        }
        return listKidsBooks(ramonaUser.id);
      })
      .then((booksList) => {
        if (booksList) {
          setBooks(booksList);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load Ramona's zone:", err);
        setLoading(false);
      });
  }, []);

  // 2. Author Tier promotion monitoring
  useEffect(() => {
    if (!user || books.length === 0) return;

    // Count loved books per author
    const lovedCount: { [author: string]: number } = {};
    books.forEach((b) => {
      if (b.rating === "loved" && b.author?.trim()) {
        const auth = b.author.trim();
        lovedCount[auth] = (lovedCount[auth] || 0) + 1;
      }
    });

    // Find all authors who qualify for Favorite tier (2+ loved books)
    const favoriteAuthors = Object.entries(lovedCount)
      .filter(([_, count]) => count >= 2)
      .map(([author]) => author);

    if (favoriteAuthors.length === 0) return;

    // Read celebrated authors from local storage
    const storageKey = `bookRatings.ramonaCelebratedAuthors.${user.id}`;
    let celebratedList: string[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) celebratedList = JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse celebrated list", e);
    }

    // Find if there is any new favorite author that has not been celebrated yet
    const newFavorite = favoriteAuthors.find((author) => !celebratedList.includes(author));

    if (newFavorite) {
      // Trigger the celebratory modal!
      setCelebratedAuthor(newFavorite);
      // Mark as celebrated immediately
      const nextCelebrated = [...celebratedList, newFavorite];
      localStorage.setItem(storageKey, JSON.stringify(nextCelebrated));
    }
  }, [books, user]);

  const handlePaletteChange = async (palette: string) => {
    setActivePalette(palette);
    if (user) {
      try {
        await saveRamonaPalette(user.id, palette);
      } catch (err) {
        console.error("Failed to save palette preference:", err);
      }
    }
  };

  const handleAddBookSubmit = async (fields: KidsBookFields) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await addKidsBook(user.id, fields);
      // Refresh list
      const freshBooks = await listKidsBooks(user.id);
      setBooks(freshBooks);
      setActiveView("shelf");
    } catch (err) {
      console.error("Failed to add book:", err);
      alert("Oops! Failed to save your book. Try again!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!user) return;
    try {
      await deleteKidsBook(user.id, bookId);
      const freshBooks = await listKidsBooks(user.id);
      setBooks(freshBooks);
    } catch (err) {
      console.error("Failed to delete book:", err);
      alert("Failed to delete book entry.");
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50 p-6 text-center">
        <div className="border-4 border-gray-900 bg-white p-8 rounded shadow-lg max-w-md transform rotate-1">
          <span className="text-5xl">⚠️</span>
          <h2 className="font-sans font-bold text-gray-800 text-xl mt-4">Database Not Configured</h2>
          <p className="text-gray-600 text-sm mt-2">
            Please add your Firebase environment variables to <code>.env.local</code> to start using Ramona's Book Shelf.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50">
        <div className="comic-panel animate-pulse text-center p-8 border-4 border-gray-900 bg-white rounded shadow-lg transform -rotate-1">
          <span className="text-4xl animate-bounce block mb-2">💥</span>
          <h2 className="comic-header-font text-2xl text-gray-900">LOADING RAMONA'S SHELF...</h2>
        </div>
      </div>
    );
  }

  return (
    <main className={`ramona-body palette-${activePalette} min-h-screen pb-16`}>
      {activeView === "shelf" ? (
        <RamonaShelf
          userId={user?.id || ""}
          books={books}
          activePalette={activePalette}
          onChangePalette={handlePaletteChange}
          onAddBookClick={() => setActiveView("add-book")}
          onDeleteBook={handleDeleteBook}
        />
      ) : (
        <RamonaRatingForm
          onSubmit={handleAddBookSubmit}
          isLoading={submitting}
          existingBooks={books}
          onCancel={() => setActiveView("shelf")}
        />
      )}

      {/* FAVORITE AUTHOR CELEBRATION MODAL OVERLAY */}
      {celebratedAuthor && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-6 z-50 animate-fade-in">
          <div
            className="comic-panel border-4 border-yellow-400 bg-yellow-100 max-w-md w-full text-center p-8 flex flex-col items-center gap-6 relative shadow-2xl overflow-hidden"
            style={{
              backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.05) 15%, transparent 16%)",
              backgroundSize: "12px 12px",
              transform: "rotate(1deg)",
            }}
          >
            {/* Stars decoration */}
            <div className="absolute top-2 left-4 text-3xl animate-bounce">⭐</div>
            <div className="absolute top-6 right-8 text-2xl animate-pulse">✨</div>
            <div className="absolute bottom-4 left-6 text-3xl animate-pulse">🌟</div>
            <div className="absolute bottom-6 right-4 text-3xl animate-bounce">⭐</div>

            <div className="starburst starburst-gold text-2xl px-6 py-4 animate-pulse">
              LEVEL UP! 🏆
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="comic-header-font text-2xl md:text-3xl text-gray-900 leading-tight">
                NEW FAVORITE AUTHOR!
              </h2>
              <p className="comic-header-font text-3xl md:text-4xl text-rose-600 mt-2 filter drop-shadow">
                {celebratedAuthor}
              </p>
            </div>

            <div className="speech-bubble text-sm font-bold text-gray-800 bg-white">
              🎉 You've logged <span className="text-rose-500 font-extrabold">2 or more loved books</span> by {celebratedAuthor}! They are now on your Favorite Authors tier!
            </div>

            <button
              onClick={() => setCelebratedAuthor(null)}
              className="comic-btn-interactive px-8 py-3 bg-rose-500 hover:bg-rose-600 text-white text-lg transform active:scale-95"
            >
              💥 WOW! AWESOME! 💥
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
