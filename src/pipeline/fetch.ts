import { gunzipSync } from "node:zlib";

export interface FeedState {
  etag?: string;
  lastModified?: string;
  lastFetched?: string;
  lastStatus?: number;
  lastError?: string;
}

export interface FetchResult {
  status: number;
  /** Undefined on 304 Not Modified. */
  body?: string | undefined;
  etag?: string | undefined;
  lastModified?: string | undefined;
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const GZIP_MAGIC = [0x1f, 0x8b];

/** Some publishers (GP) send gzip bodies without a Content-Encoding header. */
export function decodeBody(buf: Uint8Array): string {
  const bytes = buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1] ? gunzipSync(buf) : buf;
  return new TextDecoder("utf-8").decode(bytes);
}

export async function fetchFeed(
  url: string,
  opts: { userAgent: string; state?: FeedState; timeoutMs?: number; fetchFn?: FetchFn },
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "user-agent": opts.userAgent,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
  };
  if (opts.state?.etag) headers["if-none-match"] = opts.state.etag;
  if (opts.state?.lastModified) headers["if-modified-since"] = opts.state.lastModified;

  const fetchFn = opts.fetchFn ?? fetch;
  const res = await fetchFn(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });

  const etag = res.headers.get("etag") ?? undefined;
  const lastModified = res.headers.get("last-modified") ?? undefined;
  if (res.status === 304) return { status: 304, etag, lastModified };
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const body = decodeBody(new Uint8Array(await res.arrayBuffer()));
  return { status: res.status, body, etag, lastModified };
}
