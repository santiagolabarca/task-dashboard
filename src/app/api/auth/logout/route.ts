import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroyCurrentSession,
  getCurrentSessionToken
} from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const token = getCurrentSessionToken();
  await destroyCurrentSession(token);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
