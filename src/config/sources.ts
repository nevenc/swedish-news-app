import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod";

export const CATEGORIES = [
  "general",
  "politics",
  "economy",
  "world",
  "sweden",
  "sports",
  "culture",
  "science_tech",
  "crime",
  "weather",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

const feedSchema = z.object({
  url: z.url(),
  category: z.enum(CATEGORIES).default("general"),
});

const sourceSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/, "key must be lowercase letters, digits, or hyphens"),
  name: z.string().min(1),
  homepage: z.url(),
  tier: z.union([z.literal(1), z.literal(2)]).optional(),
  enabled: z.boolean().default(true),
  paywall: z.enum(["none", "partial", "hard"]).optional(),
  language: z.string().length(2).optional(),
  max_summary_chars: z.number().int().positive().optional(),
  feeds: z.array(feedSchema),
  /** Regular expressions (case-insensitive); entries whose title matches are dropped. */
  exclude_title_patterns: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const defaultsSchema = z.object({
  language: z.string().length(2).default("sv"),
  max_summary_chars: z.number().int().positive().default(300),
  user_agent: z.string().min(1),
});

const fileSchema = z.object({
  defaults: defaultsSchema,
  sources: z.array(sourceSchema),
});

export type SourceConfig = z.infer<typeof sourceSchema>;
export type SourcesFile = z.infer<typeof fileSchema>;

/** A source with defaults applied; this is what the pipeline consumes. */
export interface Source {
  key: string;
  name: string;
  homepage: string;
  tier: 1 | 2 | undefined;
  enabled: boolean;
  paywall: "none" | "partial" | "hard" | undefined;
  language: string;
  maxSummaryChars: number;
  feeds: { url: string; category: Category }[];
  excludeTitlePatterns: string[];
  notes: string | undefined;
}

export interface SourcesConfig {
  userAgent: string;
  sources: Source[];
}

export class SourcesConfigError extends Error {
  override name = "SourcesConfigError";
}

export function parseSourcesYaml(text: string): SourcesConfig {
  const raw: unknown = parse(text);
  const result = fileSchema.safeParse(raw);
  if (!result.success) {
    throw new SourcesConfigError(z.prettifyError(result.error));
  }
  const { defaults, sources } = result.data;

  const seen = new Set<string>();
  for (const s of sources) {
    if (seen.has(s.key)) {
      throw new SourcesConfigError(`duplicate source key: ${s.key}`);
    }
    seen.add(s.key);
    if (s.enabled && s.feeds.length === 0) {
      throw new SourcesConfigError(`enabled source has no feeds: ${s.key}`);
    }
    for (const pattern of s.exclude_title_patterns) {
      try {
        new RegExp(pattern, "i");
      } catch {
        throw new SourcesConfigError(
          `invalid exclude_title_patterns regex in ${s.key}: ${pattern}`,
        );
      }
    }
  }

  return {
    userAgent: defaults.user_agent,
    sources: sources.map((s) => ({
      key: s.key,
      name: s.name,
      homepage: s.homepage,
      tier: s.tier,
      enabled: s.enabled,
      paywall: s.paywall,
      language: s.language ?? defaults.language,
      maxSummaryChars: s.max_summary_chars ?? defaults.max_summary_chars,
      feeds: s.feeds,
      excludeTitlePatterns: s.exclude_title_patterns,
      notes: s.notes,
    })),
  };
}

export async function loadSources(path = "sources.yaml"): Promise<SourcesConfig> {
  const text = await readFile(path, "utf8");
  return parseSourcesYaml(text);
}

export function enabledSources(config: SourcesConfig): Source[] {
  return config.sources.filter((s) => s.enabled);
}
