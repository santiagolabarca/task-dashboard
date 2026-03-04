import { cn } from "@/lib/cn";

type TabOption<T extends string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: TabOption<T>[];
};

export function Tabs<T extends string>({ value, onChange, options }: TabsProps<T>) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
