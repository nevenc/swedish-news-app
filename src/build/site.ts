import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Copy the stream page and logo into the public directory. */
export async function buildSite(opts: { publicDir: string; appRoot: string }): Promise<string[]> {
  const written: string[] = [];
  const index = await readFile(join(here, "templates", "index.html"), "utf8");
  await writeFile(join(opts.publicDir, "index.html"), index, "utf8");
  written.push("index.html");

  await mkdir(join(opts.publicDir, "assets"), { recursive: true });
  await copyFile(
    join(opts.appRoot, "assets", "logo", "mark-a-headlines.svg"),
    join(opts.publicDir, "assets", "logo.svg"),
  );
  written.push("assets/logo.svg");
  return written;
}
