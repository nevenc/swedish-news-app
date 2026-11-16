import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourcesConfig } from "../config/sources.ts";
import { enabledSources } from "../config/sources.ts";

const here = dirname(fileURLToPath(import.meta.url));

const PAYWALL_NOTE = {
  en: {
    partial: "some articles require a subscription",
    hard: "most articles require a subscription",
  },
  sv: {
    partial: "vissa artiklar kräver prenumeration",
    hard: "de flesta artiklar kräver prenumeration",
  },
} as const;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Publisher list for the About page, rendered from sources.yaml so it cannot drift from the feed. */
export function renderPublishers(config: SourcesConfig, locale: "en" | "sv"): string {
  const items = enabledSources(config).map((s) => {
    const note = s.paywall && s.paywall !== "none" ? PAYWALL_NOTE[locale][s.paywall] : undefined;
    const suffix = note ? ` <span class="muted">(${note})</span>` : "";
    return `<li><a href="${esc(s.homepage)}" rel="noopener">${esc(s.name)}</a>${suffix}</li>`;
  });
  return `<ul class="pubs">\n${items.join("\n")}\n</ul>`;
}

/** Footer version, placed before the About link: package version plus the short commit when known; empty when no version is given. */
export function renderVersion(
  v: { version: string; commit?: string | undefined } | undefined,
): string {
  if (!v) return "";
  const commit = v.commit ? ` · ${esc(v.commit.slice(0, 7))}` : "";
  return `<span class="version">v${esc(v.version)}${commit}</span> · `;
}

/** Copy the stream page, About page and logo assets into the output directory; write CNAME when a domain is set. */
export async function buildSite(opts: {
  publicDir: string;
  appRoot: string;
  domain?: string | undefined;
  config?: SourcesConfig | undefined;
  /** Shown in every footer, e.g. { version: "0.1.0", commit: "3ee85ea" }. */
  version?: { version: string; commit?: string | undefined } | undefined;
}): Promise<string[]> {
  const written: string[] = [];
  const stamp = (html: string) => html.replace("<!--VERSION-->", renderVersion(opts.version));
  if (opts.domain) {
    await writeFile(join(opts.publicDir, "CNAME"), `${opts.domain}\n`, "utf8");
    written.push("CNAME");
  }
  const index = stamp(await readFile(join(here, "templates", "index.html"), "utf8"));
  await writeFile(join(opts.publicDir, "index.html"), index, "utf8");
  written.push("index.html");

  let about = stamp(await readFile(join(here, "templates", "about.html"), "utf8"));
  for (const locale of ["en", "sv"] as const) {
    const list = opts.config
      ? renderPublishers(opts.config, locale)
      : `<p class="muted">${locale === "sv" ? "Publicistlistan är inte tillgänglig." : "Publisher list unavailable."}</p>`;
    about = about.replace(`<!--PUBLISHERS:${locale}-->`, list);
  }
  await mkdir(join(opts.publicDir, "about"), { recursive: true });
  await writeFile(join(opts.publicDir, "about", "index.html"), about, "utf8");
  written.push("about/index.html");

  const privacy = stamp(await readFile(join(here, "templates", "privacy.html"), "utf8"));
  await mkdir(join(opts.publicDir, "privacy"), { recursive: true });
  await writeFile(join(opts.publicDir, "privacy", "index.html"), privacy, "utf8");
  written.push("privacy/index.html");

  await mkdir(join(opts.publicDir, "assets"), { recursive: true });
  const logo = join(opts.appRoot, "assets", "logo");
  // Rasterized sizes come from `npm run logo` / `npm run cover` (scripts/) and are committed.
  const copies: [string, string][] = [
    [join(logo, "mark.svg"), "assets/logo.svg"],
    [join(logo, "favicon.ico"), "favicon.ico"],
    [join(logo, "png", "mark-180.png"), "assets/icon-180.png"],
    [join(logo, "png", "mark-192.png"), "assets/icon-192.png"],
    [join(logo, "png", "mark-512.png"), "assets/icon-512.png"],
    [join(opts.appRoot, "assets", "social", "og-1200x630.png"), "assets/og.png"],
    // Self-hosted typeface (SIL OFL; licence shipped alongside), so no font service is contacted.
    [
      join(opts.appRoot, "assets", "fonts", "manrope", "Manrope[wght].ttf"),
      "assets/fonts/manrope.ttf",
    ],
    [join(opts.appRoot, "assets", "fonts", "manrope", "OFL.txt"), "assets/fonts/OFL.txt"],
  ];
  await mkdir(join(opts.publicDir, "assets", "fonts"), { recursive: true });
  for (const [from, rel] of copies) {
    await copyFile(from, join(opts.publicDir, rel));
    written.push(rel);
  }
  return written;
}
