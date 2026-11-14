import type { Source, SourcesConfig } from "../config/sources.ts";
import { enabledSources } from "../config/sources.ts";
import { toStockholmIso } from "../util/time.ts";
import { type FeedState, type FetchFn, fetchFeed } from "./fetch.ts";
import { normalizeEntry } from "./normalize.ts";
import { FeedParseError, parseFeed } from "./parse.ts";
import type { ContentStore } from "./store.ts";

export interface SourceReport {
  key: string;
  feeds: number;
  notModified: number;
  entries: number;
  written: number;
  duplicates: number;
  dropped: Record<string, number>;
  errors: string[];
}

export interface IngestReport {
  startedAt: string;
  finishedAt: string;
  sources: SourceReport[];
  written: number;
  /** True when every source failed or produced nothing; the caller should fail loudly. */
  allFailed: boolean;
}

export interface IngestOptions {
  config: SourcesConfig;
  store: ContentStore;
  /** Restrict to these source keys (default: all enabled). */
  only?: string[];
  dryRun?: boolean;
  now?: () => Date;
  fetchFn?: FetchFn;
  log?: (line: string) => void;
}

function compilePatterns(source: Source): RegExp[] | undefined {
  if (source.excludeTitlePatterns.length === 0) return undefined;
  return source.excludeTitlePatterns.map((p) => new RegExp(p, "i"));
}

export async function ingest(opts: IngestOptions): Promise<IngestReport> {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const startedAt = now();

  let sources = enabledSources(opts.config);
  if (opts.only) {
    const only = new Set(opts.only);
    sources = sources.filter((s) => only.has(s.key));
  }

  const known = await opts.store.knownIds();
  const feedStates = await opts.store.readFeedStates();
  const seenThisRun = new Set<string>();
  const reports: SourceReport[] = [];

  for (const source of sources) {
    const report: SourceReport = {
      key: source.key,
      feeds: source.feeds.length,
      notModified: 0,
      entries: 0,
      written: 0,
      duplicates: 0,
      dropped: {},
      errors: [],
    };
    const excludeTitle = compilePatterns(source);

    for (const feed of source.feeds) {
      const prev = feedStates[feed.url] ?? {};
      const state: FeedState = { ...prev, lastFetched: toStockholmIso(now()) };
      try {
        const res = await fetchFeed(feed.url, {
          userAgent: opts.config.userAgent,
          state: prev,
          ...(opts.fetchFn ? { fetchFn: opts.fetchFn } : {}),
        });
        state.lastStatus = res.status;
        delete state.lastError;
        if (res.etag) state.etag = res.etag;
        if (res.lastModified) state.lastModified = res.lastModified;

        if (res.status === 304 || res.body === undefined) {
          report.notModified++;
          continue;
        }

        const parsed = parseFeed(res.body);
        report.entries += parsed.entries.length;
        const fetchedAt = now();

        for (const entry of parsed.entries) {
          const result = normalizeEntry(entry, {
            source,
            feedCategory: feed.category,
            fetchedAt,
            ...(excludeTitle ? { excludeTitle } : {}),
          });
          if (!result.ok) {
            report.dropped[result.reason] = (report.dropped[result.reason] ?? 0) + 1;
            continue;
          }
          const { article } = result;
          if (known.has(article.id) || seenThisRun.has(article.id)) {
            report.duplicates++;
            continue;
          }
          seenThisRun.add(article.id);
          if (!opts.dryRun) await opts.store.write(article);
          report.written++;
        }
      } catch (err) {
        const msg = err instanceof FeedParseError ? err.message : (err as Error).message;
        state.lastError = msg;
        report.errors.push(`${feed.url}: ${msg}`);
      } finally {
        feedStates[feed.url] = state;
      }
    }

    const dropped = Object.entries(report.dropped)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    log(
      `${source.key.padEnd(12)} entries=${report.entries} new=${report.written} dup=${report.duplicates}` +
        `${report.notModified ? ` 304=${report.notModified}` : ""}${dropped ? ` dropped[${dropped}]` : ""}` +
        `${report.errors.length ? ` ERR=${report.errors.length}` : ""}`,
    );
    for (const e of report.errors) log(`  ! ${e}`);
    reports.push(report);
  }

  if (!opts.dryRun) await opts.store.writeFeedStates(feedStates);

  const written = reports.reduce((n, r) => n + r.written, 0);
  const anyEntries = reports.some((r) => r.entries > 0 || r.notModified > 0);
  return {
    startedAt: toStockholmIso(startedAt),
    finishedAt: toStockholmIso(now()),
    sources: reports,
    written,
    allFailed: reports.length > 0 && !anyEntries,
  };
}

/** Commit message in the form SPEC §4.3 describes. */
export function commitMessage(report: IngestReport): string {
  const perSource = report.sources
    .filter((r) => r.written > 0)
    .map((r) => `${r.key} ${r.written}`)
    .join(", ");
  return `ingest: ${report.finishedAt} — ${report.written} new items${perSource ? ` (${perSource})` : ""}`;
}
