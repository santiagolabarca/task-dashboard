import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, createUserSession } from "@/lib/server/auth";
import { verifyGoogleCredential } from "@/lib/server/google-auth";
import { upsertGoogleUser } from "@/lib/server/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { credential?: string };
    const credential = String(body.credential || "").trim();

    if (!credential) {
      return NextResponse.json({ ok: false, error: "Missing credential" }, { status: 400 });
    }

    const verified = await verifyGoogleCredential(credential);
    const user = upsertGoogleUser(verified);
    const session = createUserSession(user.id);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Google sign-in failed" },
      { status: 401 }
    );
  }
}
