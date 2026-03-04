import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  DbUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  getUserBySessionToken
} from "@/lib/server/db";

export const SESSION_COOKIE_NAME = "taskdash_session";
const SESSION_DAYS = 15;

export function getSessionExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DAYS);
  return expiry;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
}

export function createUserSession(userId: number): { token: string; expiresAt: Date } {
  deleteExpiredSessions();
  const expiresAt = getSessionExpiryDate();
  const token = createSession(userId, expiresAt);
  return { token, expiresAt };
}

export function destroyCurrentSession(token: string | undefined): void {
  if (!token) return;
  deleteSession(token);
}

export function getCurrentUserFromCookies(): DbUser | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

export function getCurrentSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}
