import { SectionCard } from "@/components/ui/clinical-ui";

const WORKFLOW_OWNERS = [
  "Treating clinician",
  "Pharmacist",
  "Discharge coordinator",
  "Social worker",
  "Community-care team",
] as const;

export function AboutWorkflowPanel() {
  return (
    <SectionCard
      title="About this workflow"
      description="HeatSafe Discharge is designed for discharge coordinators and case managers at the moment destination, transport, and estimated discharge window are known — before the patient leaves."
    >
      <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-900">Primary user</p>
          <p className="mt-1">Discharge coordinator / case manager</p>
          <p className="mt-3 font-semibold text-slate-900">Value proposition</p>
          <p className="mt-1">
            Identify heat-sensitive discharges and convert environmental risk into
            owned, trackable actions before the patient transitions home.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Supporting action owners</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {WORKFLOW_OWNERS.map((owner) => (
              <li key={owner}>{owner}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            HeatSafe augments coordination — it does not replace clinician judgment,
            automatically change medications, or claim proven readmission reduction.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
