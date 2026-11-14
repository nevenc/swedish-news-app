import { describe, expect, it } from "vitest";
import {
  enabledSources,
  loadSources,
  parseSourcesYaml,
  SourcesConfigError,
} from "../src/config/sources.ts";

const minimal = `
defaults:
  user_agent: test-agent/0.1
sources:
  - key: svt
    name: SVT Nyheter
    homepage: https://www.svt.se/nyheter
    feeds:
      - url: https://www.svt.se/rss.xml
`;

describe("parseSourcesYaml", () => {
  it("applies defaults", () => {
    const cfg = parseSourcesYaml(minimal);
    expect(cfg.userAgent).toBe("test-agent/0.1");
    const svt = cfg.sources[0];
    expect(svt?.enabled).toBe(true);
    expect(svt?.language).toBe("sv");
    expect(svt?.maxSummaryChars).toBe(300);
    expect(svt?.feeds[0]?.category).toBe("general");
  });

  it("rejects duplicate keys", () => {
    const dup = minimal + minimal.split("sources:")[1];
    expect(() => parseSourcesYaml(dup)).toThrow(SourcesConfigError);
  });

  it("rejects an enabled source without feeds", () => {
    const noFeeds = minimal.replace(/feeds:[\s\S]*$/, "feeds: []\n");
    expect(() => parseSourcesYaml(noFeeds)).toThrow(/no feeds/);
  });

  it("rejects an invalid category", () => {
    const bad = minimal.replace("rss.xml\n", "rss.xml\n        category: gossip\n");
    expect(() => parseSourcesYaml(bad)).toThrow(SourcesConfigError);
  });
});

describe("sources.yaml in repo", () => {
  it("is valid and has the ten verified sources enabled", async () => {
    const cfg = await loadSources();
    const enabled = enabledSources(cfg).map((s) => s.key);
    expect(enabled).toEqual([
      "svt",
      "sr",
      "dn",
      "svd",
      "aftonbladet",
      "expressen",
      "tv4",
      "di",
      "gp",
      "sydsvenskan",
    ]);
    for (const s of enabledSources(cfg)) {
      expect(s.feeds.length).toBeGreaterThan(0);
    }
  });
});
