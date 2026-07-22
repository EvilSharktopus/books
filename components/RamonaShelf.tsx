"use client";

import React, { useState, useMemo } from "react";
import { KidsBookDoc, saveRamonaPalette } from "@/lib/kidsBooks";
import { ART_STYLES_CONFIG } from "./RamonaRatingForm";

interface RamonaShelfProps {
  userId: string;
  books: KidsBookDoc[];
  activePalette: string;
  onChangePalette: (palette: string) => void;
  onAddBookClick: () => void;
  onDeleteBook: (bookId: string) => void;
}

const PALETTES = [
  { key: "classic", label: "Classic Comic", bg: "#fdf6e3", accent: "bg-rose-500" },
  { key: "ocean", label: "Ocean Breeze", bg: "#e0f2fe", accent: "bg-sky-500" },
  { key: "sunset", label: "Sunset Glow", bg: "#ffedd5", accent: "bg-orange-500" },
  { key: "jungle", label: "Jungle Adventure", bg: "#dcfce7", accent: "bg-green-500" },
];

export default function RamonaShelf({
  userId,
  books,
  activePalette,
  onChangePalette,
  onAddBookClick,
  onDeleteBook,
}: RamonaShelfProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Helper to map ratings to emoji
  const ratingEmoji = (r: string) => {
    switch (r) {
      case "loved":
        return "😍";
      case "liked":
        return "🙂";
      case "okay":
        return "😐";
      case "not_for_me":
        return "👎";
      default:
        return "😐";
    }
  };

  // Helper to generate rotation styles for comic feel
  const getRotationStyle = (index: number) => {
    // Alternate rotations between -1 and +1 degrees
    const rotations = [-0.6, 0.8, -0.4, 0.6, -0.8, 0.4, -0.5, 0.7];
    const rot = rotations[index % rotations.length];
    return {
      "--comic-rotate": `${rot}deg`,
      transform: `rotate(${rot}deg)`,
    } as React.CSSProperties;
  };

  // Find the Splash Panel: The most recent book rated "loved"
  const splashBook = useMemo(() => {
    return books.find((b) => b.rating === "loved");
  }, [books]);

  // List of other books (excluding splashBook if it exists)
  const otherBooks = useMemo(() => {
    if (!splashBook) return books;
    return books.filter((b) => b.id !== splashBook.id);
  }, [books, splashBook]);

  // Calculate Series Progress
  const seriesTrackers = useMemo(() => {
    // 1. Group books by seriesName for series with 2+ logged entries
    const seriesGroups: { [name: string]: KidsBookDoc[] } = {};
    books.forEach((b) => {
      if (b.isSeries && b.seriesName?.trim()) {
        const sName = b.seriesName.trim();
        if (!seriesGroups[sName]) seriesGroups[sName] = [];
        seriesGroups[sName].push(b);
      }
    });

    return Object.entries(seriesGroups)
      .filter(([_, list]) => list.length >= 2)
      .map(([name, list]) => {
        // Sort books in series by number
        const sortedList = [...list].sort(
          (a, b) => (a.seriesBookNumber || 0) - (b.seriesBookNumber || 0)
        );

        // Find max book number logged
        const maxBookNum = Math.max(...list.map((b) => b.seriesBookNumber || 0), 1);
        
        // Find if seriesTotalBooks is specified in any entry
        const totalBooksFound = list.find((b) => b.seriesTotalBooks != null)?.seriesTotalBooks;
        const totalSlots = totalBooksFound || maxBookNum;

        // Populate slots
        const slots = Array.from({ length: totalSlots }, (_, i) => {
          const bookNum = i + 1;
          const matchedBook = list.find((b) => b.seriesBookNumber === bookNum);
          return {
            bookNumber: bookNum,
            read: !!matchedBook,
            book: matchedBook,
          };
        });

        // Determine if next book should be prompted (most recent entry has willReadNext: 'yes')
        const mostRecentEntry = [...list].sort(
          (a, b) => {
            const timeA = a.dateAdded?.toDate().getTime() || 0;
            const timeB = b.dateAdded?.toDate().getTime() || 0;
            return timeB - timeA;
          }
        )[0];

        const willReadNext = mostRecentEntry?.willReadNext === "yes";
        
        // Find next unread book number
        const nextUnreadSlot = slots.find((s) => !s.read);
        const nextBookInfo = willReadNext && nextUnreadSlot 
          ? `Book ${nextUnreadSlot.bookNumber}` 
          : null;

        return {
          name,
          slots,
          nextBookInfo,
        };
      });
  }, [books]);

  // Calculate Author Tiers
  const authorTiers = useMemo(() => {
    const lovedCount: { [author: string]: number } = {};
    books.forEach((b) => {
      if (b.rating === "loved" && b.author?.trim()) {
        const auth = b.author.trim();
        lovedCount[auth] = (lovedCount[auth] || 0) + 1;
      }
    });

    const lovedAuthors: string[] = [];
    const favoriteAuthors: string[] = [];

    Object.entries(lovedCount).forEach(([author, count]) => {
      if (count >= 2) {
        favoriteAuthors.push(author);
      } else if (count === 1) {
        lovedAuthors.push(author);
      }
    });

    return {
      loved: lovedAuthors,
      favorite: favoriteAuthors,
    };
  }, [books]);

  const handleDeleteClick = (bookId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}" from your shelf?`)) {
      onDeleteBook(bookId);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto py-4 px-2">
      
      {/* BANNER / HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b-4 border-gray-900">
        <div className="flex items-center gap-4">
          <div className="starburst starburst-gold text-sm animate-bounce">
            RAMONA'S ZONE!
          </div>
          <h1 className="comic-header-font text-4xl sm:text-5xl md:text-6xl text-gray-900">
            RAMONA'S COMIC SHELF
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Palette button */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="comic-btn-interactive px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white"
              style={getRotationStyle(1)}
            >
              🎨 Pick Colors!
            </button>
            {showColorPicker && (
              <div className="absolute right-0 mt-3 z-30 comic-panel p-4 w-64 flex flex-col gap-3 transform rotate-1 border-3 border-gray-900 bg-white">
                <h4 className="font-bold text-gray-900 text-sm border-b-2 border-gray-900 pb-1 mb-1">
                  Choose a style:
                </h4>
                <div className="flex flex-col gap-2">
                  {PALETTES.map((pal) => (
                    <button
                      key={pal.key}
                      onClick={() => {
                        onChangePalette(pal.key);
                        setShowColorPicker(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded border-2 border-gray-900 text-xs font-bold transition-all ${
                        activePalette === pal.key ? "bg-yellow-100" : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <span>{pal.label}</span>
                      <div className="flex gap-1">
                        <div className="w-4 h-4 rounded-full border border-gray-900" style={{ backgroundColor: pal.bg }} />
                        <div className={`w-4 h-4 rounded-full border border-gray-900 ${pal.accent}`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add Book Button */}
          <button
            onClick={onAddBookClick}
            className="comic-btn-interactive px-6 py-2.5 text-base bg-rose-500 hover:bg-rose-600 text-white transform scale-105 active:scale-100"
            style={getRotationStyle(2)}
          >
            💥 ADD A BOOK!
          </button>
        </div>
      </div>

      {/* TOTAL BOOKS READ BANNER */}
      <div className="flex justify-center my-2">
        <div className="starburst starburst-gold text-2xl px-8 py-5 transform -rotate-2 select-none">
          READ {books.length} {books.length === 1 ? "BOOK" : "BOOKS"}! 💥
        </div>
      </div>

      {/* NO BOOKS STATE */}
      {books.length === 0 && (
        <div className="comic-panel text-center py-16 flex flex-col items-center gap-4 max-w-xl mx-auto" style={getRotationStyle(4)}>
          <span className="text-6xl animate-bounce">📖</span>
          <h2 className="comic-header-font text-2xl text-gray-800">Your shelf is empty!</h2>
          <p className="font-bold text-gray-600 text-sm max-w-sm">
            Add books you have read to fill your comic shelf with colorful panels!
          </p>
          <button
            onClick={onAddBookClick}
            className="comic-btn-interactive mt-2 bg-rose-500 hover:bg-rose-600 text-white"
          >
            Log your first book!
          </button>
        </div>
      )}

      {/* MAIN SHELF GRID */}
      {books.length > 0 && (
        <div className="comic-grid">
          
          {/* SPLASH PANEL (Most Recent Loved Book) */}
          {splashBook && (
            <div className="comic-panel comic-splash-panel flex flex-col justify-between" style={getRotationStyle(0)}>
              <div className="starburst absolute -top-4 -right-4 text-xs z-10 transform rotate-12 scale-110">
                LOVED IT! 😍
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDeleteClick(splashBook.id, splashBook.title)}
                className="absolute top-2 left-2 w-7 h-7 bg-white hover:bg-red-500 hover:text-white rounded-full border-2 border-gray-900 flex items-center justify-center font-bold text-xs shadow z-10 transition-colors"
                title="Delete this book"
              >
                ✕
              </button>

              <div className="flex flex-col sm:flex-row gap-6 h-full">
                {/* Book Cover */}
                <div className="flex-shrink-0 w-full sm:w-44 flex justify-center items-center">
                  {splashBook.coverUrl ? (
                    <img
                      src={splashBook.coverUrl}
                      alt={splashBook.title}
                      className="w-40 h-52 object-cover border-4 border-gray-900 rounded shadow-md transform -rotate-1"
                    />
                  ) : (
                    <div className="w-40 h-52 bg-yellow-100 border-4 border-gray-900 rounded flex flex-col items-center justify-center font-bold text-gray-500 shadow-md">
                      <span className="text-4xl mb-2">📚</span>
                      NO COVER
                    </div>
                  )}
                </div>

                {/* Details & Speech Bubble */}
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <span className="bg-yellow-400 text-gray-900 border-2 border-gray-900 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                      🔥 LATEST FAVORITE!
                    </span>
                    <h3 className="comic-header-font text-2xl md:text-3xl text-gray-900 mt-2 line-clamp-2 leading-tight">
                      {splashBook.title}
                    </h3>
                    <p className="font-bold text-gray-700 text-sm md:text-base mb-3">
                      By {splashBook.author}
                    </p>
                    
                    {splashBook.format && (
                      <span className="inline-block bg-rose-100 border-2 border-rose-500 text-rose-700 text-xs font-bold px-2 py-0.5 rounded mr-2">
                        {splashBook.format === "Graphic Novel" ? "🎨 Graphic Novel" : "📖 Chapter Book"}
                      </span>
                    )}

                    {splashBook.artStyle && (
                      <span className="inline-block bg-indigo-100 border-2 border-indigo-500 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                        Style: {ART_STYLES_CONFIG.find((s) => s.key === splashBook.artStyle)?.label || splashBook.artStyle}
                      </span>
                    )}
                  </div>

                  {/* Speech Bubble for note */}
                  {splashBook.favoritePart && (
                    <div className="speech-bubble mt-4 text-sm font-bold text-gray-900 bg-white">
                      <p className="text-xs text-rose-500 uppercase tracking-widest mb-1">My Favorite Part:</p>
                      <p className="italic">"{splashBook.favoritePart}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* OTHER SINGLE PANELS */}
          {otherBooks.map((book, idx) => (
            <div
              key={book.id}
              className="comic-panel flex flex-col justify-between p-4 group"
              style={getRotationStyle(idx + 3)}
            >
              {/* Delete button */}
              <button
                onClick={() => handleDeleteClick(book.id, book.title)}
                className="absolute top-2 left-2 w-6 h-6 bg-white hover:bg-red-500 hover:text-white rounded-full border-2 border-gray-900 flex items-center justify-center font-bold text-xs shadow opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
                title="Delete this book"
              >
                ✕
              </button>

              <div className="flex flex-col gap-3">
                {/* Book Cover */}
                <div className="aspect-[3/4] w-full bg-gray-100 border-3 border-gray-900 rounded overflow-hidden shadow-sm relative">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center font-bold text-gray-400 bg-yellow-50">
                      <span className="text-3xl mb-1">📖</span>
                      <span className="text-[10px]">NO COVER</span>
                    </div>
                  )}
                  {/* Rating Badge */}
                  <div className="absolute bottom-1.5 right-1.5 w-9 h-9 rounded-full border-2 border-gray-900 bg-white flex items-center justify-center text-xl shadow">
                    {ratingEmoji(book.rating)}
                  </div>
                </div>

                {/* Details */}
                <div>
                  <h4 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight">
                    {book.title}
                  </h4>
                  <p className="text-xs text-gray-600 font-semibold truncate mt-0.5">
                    {book.author}
                  </p>
                </div>
              </div>

              {/* Mini tag */}
              <div className="mt-2.5 pt-2.5 border-t-2 border-dashed border-gray-300 flex justify-between items-center text-[10px] font-bold text-gray-500">
                <span>{book.format === "Graphic Novel" ? "🎨 Novel" : "📖 Chapter"}</span>
                {book.isSeries && <span className="bg-yellow-100 border border-yellow-500 text-yellow-800 px-1 rounded">Series</span>}
              </div>
            </div>
          ))}

        </div>
      )}

      {/* SERIES TRACKER VIEW */}
      {seriesTrackers.length > 0 && (
        <div className="comic-panel mt-6" style={getRotationStyle(2)}>
          <h2 className="comic-header-font text-2xl text-gray-900 border-b-4 border-gray-900 pb-2 mb-4">
            ⚡ SERIES PROGRESS TRACKERS
          </h2>

          <div className="flex flex-col gap-6">
            {seriesTrackers.map((tracker) => (
              <div key={tracker.name} className="border-3 border-gray-900 p-4 rounded bg-white shadow flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="comic-header-font text-lg text-gray-900">
                    📚 {tracker.name}
                  </h3>
                  {tracker.nextBookInfo && (
                    <span className="starburst starburst-gold text-[10px] transform rotate-1 scale-95">
                      NEXT: {tracker.nextBookInfo}!
                    </span>
                  )}
                </div>

                {/* Slots grid */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
                  {tracker.slots.map((slot) => (
                    <div
                      key={slot.bookNumber}
                      className={`series-slot ${slot.read ? "series-slot-read" : "series-slot-unread"}`}
                      title={slot.book ? slot.book.title : `Book ${slot.bookNumber}`}
                    >
                      {slot.read ? (
                        <div className="w-full h-full p-1 relative flex items-center justify-center">
                          {slot.book?.coverUrl ? (
                            <img src={slot.book.coverUrl} alt="" className="w-full h-full object-cover rounded border border-gray-300" />
                          ) : (
                            <span className="text-lg">✅</span>
                          )}
                          <span className="absolute bottom-0 right-0 bg-gray-900 text-white border border-white text-[8px] font-bold px-1 rounded-tl-sm">
                            {slot.bookNumber}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-xs font-bold text-gray-500">
                          <span>?</span>
                          <span className="text-[9px]">#{slot.bookNumber}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOVED AUTHORS SECTION */}
      {books.length > 0 && (authorTiers.loved.length > 0 || authorTiers.favorite.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
          
          {/* Favorite Authors */}
          {authorTiers.favorite.length > 0 && (
            <div className="comic-panel border-4 border-yellow-400 bg-yellow-50" style={getRotationStyle(5)}>
              <div className="starburst starburst-gold absolute -top-4 -right-4 text-xs z-10 scale-105">
                FAVORITES! 🏆
              </div>
              <h2 className="comic-header-font text-xl text-yellow-900 border-b-2 border-yellow-900 pb-1.5 mb-3">
                ⭐ FAVORITE AUTHORS
              </h2>
              <ul className="flex flex-col gap-2">
                {authorTiers.favorite.map((author) => (
                  <li
                    key={author}
                    className="font-bold text-base text-yellow-950 bg-white border-2 border-yellow-900 rounded px-3 py-2 flex items-center justify-between"
                  >
                    <span>🎨 {author}</span>
                    <span className="text-xs bg-yellow-400 border border-yellow-600 px-2 py-0.5 rounded text-gray-900">
                      2+ Loved Books
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Loved Authors */}
          {authorTiers.loved.length > 0 && (
            <div className="comic-panel border-3 border-gray-900" style={getRotationStyle(6)}>
              <h2 className="comic-header-font text-xl text-gray-900 border-b-2 border-gray-900 pb-1.5 mb-3">
                ❤️ LOVED AUTHORS
              </h2>
              <ul className="flex flex-col gap-2">
                {authorTiers.loved.map((author) => (
                  <li
                    key={author}
                    className="font-bold text-sm text-gray-800 bg-white border-2 border-gray-900 rounded px-3 py-2"
                  >
                    ✏️ {author}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
