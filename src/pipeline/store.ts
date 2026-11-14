import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Article, articleSchema, serializeArticle } from "../model/article.ts";
import { stockholmDate } from "../util/time.ts";
import type { FeedState } from "./fetch.ts";

/**
 * The content repository on disk:
 *   content/YYYY/MM/DD/<id>.json   one file per article
 *   state/feeds.json               per-feed ETag / Last-Modified cache
 */
export class ContentStore {
  readonly root: string;
  readonly contentDir: string;
  readonly stateDir: string;

  constructor(root: string) {
    this.root = root;
    this.contentDir = join(root, "content");
    this.stateDir = join(root, "state");
  }

  /** Relative path of an article's file, derived from its Stockholm publish date. */
  static relativePath(article: Article): string {
    const { year, month, day } = stockholmDate(new Date(article.published_at));
    return join("content", year, month, day, `${article.id}.json`);
  }

  /** All article ids currently stored. Walks the whole tree; cheap at this scale. */
  async knownIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    let entries: string[];
    try {
      entries = await readdir(this.contentDir, { recursive: true, encoding: "utf8" });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return ids;
      throw err;
    }
    for (const name of entries) {
      const file = name.split("/").pop() ?? "";
      if (/^[0-9a-f]{12}\.json$/.test(file)) ids.add(file.slice(0, 12));
    }
    return ids;
  }

  async write(article: Article): Promise<string> {
    articleSchema.parse(article);
    const rel = ContentStore.relativePath(article);
    const abs = join(this.root, rel);
    await mkdir(join(abs, ".."), { recursive: true });
    const tmp = `${abs}.tmp`;
    await writeFile(tmp, serializeArticle(article), "utf8");
    await rename(tmp, abs);
    return rel;
  }

  async readFeedStates(): Promise<Record<string, FeedState>> {
    try {
      const text = await readFile(join(this.stateDir, "feeds.json"), "utf8");
      return JSON.parse(text) as Record<string, FeedState>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  async writeFeedStates(states: Record<string, FeedState>): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    const sorted = Object.fromEntries(
      Object.entries(states).sort(([a], [b]) => a.localeCompare(b)),
    );
    await writeFile(
      join(this.stateDir, "feeds.json"),
      `${JSON.stringify(sorted, null, 2)}\n`,
      "utf8",
    );
  }
}
