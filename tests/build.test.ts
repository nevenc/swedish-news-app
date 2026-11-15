import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApi } from "../src/build/api.ts";
import { buildSite } from "../src/build/site.ts";
import { loadSources } from "../src/config/sources.ts";
import { ingest } from "../src/pipeline/ingest.ts";
import { ContentStore } from "../src/pipeline/store.ts";

const FIXED_NOW = new Date("2026-11-14T12:00:00Z");

describe("buildApi + buildSite", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "swedlines-build-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("generates the v1 endpoints from ingested content", async () => {
    const config = await loadSources();
    const keyByUrl = new Map(
      config.sources.flatMap((s) => s.feeds.map((f) => [f.url, s.key] as const)),
    );
    const fetchFn = async (url: string) => {
      const key = keyByUrl.get(url);
      const body = await readFile(new URL(`./fixtures/feeds/${key}.xml`, import.meta.url));
      return new Response(body, { status: 200 });
    };
    const store = new ContentStore(root);
    const report = await ingest({ config, store, fetchFn, now: () => FIXED_NOW });
    const publicDir = join(root, "docs");
    const result = await buildApi({ store, config, publicDir, now: FIXED_NOW });
    expect(result.articles).toBe(report.written);

    const read = async (rel: string) =>
      JSON.parse(await readFile(join(publicDir, "api/v1", rel), "utf8"));
    const latest = await read("latest.json");
    expect(latest.generated_at).toBe("2026-11-14T13:00:00+01:00");
    expect(latest.count).toBe(200);
    expect(latest.items[0].published_at >= latest.items[199].published_at).toBe(true);

    const ticker = await read("ticker.json");
    expect(ticker.count).toBe(50);
    expect(Object.keys(ticker.items[0]).sort()).toEqual([
      "id",
      "published_at",
      "source",
      "sv",
      "url",
    ]);
    expect((await stat(join(publicDir, "api/v1/ticker.json"))).size).toBeLessThan(20_000);

    const days = await read("days/index.json");
    expect(days.days.reduce((n: number, d: { count: number }) => n + d.count, 0)).toBe(
      report.written,
    );
    const firstDay = await read(`days/${days.days[0].date}.json`);
    expect(firstDay.count).toBe(days.days[0].count);

    const sources = await read("sources.json");
    expect(sources.sources.map((s: { key: string }) => s.key)).toContain("svt");
    expect(await read("sources/svt/latest.json")).toMatchObject({ count: 100 });
    expect(await read("categories/economy/latest.json")).toMatchObject({ count: 20 });

    const status = await read("status.json");
    expect(status).toMatchObject({ articles: report.written, translated: 0 });

    const site = await buildSite({ publicDir, appRoot: process.cwd(), config });
    expect(site).toEqual([
      "index.html",
      "about/index.html",
      "assets/logo.svg",
      "favicon.ico",
      "assets/icon-180.png",
      "assets/icon-192.png",
      "assets/icon-512.png",
      "assets/og.png",
    ]);
    expect((await stat(join(publicDir, "favicon.ico"))).size).toBeGreaterThan(0);
    expect((await stat(join(publicDir, "assets", "og.png"))).size).toBeGreaterThan(0);
    const index = await readFile(join(publicDir, "index.html"), "utf8");
    expect(index).toContain("api/v1/latest.json");
    expect(index).toContain('<link rel="canonical" href="https://swedlines.com/">');
    expect(index).toContain('content="https://swedlines.com/assets/og.png"');
    const about = await readFile(join(publicDir, "about", "index.html"), "utf8");
    expect(about).not.toContain("<!--PUBLISHERS");
    for (const s of config.sources.filter((x) => x.enabled)) expect(about).toContain(s.name);
    expect(about).toContain('href="https://ko-fi.com/swedlines"');
  });
});
