export const STATUS_FINAL_OUTCOME_OPTIONS = [
  "To-do",
  "On-going",
  "Done",
  "On hold"
] as const;

export const TIPO_OPTIONS = [
  "Otros",
  "Recruiting",
  "S3",
  "Clases",
  "Finanzas",
  "Personal"
] as const;

export type StatusFinalOutcome = (typeof STATUS_FINAL_OUTCOME_OPTIONS)[number];
export type Tipo = (typeof TIPO_OPTIONS)[number];

export type Task = {
  rowId: number;
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  statusNextStep: string;
};

export type AddTaskPayload = Omit<Task, "rowId">;

export type TaskPatch = Partial<Omit<Task, "rowId">>;

export type ListTasksResponse = {
  tasks: Task[];
};

export type AddTaskResponse = {
  ok: boolean;
  rowId: number;
};

export type UpdateTaskResponse = {
  ok: boolean;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
};

export type AuthMeResponse = {
  ok: boolean;
  user: AuthUser | null;
};

export type AuthGoogleResponse = {
  ok: boolean;
  user: AuthUser;
};
