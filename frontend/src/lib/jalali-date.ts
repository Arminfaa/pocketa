import dayjs, { type Dayjs } from "dayjs";
import jalaliday from "jalaliday";
import { toEnglishDigits } from "@/lib/amount";

dayjs.extend(jalaliday);

/** Parse stored YYYY/MM/DD (English digits) to a Jalali dayjs instance. */
export function jalaliStringToDayjs(value?: string | null): Dayjs | null {
  if (!value) return null;
  const normalized = toEnglishDigits(value).trim();
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;

  const year = match[1]!;
  const month = match[2]!.padStart(2, "0");
  const day = match[3]!.padStart(2, "0");
  const parsed = dayjs(`${year}-${month}-${day}`, { jalali: true });
  return parsed.isValid() ? parsed : null;
}

/** Format a dayjs (Jalali calendar) value to server-ready YYYY/MM/DD. */
export function dayjsToJalaliString(date: Dayjs | null | undefined): string {
  if (!date || !date.isValid()) return "";
  const j = date.calendar("jalali");
  const y = j.year();
  const m = String(j.month() + 1).padStart(2, "0");
  const d = String(j.date()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}
