import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { generateKey, readKeys, revokeKey } from "openpgp";
import { createWkdResources } from "../src/modules/wkd/publication.ts";

const directory = await mkdtemp(join(tmpdir(), "entropic-wkd-test-"));
after(() => rm(directory, { recursive: true, force: true }));

const mailbox = "Joe.Doe@Example.ORG";
const generated = await generateKey({
  type: "ecc",
  curve: "ed25519Legacy",
  userIDs: [{ name: "WKD test", email: mailbox }],
  format: "object"
});
const keyPath = join(directory, "public.asc");
await writeFile(keyPath, generated.publicKey.armor());

test("a fork with no WKD configuration publishes no resources", async () => {
  assert.deepEqual(await createWkdResources({}), []);
  assert.deepEqual(await createWkdResources({ email: "", publicKeyPath: "" }), []);
});

test("partial configuration fails instead of silently publishing or disabling WKD", async () => {
  await assert.rejects(createWkdResources({ email: mailbox }), /Set both/);
  await assert.rejects(createWkdResources({ publicKeyPath: keyPath }), /Set both/);
});

test("another domain produces the protocol's reference path and its own public key", async () => {
  const resources = await createWkdResources({ email: mailbox, publicKeyPath: keyPath });
  assert.deepEqual(resources.map(({ path }) => path), [
    "example.org/policy",
    "example.org/hu/iy9q119eutrkn8s1mk4r39qejnbu3n5q"
  ]);
  assert.equal(resources[0].body.length, 0);
  assert.equal(resources[1].contentType, "application/octet-stream");
  const [key] = await readKeys({ binaryKeys: resources[1].body });
  assert.equal(key.getFingerprint(), generated.publicKey.getFingerprint());
  assert.equal(key.isPrivate(), false);
  await key.verifyPrimaryKey();
});

test("a mismatched UID and unsafe domain cannot publish the theme owner's key", async () => {
  await assert.rejects(
    createWkdResources({ email: "someone-else@example.org", publicKeyPath: keyPath }),
    /UID matching WKD_EMAIL/
  );
  for (const email of ["root@../../example.org", "root@example.org/path", "root@example.org:443", "missing-at"]) {
    await assert.rejects(createWkdResources({ email, publicKeyPath: keyPath }), /WKD_EMAIL/);
  }
});

test("private key exports are rejected in armored and binary form", async () => {
  for (const [name, body] of [
    ["private.asc", generated.privateKey.armor()],
    ["private.gpg", generated.privateKey.write()]
  ]) {
    const path = join(directory, name);
    await writeFile(path, body);
    await assert.rejects(createWkdResources({ email: mailbox, publicKeyPath: path }), /private key/i);
  }
});

test("malformed and concatenated armor fail rather than being partly accepted", async () => {
  const malformed = join(directory, "malformed.asc");
  await writeFile(malformed, "not an OpenPGP key");
  await assert.rejects(createWkdResources({ email: mailbox, publicKeyPath: malformed }));
  await writeFile(malformed, generated.publicKey.armor() + generated.privateKey.armor());
  await assert.rejects(createWkdResources({ email: mailbox, publicKeyPath: malformed }), /public key export/);
});

test("revocation records survive publication", async () => {
  const revoked = await revokeKey({ key: generated.privateKey, format: "object" });
  const revokedPath = join(directory, "revoked.asc");
  await writeFile(revokedPath, revoked.publicKey.armor());
  const resources = await createWkdResources({ email: mailbox, publicKeyPath: revokedPath });
  const [key] = await readKeys({ binaryKeys: resources[1].body });
  assert.equal(await key.isRevoked(), true);
});

test("expired public keys remain publishable as required by WKD", async () => {
  const expired = await generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ email: mailbox }],
    date: new Date("2020-01-01T00:00:00Z"),
    keyExpirationTime: 60,
    format: "object"
  });
  const expiredPath = join(directory, "expired.asc");
  await writeFile(expiredPath, expired.publicKey.armor());
  const resources = await createWkdResources({ email: mailbox, publicKeyPath: expiredPath });
  const [key] = await readKeys({ binaryKeys: resources[1].body });
  assert.equal(key.getFingerprint(), expired.publicKey.getFingerprint());
  await assert.rejects(key.verifyPrimaryKey(), /expired/i);
});

test("replacing the public key updates bytes without changing the mailbox URL", async () => {
  const path = join(directory, "rotating.asc");
  await writeFile(path, await readFile(keyPath));
  const before = await createWkdResources({ email: mailbox, publicKeyPath: path });
  const replacement = await generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ email: mailbox }],
    format: "object"
  });
  await writeFile(path, replacement.publicKey.armor());
  const updated = await createWkdResources({ email: mailbox, publicKeyPath: path });
  assert.equal(updated[1].path, before[1].path);
  assert.notDeepEqual(updated[1].body, before[1].body);
  const [key] = await readKeys({ binaryKeys: updated[1].body });
  assert.equal(key.getFingerprint(), replacement.publicKey.getFingerprint());
});
