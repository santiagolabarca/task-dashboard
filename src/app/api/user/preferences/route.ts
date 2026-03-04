import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { getUserPreferencesByUserId, saveUserPreferencesByUserId } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getUserPreferencesByUserId(user.id);
    return NextResponse.json(preferences);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { tipoOptions?: unknown };
    const tipoOptions = Array.isArray(body.tipoOptions)
      ? body.tipoOptions.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    if (tipoOptions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one task type is required" },
        { status: 400 }
      );
    }

    const preferences = await saveUserPreferencesByUserId(user.id, tipoOptions);
    return NextResponse.json(preferences);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save preferences" },
      { status: 500 }
    );
  }
}
