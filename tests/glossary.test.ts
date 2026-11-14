import { describe, expect, it } from "vitest";
import {
  GlossaryError,
  loadGlossary,
  parseGlossaryYaml,
  renderGlossary,
} from "../src/config/glossary.ts";
import { SYSTEM_PROMPT } from "../src/prompts/translate.ts";

describe("glossary", () => {
  it("repo glossary loads, has no duplicates, and renders into the prompt", () => {
    const g = loadGlossary();
    expect(g.terms.length).toBeGreaterThan(50);
    expect(g.rules.length).toBeGreaterThan(0);
    const rendered = renderGlossary(g);
    expect(rendered).toContain("Socialdemokraterna → the Social Democrats");
    expect(SYSTEM_PROMPT).toContain(rendered);
    expect(SYSTEM_PROMPT).toContain("never add a currency the source does not mention");
  });

  it("rejects duplicate terms and malformed entries", () => {
    expect(() => parseGlossaryYaml("terms:\n  - {sv: a, en: b}\n  - {sv: A, en: c}\n")).toThrow(
      GlossaryError,
    );
    expect(() => parseGlossaryYaml("terms:\n  - {sv: a}\n")).toThrow(GlossaryError);
  });

  it("renders deterministically", () => {
    const g = loadGlossary();
    expect(renderGlossary(g)).toBe(renderGlossary(g));
  });
});
