import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Copy the stream page and logo into the output directory; write CNAME when a domain is set. */
export async function buildSite(opts: {
  publicDir: string;
  appRoot: string;
  domain?: string | undefined;
}): Promise<string[]> {
  const written: string[] = [];
  if (opts.domain) {
    await writeFile(join(opts.publicDir, "CNAME"), `${opts.domain}\n`, "utf8");
    written.push("CNAME");
  }
  const index = await readFile(join(here, "templates", "index.html"), "utf8");
  await writeFile(join(opts.publicDir, "index.html"), index, "utf8");
  written.push("index.html");

  await mkdir(join(opts.publicDir, "assets"), { recursive: true });
  const logo = join(opts.appRoot, "assets", "logo");
  // Rasterized sizes come from `npm run logo` (scripts/export-logo.ts) and are committed.
  const copies: [string, string][] = [
    [join(logo, "mark.svg"), "assets/logo.svg"],
    [join(logo, "favicon.ico"), "favicon.ico"],
    [join(logo, "png", "mark-180.png"), "assets/icon-180.png"],
    [join(logo, "png", "mark-192.png"), "assets/icon-192.png"],
    [join(logo, "png", "mark-512.png"), "assets/icon-512.png"],
  ];
  for (const [from, rel] of copies) {
    await copyFile(from, join(opts.publicDir, rel));
    written.push(rel);
  }
  return written;
}
