export function computeStatusNextStep(dueDateIso: string, statusFinalOutcome: string): string {
  if (!dueDateIso) return "No due date";
  if (statusFinalOutcome === "Done") return "Done";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [year, month, day] = dueDateIso.split("-").map(Number);
  const due = new Date(year, (month || 1) - 1, day || 1);

  const msPerDay = 24 * 60 * 60 * 1000;
  const deltaDays = Math.floor((due.getTime() - today.getTime()) / msPerDay);

  if (deltaDays < 0) return "Too late";
  if (deltaDays === 0) return "Late";
  if (deltaDays <= 1) return "Really near to expire";
  if (deltaDays <= 3) return "Near to expire";
  if (deltaDays <= 7) return "On track";
  return "Safe";
}
