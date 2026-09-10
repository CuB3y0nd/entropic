import type { PhileCredit } from "../model";
import { type GitPerson, githubRepository, readGitHistory } from "./git-history";
import { resolveGitPerson } from "./github";

export async function getPhileCredits(files: readonly string[]): Promise<Map<string, readonly PhileCredit[]>> {
  const [history, repository] = await Promise.all([readGitHistory(files), githubRepository()]);
  const identities = new Map<string, GitPerson>();
  for (const people of history.values()) {
    for (const person of people) {
      const key = person.email.toLowerCase();
      const existing = identities.get(key);
      if (!existing || (!existing.primary && person.primary)) identities.set(key, person);
    }
  }
  const pending = identities.entries();
  const profiles = new Map<string, PhileCredit>();
  const worker = async () => {
    for (const [email, person] of pending) {
      profiles.set(email, await resolveGitPerson(person, repository));
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, identities.size) }, worker));
  const credits = new Map<string, readonly PhileCredit[]>();
  for (const [file, people] of history) {
    const resolved: PhileCredit[] = [];
    const seen = new Set<string>();
    for (const person of people) {
      const email = person.email.toLowerCase();
      const profile = profiles.get(email);
      if (!profile) continue;
      const key = profile.login?.toLowerCase() ?? email;
      if (!seen.has(key)) {
        seen.add(key);
        resolved.push(profile);
      }
    }
    credits.set(file, resolved);
  }
  return credits;
}
