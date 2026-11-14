import { createHash } from "node:crypto";
import { z } from "zod";
import { CATEGORIES } from "../config/sources.ts";

export const SCHEMA_VERSION = 1;

const isoWithOffset = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, "ISO 8601 with explicit offset");

export const translationSchema = z.object({
  status: z.enum(["pending", "done", "skipped"]),
  provider: z.string().optional(),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
  translated_at: isoWithOffset.optional(),
  error: z.string().optional(),
});

export const articleSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{12}$/),
  schema_version: z.literal(SCHEMA_VERSION),
  source: z.string(),
  url: z.url(),
  guid: z.string(),
  published_at: isoWithOffset,
  fetched_at: isoWithOffset,
  category: z.enum(CATEGORIES),
  feed_categories: z.array(z.string()).optional(),
  image_url: z.url().optional(),
  sv: z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    summary_origin: z.enum(["feed", "truncated", "llm"]).optional(),
  }),
  en: z
    .object({
      title: z.string().min(1),
      summary: z.string().optional(),
    })
    .optional(),
  translation: translationSchema,
});

export type Article = z.infer<typeof articleSchema>;

/** First 12 hex characters of SHA-256 of the canonical URL. */
export function articleId(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 12);
}

/** Stable key order so that files diff cleanly. */
export function serializeArticle(a: Article): string {
  const ordered: Record<string, unknown> = {
    id: a.id,
    schema_version: a.schema_version,
    source: a.source,
    url: a.url,
    guid: a.guid,
    published_at: a.published_at,
    fetched_at: a.fetched_at,
    category: a.category,
    feed_categories: a.feed_categories,
    image_url: a.image_url,
    sv: a.sv,
    en: a.en,
    translation: a.translation,
  };
  for (const k of Object.keys(ordered)) {
    if (ordered[k] === undefined) delete ordered[k];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
