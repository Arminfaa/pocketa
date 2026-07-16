"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagsInput({ value, onChange, placeholder = "تگ + Enter" }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= 20) return;
    onChange([...value, tag.slice(0, 30)]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] px-2 py-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-[var(--ring)]">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500/15 text-brand-400 text-xs px-2 py-1"
        >
          {tag}
          <button
            type="button"
            aria-label={`حذف ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="hover:opacity-80"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent outline-none px-1 py-1 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) addTag(draft);
        }}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
