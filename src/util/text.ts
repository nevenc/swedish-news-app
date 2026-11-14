import { decodeHTML } from "entities";

/** Remove tags, decode entities, collapse whitespace. Block-level tags become spaces. */
export function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<\s*(br|p|div|li|ul|ol|h[1-6]|tr)\b[^>]*>/gi, " ")
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6]|tr)\s*>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return normalizeWhitespace(decodeHTML(withBreaks));
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/[\s ]+/g, " ").trim();
}

/**
 * Truncate to at most `max` characters, preferring a sentence boundary, then a word
 * boundary, then a hard cut. Appends an ellipsis when truncated.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const limit = max - 1; // room for the ellipsis
  const head = text.slice(0, limit);
  const sentenceEnd = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
  );
  if (sentenceEnd >= limit * 0.5) return `${head.slice(0, sentenceEnd + 1)}`;
  const wordEnd = head.lastIndexOf(" ");
  if (wordEnd >= limit * 0.5) return `${head.slice(0, wordEnd)}…`;
  return `${head}…`;
}
