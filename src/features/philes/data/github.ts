import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhileCredit } from "../model";
import type { GitPerson } from "./git-history";

type Cached = { value: unknown; fetchedAt: number };
const requests = new Map<string, { until: number; value: Promise<unknown> }>();
const lifetime = 24 * 60 * 60 * 1000;
const cacheDirectory = path.join(process.cwd(), ".cache", "github-credits");

export function githubCredit(account: { login: string; name?: string | null }): PhileCredit {
  return {
    login: account.login,
    name: account.name?.replace(/\s+/g, " ").trim() || account.login,
    href: `https://github.com/${encodeURIComponent(account.login)}`
  };
}

export function githubLogin(email: string): string | undefined {
  return /^(?:\d+\+)?([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)@users\.noreply\.github\.com$/i.exec(email)?.[1];
}

export async function resolveGitPerson(person: GitPerson, repository?: string): Promise<PhileCredit> {
  let login = githubLogin(person.email);
  if (!login && person.primary && repository) {
    const commit = await githubJson(`repos/${repository}/commits/${person.commit}`);
    if (isRecord(commit) && isRecord(commit.author) && typeof commit.author.login === "string") {
      login = commit.author.login;
    }
  }
  if (!login) return { name: person.name };

  const account = await githubJson(`users/${encodeURIComponent(login.toLowerCase())}`);
  return isRecord(account) &&
    typeof account.login === "string" &&
    (typeof account.name === "string" || account.name === null)
    ? githubCredit({ login: account.login, name: account.name })
    : githubCredit({ login });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function githubJson(endpoint: string): Promise<unknown> {
  const existing = requests.get(endpoint);
  if (existing && existing.until > Date.now()) return existing.value;
  // Share profile requests across every article, including an offline result.
  const request = loadJson(endpoint);
  requests.set(endpoint, { until: Date.now() + lifetime, value: request });
  return request;
}

async function loadJson(endpoint: string): Promise<unknown> {
  const filename = path.join(cacheDirectory, `${encodeURIComponent(endpoint)}.json`);
  let cached: Cached | undefined;
  try {
    cached = JSON.parse(await readFile(filename, "utf8"));
    // Builds refresh profiles once, then bake them into HTML. Disk data is the
    // offline fallback; dev requests can reuse it without hitting GitHub again.
    if (cached && !import.meta.env?.PROD && Date.now() - cached.fetchedAt < lifetime) return cached.value;
  } catch {
    // A fresh checkout has no cached GitHub identities.
  }
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10"
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(`https://api.github.com/${endpoint}`, { headers, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return cached?.value;
    const value: unknown = await response.json();
    try {
      await mkdir(cacheDirectory, { recursive: true });
      await writeFile(filename, `${JSON.stringify({ value, fetchedAt: Date.now() })}\n`);
    } catch {
      // A read-only cache must not discard a successful response.
    }
    return value;
  } catch {
    return cached?.value;
  }
}
