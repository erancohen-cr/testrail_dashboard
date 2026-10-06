import { cookies } from "next/headers";
import { COOKIE, encrypt, getCreds } from "@/lib/creds";
import { handle } from "@/lib/http";
import { tr } from "@/lib/testrail";

export async function GET() {
  return handle(async () => {
    const c = await getCreds();
    return { personal: c.personal, email: c.email, url: c.url };
  });
}

/** Test personal credentials against TestRail, then store them encrypted in an httpOnly cookie. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const url = String(body.url ?? "").trim().replace(/\/$/, "");
    const email = String(body.email ?? "").trim();
    let key = String(body.key ?? "").trim();
    if (!/^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(url) || !email) {
      return Response.json({ error: "A valid https TestRail address and email are required" }, { status: 400 });
    }
    if (!key) {
      const cur = await getCreds(); // keep the saved key when only url/email changed
      if (!cur.personal) return Response.json({ error: "API key is required" }, { status: 400 });
      key = cur.key;
    }
    const creds = { url, email, key };
    const user = await tr(creds, "get_user_by_email", { email }, true);
    (await cookies()).set(COOKIE, encrypt(creds), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return { personal: true, email, url, name: user.name };
  });
}

export async function DELETE() {
  return handle(async () => {
    (await cookies()).delete(COOKIE);
    const c = await getCreds();
    return { personal: false, email: c.email, url: c.url };
  });
}
