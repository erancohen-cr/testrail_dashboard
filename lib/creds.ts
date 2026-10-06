import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Creds } from "./testrail";

export const COOKIE = "tr_creds";

function secret() {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET is not set");
  return createHash("sha256").update(s).digest();
}

export function encrypt(c: Creds): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(c), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function decrypt(blob: string): Creds | null {
  try {
    const buf = Buffer.from(blob, "base64url");
    const d = createDecipheriv("aes-256-gcm", secret(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export function readonlyCreds(): Creds {
  const { TESTRAIL_URL: url, TESTRAIL_RO_EMAIL: email, TESTRAIL_RO_KEY: key } = process.env;
  if (!url || !email || !key) throw new Error("Readonly TestRail account is not configured on the server");
  return { url, email, key };
}

/** Personal creds from the encrypted cookie, else the shared readonly account. */
export async function getCreds(): Promise<Creds & { personal: boolean }> {
  const blob = (await cookies()).get(COOKIE)?.value;
  const personal = blob ? decrypt(blob) : null;
  return personal ? { ...personal, personal: true } : { ...readonlyCreds(), personal: false };
}
