import { NextRequest, NextResponse } from "next/server";
import { createDbTaskForUser, listDbTasksByUser } from "@/lib/server/db";
import { computeStatusNextStep } from "@/lib/server/status";
import { getCurrentUserFromCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

function normalizeDateInput(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const ddmmyyyy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ tasks: await listDbTasksByUser(user.id) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to list tasks" },
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

    const body = (await request.json()) as {
      toDo?: string;
      statusFinalOutcome?: string;
      tipo?: string;
      nextStep?: string;
      dueDateNextStep?: string;
    };

    const toDo = String(body.toDo || "").trim();
    const statusFinalOutcome = String(body.statusFinalOutcome || "To-do").trim();
    const tipo = String(body.tipo || "Otros").trim();
    const nextStep = String(body.nextStep || "").trim();
    const dueDateNextStep = normalizeDateInput(String(body.dueDateNextStep || ""));

    if (!toDo || !dueDateNextStep) {
      return NextResponse.json(
        { ok: false, error: "toDo and dueDateNextStep (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    const statusNextStep = computeStatusNextStep(dueDateNextStep, statusFinalOutcome);

    const rowId = await createDbTaskForUser(user.id, {
      toDo,
      statusFinalOutcome,
      tipo,
      nextStep,
      dueDateNextStep,
      statusNextStep
    });

    return NextResponse.json({ ok: true, rowId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to add task" },
      { status: 500 }
    );
  }
}
