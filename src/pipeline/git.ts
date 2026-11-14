import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

export async function hasChanges(cwd: string): Promise<boolean> {
  return (await git(cwd, "status", "--porcelain")) !== "";
}

/** Stage everything and commit. Returns the short SHA, or undefined if nothing changed. */
export async function commitAll(cwd: string, message: string): Promise<string | undefined> {
  if (!(await hasChanges(cwd))) return undefined;
  await git(cwd, "add", "-A");
  await git(cwd, "commit", "-q", "-m", message);
  return git(cwd, "rev-parse", "--short", "HEAD");
}

export async function push(cwd: string): Promise<void> {
  await git(cwd, "push", "-q");
}
