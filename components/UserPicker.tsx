"use client";

import { useEffect, useState } from "react";
import { AppUser, addUser, listUsers } from "@/lib/books";

interface UserPickerProps {
  onSelect: (user: AppUser) => void;
  // Shown when the picker was opened via "Change user" (an active user
  // exists), letting the visitor back out without switching.
  onCancel?: () => void;
}

export default function UserPicker({ onSelect, onCancel }: UserPickerProps) {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((u) => {
        if (!cancelled) setUsers(u);
      })
      .catch((err) => {
        console.error("[users] Failed to load users:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load users."
          );
          setUsers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    const name = newName.trim();
    if (!name || name.length > 100 || adding) return;
    setAdding(true);
    setError(null);
    try {
      const user = await addUser(name);
      onSelect(user);
    } catch (err) {
      console.error("[users] Failed to add user:", err);
      setError(err instanceof Error ? err.message : "Failed to add user.");
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Who&apos;s rating?
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Pick your name, or add yourself below.
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
            {error}
          </div>
        )}

        {users === null ? (
          <p className="text-sm text-gray-400 py-2">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No users yet — add the first one below.</p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  onClick={() => onSelect(user)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-800 hover:bg-blue-50 border border-transparent hover:border-blue-200"
                >
                  {user.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-gray-100 pt-4 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            maxLength={100}
            placeholder="Add new user…"
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
