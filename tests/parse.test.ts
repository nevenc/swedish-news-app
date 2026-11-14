import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeBody } from "../src/pipeline/fetch.ts";
import { FeedParseError, parseFeed } from "../src/pipeline/parse.ts";

const FIXTURES = [
  ["svt", "rss", 100],
  ["sr", "atom", 20],
  ["dn", "rss", 118],
  ["svd", "rss", 42],
  ["aftonbladet", "rss", 39],
  ["expressen", "rss", 20],
  ["tv4", "rss", 51],
  ["di", "rss", 20],
  ["gp", "rss", 17],
  ["sydsvenskan", "rss", 38],
] as const;

async function fixture(key: string): Promise<string> {
  return readFile(new URL(`./fixtures/feeds/${key}.xml`, import.meta.url), "utf8");
}

describe("parseFeed on recorded publisher feeds", () => {
  for (const [key, format, count] of FIXTURES) {
    it(`${key}: ${count} ${format} entries with title, link and date`, async () => {
      const feed = parseFeed(await fixture(key));
      expect(feed.format).toBe(format);
      expect(feed.entries).toHaveLength(count);
      for (const e of feed.entries) {
        expect(e.title, `title in ${key}`).toBeTruthy();
        expect(e.link, `link in ${key}`).toMatch(/^https?:\/\//);
        expect(e.published, `date in ${key}`).toBeTruthy();
      }
    });
  }

  it("picks up Aftonbladet enclosure images", async () => {
    const feed = parseFeed(await fixture("aftonbladet"));
    expect(feed.entries.some((e) => e.imageUrl?.startsWith("https://"))).toBe(true);
  });

  it("reads SR Atom summaries as HTML text", async () => {
    const feed = parseFeed(await fixture("sr"));
    expect(feed.entries[0]?.description).toContain("<");
  });

  it("rejects non-feed XML and garbage", () => {
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow(FeedParseError);
    expect(() => parseFeed("")).toThrow(FeedParseError);
  });
});

describe("decodeBody", () => {
  it("decompresses gzip bodies that lack a Content-Encoding header", () => {
    const xml = '<?xml version="1.0"?><rss><channel><title>GP</title></channel></rss>';
    expect(decodeBody(new Uint8Array(gzipSync(Buffer.from(xml))))).toBe(xml);
    expect(decodeBody(new TextEncoder().encode(xml))).toBe(xml);
  });
});
