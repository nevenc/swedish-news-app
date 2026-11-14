export const TZ = "Europe/Stockholm";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface Parts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function stockholmParts(date: Date): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out as unknown as Parts;
}

/** Offset of Europe/Stockholm from UTC at `date`, in minutes (+60 or +120). */
export function stockholmOffsetMinutes(date: Date): number {
  const p = stockholmParts(date);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** ISO 8601 with explicit Stockholm offset, e.g. 2026-11-14T07:42:00+01:00. */
export function toStockholmIso(date: Date): string {
  const p = stockholmParts(date);
  const off = stockholmOffsetMinutes(date);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
}

/** Calendar date in Stockholm as { year, month, day } strings. */
export function stockholmDate(date: Date): { year: string; month: string; day: string } {
  const p = stockholmParts(date);
  return { year: p.year, month: p.month, day: p.day };
}

/** Parse a feed timestamp (RFC 822 or ISO 8601). Returns undefined if unparseable. */
export function parseFeedDate(text: string | undefined): Date | undefined {
  if (!text) return undefined;
  const d = new Date(text.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}
