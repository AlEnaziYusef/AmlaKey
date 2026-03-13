/**
 * Date formatting utilities with Hijri (Islamic Umm al-Qura) calendar support.
 * Uses Intl.DateTimeFormat — no external dependencies needed.
 */

/** Format a date string as Hijri (Islamic Umm al-Qura calendar) */
export function formatHijri(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

/** Format a date string as Gregorian in the given language */
export function formatGregorian(dateStr?: string, lang: "en" | "ar" = "en"): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
    return d.toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date with both Gregorian and Hijri.
 * Returns "15 Mar 2026 | 16 رمضان 1447" when showHijri is true.
 * Returns just "15 Mar 2026" when showHijri is false.
 */
export function formatDualDate(
  dateStr?: string,
  lang: "en" | "ar" = "en",
  showHijri: boolean = false,
): string {
  if (!dateStr) return "—";
  const greg = formatGregorian(dateStr, lang);
  if (!showHijri) return greg;
  const hijri = formatHijri(dateStr);
  if (!hijri) return greg;
  return `${greg}  ·  ${hijri}`;
}

/** Format a month string (YYYY-MM) as "March 2026" or "مارس 2026" with optional Hijri */
export function formatMonthDual(
  monthStr: string,
  lang: "en" | "ar" = "en",
  showHijri: boolean = false,
): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 15); // mid-month for accurate Hijri
  const greg = d.toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    month: "long",
    year: "numeric",
  });
  if (!showHijri) return greg;
  try {
    const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      month: "long",
      year: "numeric",
    }).format(d);
    return `${greg}  ·  ${hijri}`;
  } catch {
    return greg;
  }
}
