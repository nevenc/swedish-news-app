import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type Dict = Record<string, string>;

/** Pull the I18N dictionary out of the stream page template without executing the page. */
async function loadDictionary(): Promise<{ en: Dict; sv: Dict; html: string }> {
  const html = await readFile(
    new URL("../src/build/templates/index.html", import.meta.url),
    "utf8",
  );
  const m = html.match(/const I18N = (\{[\s\S]*?\n {2}\});/);
  if (!m?.[1]) throw new Error("I18N dictionary not found in template");
  const dict = new Function(`return ${m[1]}`)() as { en?: Dict; sv?: Dict };
  if (!dict.en || !dict.sv) throw new Error("I18N must define en and sv");
  return { en: dict.en, sv: dict.sv, html };
}

describe("interface localisation", () => {
  it("has the same keys in English and Swedish, all non-empty", async () => {
    const { en, sv } = await loadDictionary();
    expect(Object.keys(sv).sort()).toEqual(Object.keys(en).sort());
    for (const [locale, dict] of [
      ["en", en],
      ["sv", sv],
    ] as const) {
      for (const [k, v] of Object.entries(dict)) expect(v.trim(), `${locale}.${k}`).not.toBe("");
    }
  });

  it("uses the same {placeholders} in both languages", async () => {
    const { en, sv } = await loadDictionary();
    const ph = (s: string | undefined) => (s?.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en)) expect(ph(sv[k]), k).toEqual(ph(en[k]));
  });

  it("every data-i18n key in the markup exists in the dictionary", async () => {
    const { en, html } = await loadDictionary();
    const keys = new Set<string>();
    for (const m of html.matchAll(/data-i18n="([a-z_]+)"/g)) if (m[1]) keys.add(m[1]);
    for (const m of html.matchAll(/data-i18n-attrs="([^"]+)"/g)) {
      for (const pair of (m[1] ?? "").split(",")) {
        const key = pair.split(":")[1];
        if (key) keys.add(key);
      }
    }
    expect(keys.size).toBeGreaterThan(10);
    for (const k of keys) expect(en, k).toHaveProperty(k);
  });

  it("names the language controls English / Svenska / Both", async () => {
    const { en, sv } = await loadDictionary();
    expect([en.lang_en, en.lang_sv, en.lang_both]).toEqual(["English", "Svenska", "Both"]);
    expect(sv.lang_both).toBe("Båda");
  });
});
