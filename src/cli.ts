import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildApi } from "./build/api.ts";
import { serveStatic } from "./build/serve.ts";
import { buildSite } from "./build/site.ts";
import { enabledSources, loadSources, SourcesConfigError } from "./config/sources.ts";
import { commitAll, push } from "./pipeline/git.ts";
import { commitMessage, ingest } from "./pipeline/ingest.ts";
import { ContentStore } from "./pipeline/store.ts";

const USAGE = `Usage: npm run cli -- <command> [options]

Commands:
  sources            List configured sources
  sources --check    Validate sources.yaml and exit non-zero on error
  ingest             Fetch all enabled feeds and write new items to the content repo
    --content <dir>    Path to the content repo checkout (default: content-repo)
    --only <keys>      Comma-separated source keys
    --dry-run          Fetch and report, write nothing
    --commit           Commit new items in the content repo
    --push             Push after committing (implies --commit)
  build              Generate public/ (static API + site) from the content repo
    --content <dir>    Path to the content repo checkout (default: content-repo)
  serve              Serve <content>/public locally for preview
    --port <n>         Port (default: 8787)
`;

async function sourcesCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      check: { type: "boolean", default: false },
      file: { type: "string", default: "sources.yaml" },
    },
  });

  let config: Awaited<ReturnType<typeof loadSources>>;
  try {
    config = await loadSources(values.file);
  } catch (err) {
    if (err instanceof SourcesConfigError) {
      console.error(`sources.yaml invalid:\n${err.message}`);
      return 1;
    }
    throw err;
  }

  const enabled = enabledSources(config);
  if (values.check) {
    console.log(`ok: ${config.sources.length} sources, ${enabled.length} enabled`);
    return 0;
  }

  for (const s of config.sources) {
    const flag = s.enabled ? "on " : "off";
    const tier = s.tier ? `t${s.tier}` : "--";
    console.log(
      `${flag} ${tier} ${s.key.padEnd(12)} ${s.name.padEnd(22)} ${s.feeds.length} feed(s)`,
    );
  }
  return 0;
}

async function ingestCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      content: { type: "string", default: "content-repo" },
      only: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      commit: { type: "boolean", default: false },
      push: { type: "boolean", default: false },
      file: { type: "string", default: "sources.yaml" },
    },
  });

  const config = await loadSources(values.file);
  const store = new ContentStore(values.content);
  const report = await ingest({
    config,
    store,
    dryRun: values["dry-run"],
    ...(values.only ? { only: values.only.split(",").map((k) => k.trim()) } : {}),
    log: (line) => console.log(line),
  });
  console.log(`total new=${report.written} (${report.startedAt} → ${report.finishedAt})`);

  if (report.allFailed) {
    console.error("every feed failed or returned nothing; refusing to continue");
    return 1;
  }
  if (values["dry-run"]) return 0;

  if (values.commit || values.push) {
    const sha = await commitAll(values.content, commitMessage(report));
    if (!sha) {
      console.log("nothing to commit");
      return 0;
    }
    console.log(`committed ${sha}`);
    if (values.push) {
      await push(values.content);
      console.log("pushed");
    }
  }
  return 0;
}

async function buildCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      content: { type: "string", default: "content-repo" },
      file: { type: "string", default: "sources.yaml" },
    },
  });
  const config = await loadSources(values.file);
  const store = new ContentStore(values.content);
  const publicDir = join(values.content, "public");
  const api = await buildApi({ store, config, publicDir });
  const site = await buildSite({ publicDir, appRoot: process.cwd() });
  console.log(
    `built ${api.files} API files (${api.articles} articles, ${api.days} days) + ${site.join(", ")}`,
  );
  return 0;
}

async function serveCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      content: { type: "string", default: "content-repo" },
      port: { type: "string", default: "8787" },
    },
  });
  const port = await serveStatic(join(values.content, "public"), Number(values.port));
  console.log(`serving ${join(values.content, "public")} at http://localhost:${port}/`);
  return new Promise(() => {}); // run until killed
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "sources":
      return sourcesCommand(rest);
    case "ingest":
      return ingestCommand(rest);
    case "build":
      return buildCommand(rest);
    case "serve":
      return serveCommand(rest);
    case undefined:
    case "help":
    case "--help":
      console.log(USAGE);
      return 0;
    default:
      console.error(`unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

process.exitCode = await main(process.argv.slice(2));
