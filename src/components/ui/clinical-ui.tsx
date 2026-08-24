import type { HeatDischargePriority } from "@/lib/heat-discharge-risk";

export const PRIORITY_STYLES: Record<
  HeatDischargePriority,
  { badge: string; ring: string; label: string; text: string }
> = {
  routine: {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
    ring: "ring-emerald-200",
    label: "Routine",
    text: "text-emerald-900",
  },
  enhanced: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    ring: "ring-amber-200",
    label: "Enhanced",
    text: "text-amber-900",
  },
  high: {
    badge: "bg-orange-100 text-orange-900 border-orange-200",
    ring: "ring-orange-200",
    label: "High",
    text: "text-orange-900",
  },
  urgent: {
    badge: "bg-red-100 text-red-900 border-red-200",
    ring: "ring-red-200",
    label: "Urgent",
    text: "text-red-900",
  },
};

export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500 disabled:opacity-70"
      />
      <span>{label}</span>
    </label>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: HeatDischargePriority | null;
}) {
  if (!priority) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
        Not assessed
      </span>
    );
  }

  const style = PRIORITY_STYLES[priority];

  return (
    <span
      className={`rounded-full border px-3 py-1 text-sm font-semibold ${style.badge}`}
    >
      {style.label}
    </span>
  );
}
