import { TRANSPORT_MODE_LABELS } from "@/lib/transition-exposure";
import type { DischargeLocation, TransportMode } from "@/types/discharge-workflow";

type JourneySummaryProps = {
  origin: DischargeLocation;
  destination: DischargeLocation;
  transportMode: TransportMode;
  durationMinutes: number;
};

export function JourneySummary({
  origin,
  destination,
  transportMode,
  durationMinutes,
}: JourneySummaryProps) {
  const transportLabel = TRANSPORT_MODE_LABELS[transportMode];

  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
      aria-label="Journey summary"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Journey</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-800">
        <p className="font-medium">{origin.label}</p>
        <p className="text-center text-lg text-slate-400" aria-hidden>
          ↓
        </p>
        <p className="font-medium">
          {transportLabel} · {durationMinutes} min
        </p>
        <p className="text-center text-lg text-slate-400" aria-hidden>
          ↓
        </p>
        <p className="font-medium">{destination.label}</p>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Journey exposure is based on transport type and entered duration.
      </p>
    </section>
  );
}
