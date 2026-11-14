import { describe, expect, it } from "vitest";
import { normalizeWhitespace, stripHtml, truncate } from "../src/util/text.ts";
import { parseFeedDate, stockholmDate, toStockholmIso } from "../src/util/time.ts";
import { canonicalUrl } from "../src/util/url.ts";

describe("canonicalUrl", () => {
  it("strips tracking params, sorts the rest, forces https, drops fragment", () => {
    expect(
      canonicalUrl("http://www.Aftonbladet.se/nyheter/a/6Pn2WL/x?utm_medium=rss&b=2&a=1#top"),
    ).toBe("https://www.aftonbladet.se/nyheter/a/6Pn2WL/x?a=1&b=2");
  });
  it("removes trailing slash except at root", () => {
    expect(canonicalUrl("https://www.expressen.se/nyheter/sverige/x/")).toBe(
      "https://www.expressen.se/nyheter/sverige/x",
    );
    expect(canonicalUrl("https://www.svt.se/")).toBe("https://www.svt.se/");
  });
  it("resolves relative links against a base", () => {
    expect(canonicalUrl("/nyheter/x", "https://www.svt.se")).toBe("https://www.svt.se/nyheter/x");
  });
  it("rejects non-http", () => {
    expect(canonicalUrl("mailto:a@b.se")).toBeUndefined();
    expect(canonicalUrl("not a url")).toBeUndefined();
  });
});

describe("text", () => {
  it("strips HTML and decodes entities", () => {
    expect(
      stripHtml("<p>Polisen s&ouml;ker.</p><p>Nu s&#228;tts helikopter in&nbsp;–&nbsp;x</p>"),
    ).toBe("Polisen söker. Nu sätts helikopter in – x");
  });
  it("turns list items into spaces", () => {
    expect(stripHtml("<ul><li><p>A.</p></li><li><p>B.</p></li></ul>")).toBe("A. B.");
  });
  it("normalizes whitespace including nbsp", () => {
    expect(normalizeWhitespace("  a   b\n\nc ")).toBe("a b c");
  });
  it("truncates at a sentence boundary when one is late enough", () => {
    const t = "Första meningen är här. Andra meningen är ganska lång och fortsätter. Tredje.";
    expect(truncate(t, 40)).toBe("Första meningen är här.");
  });
  it("falls back to a word boundary with ellipsis", () => {
    expect(truncate("ett två tre fyra fem sex sju åtta nio tio", 20)).toBe("ett två tre fyra…");
  });
  it("leaves short text alone", () => {
    expect(truncate("kort", 10)).toBe("kort");
  });
});

describe("time", () => {
  it("formats with +01:00 in winter and +02:00 in summer", () => {
    expect(toStockholmIso(new Date("2026-11-14T06:42:00Z"))).toBe("2026-11-14T07:42:00+01:00");
    expect(toStockholmIso(new Date("2026-07-01T06:42:00Z"))).toBe("2026-07-01T08:42:00+02:00");
  });
  it("assigns the Stockholm calendar day across the UTC midnight boundary", () => {
    expect(stockholmDate(new Date("2026-11-14T23:30:00Z"))).toEqual({
      year: "2026",
      month: "11",
      day: "15",
    });
  });
  it("parses RFC 822 and ISO dates", () => {
    expect(parseFeedDate("Sat, 14 Nov 2026 08:47:42 +0100")?.toISOString()).toBe(
      "2026-11-14T07:47:42.000Z",
    );
    expect(parseFeedDate("2026-11-14T07:47:42Z")?.toISOString()).toBe("2026-11-14T07:47:42.000Z");
    expect(parseFeedDate("yesterday-ish")).toBeUndefined();
    expect(parseFeedDate(undefined)).toBeUndefined();
  });
});
