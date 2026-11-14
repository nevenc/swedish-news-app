import type { Category, Source } from "../config/sources.ts";
import { type Article, articleId, SCHEMA_VERSION } from "../model/article.ts";
import { normalizeWhitespace, stripHtml, truncate } from "../util/text.ts";
import { parseFeedDate, toStockholmIso } from "../util/time.ts";
import { canonicalUrl } from "../util/url.ts";
import type { FeedEntry } from "./parse.ts";

/** Absolute ceiling on stored teaser length (SPEC §3). */
export const HARD_SUMMARY_CAP = 500;

export type NormalizeResult =
  | { ok: true; article: Article }
  | { ok: false; reason: "no-title" | "no-link" | "bad-link" | "excluded" | "no-date" };

export interface NormalizeOptions {
  source: Source;
  feedCategory: Category;
  fetchedAt: Date;
  /** Compiled from source.excludeTitlePatterns. */
  excludeTitle?: RegExp[];
}

export function normalizeEntry(entry: FeedEntry, opts: NormalizeOptions): NormalizeResult {
  const title = entry.title ? stripHtml(entry.title) : "";
  if (!title) return { ok: false, reason: "no-title" };
  if (opts.excludeTitle?.some((re) => re.test(title))) return { ok: false, reason: "excluded" };

  if (!entry.link) return { ok: false, reason: "no-link" };
  const url = canonicalUrl(entry.link, opts.source.homepage);
  if (!url) return { ok: false, reason: "bad-link" };

  const published = parseFeedDate(entry.published);
  if (!published) return { ok: false, reason: "no-date" };

  const sv: Article["sv"] = { title };
  const teaser = entry.description ? stripHtml(entry.description) : "";
  if (teaser && teaser !== title) {
    const max = Math.min(opts.source.maxSummaryChars, HARD_SUMMARY_CAP);
    if (teaser.length <= max) {
      sv.summary = teaser;
      sv.summary_origin = "feed";
    } else {
      sv.summary = truncate(teaser, max);
      sv.summary_origin = "truncated";
    }
  }

  const image = entry.imageUrl ? canonicalUrl(entry.imageUrl, opts.source.homepage) : undefined;
  const feedCategories = entry.categories.map(normalizeWhitespace).filter(Boolean);

  const article: Article = {
    id: articleId(url),
    schema_version: SCHEMA_VERSION,
    source: opts.source.key,
    url,
    guid: entry.guid ? normalizeWhitespace(entry.guid) : url,
    published_at: toStockholmIso(published),
    fetched_at: toStockholmIso(opts.fetchedAt),
    category: opts.feedCategory,
    sv,
    translation: { status: "pending" },
  };
  if (feedCategories.length > 0) article.feed_categories = feedCategories;
  if (image) article.image_url = image;
  return { ok: true, article };
}
