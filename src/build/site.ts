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
  await copyFile(
    join(opts.appRoot, "assets", "logo", "mark.svg"),
    join(opts.publicDir, "assets", "logo.svg"),
  );
  written.push("assets/logo.svg");
  return written;
}
