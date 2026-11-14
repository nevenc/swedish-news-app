import { parseArgs } from "node:util";
import { enabledSources, loadSources, SourcesConfigError } from "./config/sources.ts";

const USAGE = `Usage: npm run cli -- <command> [options]

Commands:
  sources            List configured sources
  sources --check    Validate sources.yaml and exit non-zero on error
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

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "sources":
      return sourcesCommand(rest);
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
