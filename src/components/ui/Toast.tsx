import { cn } from "@/lib/cn";

type ToastProps = {
  message: string;
  tone?: "success" | "error";
  visible: boolean;
};

export function Toast({ message, tone = "success", visible }: ToastProps) {
  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg",
          tone === "success" ? "bg-emerald-600" : "bg-red-600"
        )}
      >
        {message}
      </div>
    </div>
  );
}
