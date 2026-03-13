/**
 * Auto-categorize expenses based on description keywords.
 * Supports both English and Arabic terms.
 */

type Category = "water" | "electricity" | "maintenance" | "cleaning" | "management" | "other" | "insurance" | "taxes";

const KEYWORD_CATEGORY_MAP: { keywords: string[]; category: Category }[] = [
  { keywords: ["water", "ماء", "مياه", "nwc"], category: "water" },
  { keywords: ["electricity", "كهرباء", "power", "كهربا", "sec", "طاقة"], category: "electricity" },
  { keywords: ["maintenance", "صيانة", "repair", "إصلاح", "plumber", "سباك", "fix", "تصليح", "كهربائي", "electrician"], category: "maintenance" },
  { keywords: ["cleaning", "تنظيف", "نظافة", "janitor", "نظيف"], category: "cleaning" },
  { keywords: ["management", "إدارة", "admin", "fee", "رسوم", "عمولة", "commission"], category: "management" },
  { keywords: ["insurance", "تأمين"], category: "insurance" },
  { keywords: ["tax", "ضريبة", "زكاة", "vat", "ضريب"], category: "taxes" },
];

export function suggestCategory(description: string): Category | null {
  if (!description || description.trim().length < 2) return null;
  const lower = description.toLowerCase().trim();
  for (const entry of KEYWORD_CATEGORY_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.category;
    }
  }
  return null;
}
