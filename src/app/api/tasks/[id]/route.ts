import { NextRequest, NextResponse } from "next/server";
import { getDbTaskByIdForUser, updateDbTaskForUser } from "@/lib/server/db";
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

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(context.params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      patch?: Partial<{
        toDo: string;
        statusFinalOutcome: string;
        tipo: string;
        nextStep: string;
        dueDateNextStep: string;
      }>;
    };

    const patch = body.patch || {};
    const existing = await getDbTaskByIdForUser(id, user.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const merged = {
      toDo: patch.toDo !== undefined ? String(patch.toDo).trim() : existing.toDo,
      statusFinalOutcome:
        patch.statusFinalOutcome !== undefined
          ? String(patch.statusFinalOutcome).trim()
          : existing.statusFinalOutcome,
      tipo: patch.tipo !== undefined ? String(patch.tipo).trim() : existing.tipo,
      nextStep: patch.nextStep !== undefined ? String(patch.nextStep).trim() : existing.nextStep,
      dueDateNextStep:
        patch.dueDateNextStep !== undefined
          ? normalizeDateInput(String(patch.dueDateNextStep || "")) || existing.dueDateNextStep
          : existing.dueDateNextStep
    };

    merged.toDo = merged.toDo || existing.toDo;
    merged.statusFinalOutcome = merged.statusFinalOutcome || existing.statusFinalOutcome;
    merged.tipo = merged.tipo || existing.tipo;

    const statusNextStep = computeStatusNextStep(merged.dueDateNextStep, merged.statusFinalOutcome);

    const updated = await updateDbTaskForUser(id, user.id, { ...merged, statusNextStep });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update task" },
      { status: 500 }
    );
  }
}
