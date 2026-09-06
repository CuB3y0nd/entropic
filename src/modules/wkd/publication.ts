import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { domainToASCII } from "node:url";
import { readKeys } from "openpgp";

type WkdOptions = {
  email?: string;
  publicKeyPath?: string;
};

export type WkdResource = {
  path: string;
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
};

function parseEmail(value: string) {
  const parts = value.trim().split("@");
  const localPart = parts[0]?.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  const domain = parts.length === 2 ? domainToASCII(parts[1]).toLowerCase() : "";
  const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  if (!localPart || /[\s<>"\\]/u.test(localPart) || domain.length > 253 || !domainPattern.test(domain)) {
    throw new Error("WKD_EMAIL must be an unquoted email address with a valid public DNS domain.");
  }

  return { localPart, domain, email: `${localPart}@${domain}` };
}

function hashLocalPart(localPart: string) {
  // WKD requires SHA-1 followed by z-base-32 for the lookup filename.
  const alphabet = "ybndrfg8ejkmcpqxot1uwisza345h769";
  const digest = createHash("sha1").update(localPart, "utf8").digest();
  let bits = 0;
  let value = 0;
  let result = "";

  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }

  return result;
}

export async function createWkdResources(options: WkdOptions): Promise<WkdResource[]> {
  const email = options.email?.trim();
  const publicKeyPath = options.publicKeyPath?.trim();
  if (!email && !publicKeyPath) return [];
  if (!email || !publicKeyPath) {
    throw new Error("Set both WKD_EMAIL and WKD_PUBLIC_KEY_PATH to enable WKD, or leave both unset.");
  }

  const mailbox = parseEmail(email);
  const file = await stat(publicKeyPath);
  if (!file.isFile() || file.size > 1024 * 1024) {
    throw new Error("WKD_PUBLIC_KEY_PATH must reference a regular public key file no larger than 1 MiB.");
  }
  const input = await readFile(publicKeyPath);
  if (input.length > 1024 * 1024) throw new Error("WKD public key input must not exceed 1 MiB.");

  const text = input.toString("utf8").trim();
  const armored = text.startsWith("-----BEGIN PGP");
  if (
    armored &&
    (!text.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----") ||
      !text.endsWith("-----END PGP PUBLIC KEY BLOCK-----") ||
      (text.match(/-----BEGIN PGP/g)?.length ?? 0) !== 1)
  ) {
    throw new Error("WKD requires a public key export in a single armor block; never provide a private key.");
  }

  const config = { ignoreUnsupportedPackets: false, ignoreMalformedPackets: false };
  const keys = armored ? await readKeys({ armoredKeys: text, config }) : await readKeys({ binaryKeys: input, config });
  if (!keys.length) throw new Error("WKD public key input contains no keys.");

  const publicKeys = keys.map((key) => {
    if (key.isPrivate()) throw new Error("WKD refuses private keys; export the public key instead.");
    const matches = key.users.some((user) => {
      if (!user.userID?.email) return false;
      try {
        return parseEmail(user.userID.email).email === mailbox.email;
      } catch {
        return false;
      }
    });
    if (!matches) throw new Error("Every WKD public key must contain a UID matching WKD_EMAIL.");

    // Retain certificates and revocations. WKD also distributes expired/revoked
    // keys; clients decide whether a retrieved key is usable.
    return key.toPublic().write();
  });

  return [
    {
      path: `${mailbox.domain}/policy`,
      body: new Uint8Array(),
      contentType: "text/plain; charset=utf-8"
    },
    {
      path: `${mailbox.domain}/hu/${hashLocalPart(mailbox.localPart)}`,
      body: new Uint8Array(Buffer.concat(publicKeys)),
      contentType: "application/octet-stream"
    }
  ];
}
