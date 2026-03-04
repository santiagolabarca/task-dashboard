import {
  AddTaskPayload,
  AddTaskResponse,
  AuthGoogleResponse,
  AuthMeResponse,
  AuthUser,
  ListTasksResponse,
  Task,
  TaskPatch,
  UpdateTaskResponse
} from "@/lib/types";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API error ${response.status}: Invalid JSON response`);
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error)
        : `API error ${response.status}`;
    throw new Error(message);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    (payload as { ok?: boolean }).ok === false
  ) {
    const message =
      "error" in payload
        ? String((payload as { error?: string }).error || "Operation failed")
        : "Operation failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function listTasks(): Promise<Task[]> {
  const response = await fetch("/api/tasks", {
    method: "GET",
    cache: "no-store"
  });

  const data = await parseJsonOrThrow<ListTasksResponse>(response);
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function addTask(payload: AddTaskPayload): Promise<AddTaskResponse> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseJsonOrThrow<AddTaskResponse>(response);
}

export async function updateTask(rowId: number, patch: TaskPatch): Promise<UpdateTaskResponse> {
  const response = await fetch(`/api/tasks/${rowId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ patch })
  });

  return parseJsonOrThrow<UpdateTaskResponse>(response);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store"
  });

  if (response.status === 401) {
    return null;
  }

  const data = await parseJsonOrThrow<AuthMeResponse>(response);
  return data.user;
}

export async function signInWithGoogle(credential: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ credential })
  });

  const data = await parseJsonOrThrow<AuthGoogleResponse>(response);
  return data.user;
}

export async function logoutUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST"
  });
  await parseJsonOrThrow<{ ok: boolean }>(response);
}
