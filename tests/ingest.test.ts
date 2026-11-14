import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSources } from "../src/config/sources.ts";
import { articleSchema } from "../src/model/article.ts";
import { commitMessage, ingest } from "../src/pipeline/ingest.ts";
import { ContentStore } from "../src/pipeline/store.ts";

const FIXED_NOW = new Date("2026-11-14T12:00:00Z");

/** Serves the recorded fixtures instead of the network, keyed by source. */
async function fixtureFetch(keyByUrl: Map<string, string>) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    const key = keyByUrl.get(url);
    if (!key) return new Response("not found", { status: 404 });
    const headers = new Headers(init.headers);
    if (headers.get("if-none-match") === `"${key}-v1"`) {
      return new Response(null, { status: 304, headers: { etag: `"${key}-v1"` } });
    }
    const body = await readFile(new URL(`./fixtures/feeds/${key}.xml`, import.meta.url));
    return new Response(body, { status: 200, headers: { etag: `"${key}-v1"` } });
  };
}

async function allFiles(dir: string): Promise<string[]> {
  return (await readdir(dir, { recursive: true, encoding: "utf8" })).filter((f) =>
    f.endsWith(".json"),
  );
}

describe("ingest", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "swedlines-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes valid article files for every source and is idempotent", async () => {
    const config = await loadSources();
    const keyByUrl = new Map(
      config.sources.flatMap((s) => s.feeds.map((f) => [f.url, s.key] as const)),
    );
    const fetchFn = await fixtureFetch(keyByUrl);
    const store = new ContentStore(root);

    const first = await ingest({ config, store, fetchFn, now: () => FIXED_NOW });
    expect(first.allFailed).toBe(false);
    expect(first.written).toBeGreaterThan(300);
    for (const r of first.sources) {
      expect(r.errors, r.key).toEqual([]);
      expect(r.written, r.key).toBeGreaterThan(0);
    }

    const files = await allFiles(join(root, "content"));
    expect(files).toHaveLength(first.written);
    for (const f of files) {
      expect(f).toMatch(/^\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{12}\.json$/);
      const article = articleSchema.parse(
        JSON.parse(await readFile(join(root, "content", f), "utf8")),
      );
      expect(article.translation.status).toBe("pending");
      expect(article.en).toBeUndefined();
      if (article.sv.summary) expect(article.sv.summary.length).toBeLessThanOrEqual(500);
    }

    // Second run: conditional requests hit 304 and nothing new is written.
    const second = await ingest({ config, store, fetchFn, now: () => FIXED_NOW });
    expect(second.written).toBe(0);
    expect(second.sources.every((r) => r.notModified === r.feeds)).toBe(true);
    expect(await allFiles(join(root, "content"))).toHaveLength(first.written);

    // Third run with fresh state (no ETags): everything parses again but is deduplicated.
    const freshStore = new ContentStore(root);
    await freshStore.writeFeedStates({});
    const third = await ingest({ config, store: freshStore, fetchFn, now: () => FIXED_NOW });
    expect(third.written).toBe(0);
    expect(third.sources.reduce((n, r) => n + r.duplicates, 0)).toBe(first.written);
  });

  it("drops Aftonbladet live-chat items via exclude_title_patterns", async () => {
    const config = await loadSources();
    const keyByUrl = new Map(
      config.sources.flatMap((s) => s.feeds.map((f) => [f.url, s.key] as const)),
    );
    const fetchFn = await fixtureFetch(keyByUrl);
    const store = new ContentStore(root);
    const report = await ingest({
      config,
      store,
      fetchFn,
      now: () => FIXED_NOW,
      only: ["aftonbladet"],
    });
    expect(report.sources[0]?.dropped.excluded).toBeGreaterThanOrEqual(1);
    for (const f of await allFiles(join(root, "content"))) {
      const a = JSON.parse(await readFile(join(root, "content", f), "utf8")) as {
        sv: { title: string };
      };
      expect(a.sv.title).not.toMatch(/^CHATT:/);
    }
  });

  it("records per-feed errors without aborting the run", async () => {
    const config = await loadSources();
    const store = new ContentStore(root);
    const fetchFn = async () => new Response("boom", { status: 503 });
    const report = await ingest({ config, store, fetchFn, now: () => FIXED_NOW });
    expect(report.allFailed).toBe(true);
    expect(report.written).toBe(0);
    for (const r of report.sources) expect(r.errors[0]).toMatch(/HTTP 503/);
    const states = await store.readFeedStates();
    expect(Object.values(states).every((s) => s.lastError?.includes("503"))).toBe(true);
  });

  it("builds the commit message from the report", async () => {
    const config = await loadSources();
    const keyByUrl = new Map(
      config.sources.flatMap((s) => s.feeds.map((f) => [f.url, s.key] as const)),
    );
    const report = await ingest({
      config,
      store: new ContentStore(root),
      fetchFn: await fixtureFetch(keyByUrl),
      now: () => FIXED_NOW,
      only: ["svt", "sr"],
    });
    expect(commitMessage(report)).toMatch(
      /^ingest: 2026-11-14T13:00:00\+01:00 — \d+ new items \(svt \d+, sr \d+\)$/,
    );
  });
});
