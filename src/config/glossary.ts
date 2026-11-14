import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const termSchema = z.object({
  sv: z.string().min(1),
  en: z.string().min(1),
  note: z.string().optional(),
});

const glossarySchema = z.object({
  rules: z.array(z.string().min(1)).default([]),
  terms: z.array(termSchema),
});

export type Glossary = z.infer<typeof glossarySchema>;

export class GlossaryError extends Error {
  override name = "GlossaryError";
}

export function parseGlossaryYaml(text: string): Glossary {
  const result = glossarySchema.safeParse(parse(text));
  if (!result.success) throw new GlossaryError(z.prettifyError(result.error));
  const seen = new Set<string>();
  for (const t of result.data.terms) {
    const key = t.sv.toLowerCase();
    if (seen.has(key)) throw new GlossaryError(`duplicate glossary term: ${t.sv}`);
    seen.add(key);
  }
  return result.data;
}

export function loadGlossary(path = "glossary.yaml"): Glossary {
  return parseGlossaryYaml(readFileSync(path, "utf8"));
}

/** Deterministic plain-text rendering for the system prompt; stable output keeps prompt caching effective. */
export function renderGlossary(g: Glossary): string {
  const lines: string[] = [];
  if (g.rules.length) {
    lines.push("Glossary rules");
    for (const r of g.rules) lines.push(`- ${r}`);
    lines.push("");
  }
  lines.push("Glossary (Swedish → English; use these renderings consistently)");
  for (const t of g.terms) {
    lines.push(`- ${t.sv} → ${t.en}${t.note ? ` (${t.note})` : ""}`);
  }
  return lines.join("\n");
}
