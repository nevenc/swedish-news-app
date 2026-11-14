import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSources } from "../src/config/sources.ts";
import { articleSchema } from "../src/model/article.ts";
import { ingest } from "../src/pipeline/ingest.ts";
import { ContentStore } from "../src/pipeline/store.ts";
import {
  outputSchema,
  type TranslateBatchFn,
  translatePending,
} from "../src/pipeline/translate.ts";
import { PROMPT_VERSION } from "../src/prompts/translate.ts";

const FIXED_NOW = new Date("2026-11-14T12:00:00Z");

const fakeTranslator: TranslateBatchFn = async (batch) => ({
  ok: true,
  model: "fake-model",
  usage: { input: batch.length * 40, output: batch.length * 30, cached: 100 },
  output: {
    items: batch.map((b) => ({
      id: b.id,
      title_en: `EN: ${b.title}`,
      summary_en: b.summary ? `EN: ${b.summary}` : null,
      category: "sweden" as const,
    })),
  },
});

async function seeded(root: string, only: string[]) {
  const config = await loadSources();
  const keyByUrl = new Map(
    config.sources.flatMap((s) => s.feeds.map((f) => [f.url, s.key] as const)),
  );
  const fetchFn = async (url: string) =>
    new Response(
      await readFile(new URL(`./fixtures/feeds/${keyByUrl.get(url)}.xml`, import.meta.url)),
    );
  const store = new ContentStore(root);
  const report = await ingest({ config, store, fetchFn, now: () => FIXED_NOW, only });
  return { store, written: report.written };
}

describe("translatePending", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "swedlines-tr-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("translates pending items in batches, sets provenance, and categorises 'general' items", async () => {
    const { store } = await seeded(root, ["expressen", "di"]);
    const report = await translatePending({
      store,
      translateBatch: fakeTranslator,
      days: 30,
      batchSize: 10,
      now: () => FIXED_NOW,
    });
    expect(report.candidates).toBe(40);
    expect(report.translated).toBe(40);
    expect(report.batches).toBe(4);
    expect(report.usage.cached).toBe(400);

    const all = await store.listArticles({ since: new Date(0) });
    for (const a of all) {
      articleSchema.parse(a);
      expect(a.translation).toMatchObject({
        status: "done",
        provider: "anthropic",
        model: "fake-model",
        prompt_version: PROMPT_VERSION,
        translated_at: "2026-11-14T13:00:00+01:00",
      });
      expect(a.en?.title).toBe(`EN: ${a.sv.title}`);
      if (a.sv.summary) expect(a.en?.summary).toBe(`EN: ${a.sv.summary}`);
      // di feed is declared `economy` and must keep it; expressen was `general` and takes the model's pick.
      expect(a.category).toBe(a.source === "di" ? "economy" : "sweden");
    }

    // Nothing left to do on a second pass.
    const again = await translatePending({
      store,
      translateBatch: fakeTranslator,
      days: 30,
      now: () => FIXED_NOW,
    });
    expect(again.candidates).toBe(0);
  });

  it("honours limit and days, and dry-run writes nothing", async () => {
    const { store } = await seeded(root, ["svt"]);
    const r = await translatePending({
      store,
      translateBatch: fakeTranslator,
      days: 30,
      limit: 7,
      dryRun: true,
      now: () => FIXED_NOW,
    });
    expect(r.candidates).toBe(7);
    expect(r.translated).toBe(7);
    const all = await store.listArticles({ since: new Date(0) });
    expect(all.every((a) => a.translation.status === "pending")).toBe(true);

    const none = await translatePending({
      store,
      translateBatch: fakeTranslator,
      days: 0,
      now: () => new Date("2030-01-01"),
    });
    expect(none.candidates).toBe(0);
  });

  it("marks a refused batch as skipped and leaves an errored batch pending", async () => {
    const { store } = await seeded(root, ["gp"]); // 17 items
    let call = 0;
    const flaky: TranslateBatchFn = async () => {
      call++;
      if (call === 1) return { ok: false, kind: "refusal", reason: "refusal (general_harms)" };
      return { ok: false, kind: "error", reason: "API error 529: overloaded" };
    };
    const r = await translatePending({
      store,
      translateBatch: flaky,
      days: 30,
      batchSize: 10,
      now: () => FIXED_NOW,
    });
    expect(r.skipped).toBe(10);
    expect(r.failed).toBe(7);
    expect(r.translated).toBe(0);
    const all = await store.listArticles({ since: new Date(0) });
    expect(all.filter((a) => a.translation.status === "skipped")).toHaveLength(10);
    expect(all.filter((a) => a.translation.status === "pending")).toHaveLength(7);
    expect(all.find((a) => a.translation.status === "skipped")?.translation.error).toMatch(
      /refusal/,
    );
  });

  it("counts items missing from the model output as failed", async () => {
    const { store } = await seeded(root, ["expressen"]);
    const dropsOne: TranslateBatchFn = async (batch) => {
      const r = await fakeTranslator(batch);
      if (r.ok) r.output.items = r.output.items.slice(1);
      return r;
    };
    const r = await translatePending({
      store,
      translateBatch: dropsOne,
      days: 30,
      batchSize: 20,
      now: () => FIXED_NOW,
    });
    expect(r.translated).toBe(19);
    expect(r.failed).toBe(1);
  });

  it("output schema rejects unknown categories and the 'general' bucket", () => {
    expect(
      outputSchema.safeParse({
        items: [{ id: "a", title_en: "x", summary_en: null, category: "general" }],
      }).success,
    ).toBe(false);
    expect(
      outputSchema.safeParse({
        items: [{ id: "a", title_en: "x", summary_en: null, category: "crime" }],
      }).success,
    ).toBe(true);
  });
});
