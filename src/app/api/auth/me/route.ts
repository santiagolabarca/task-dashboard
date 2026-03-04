import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
}
