"use client";

import { useState } from "react";

import { SectionCard } from "@/components/ui/clinical-ui";
import type { HeatRiskAssessmentResponse } from "@/types/heat-risk-api";

type EnvironmentalExposurePanelProps = {
  assessment: HeatRiskAssessmentResponse;
  assessedAt: string | null;
};

export function EnvironmentalExposurePanel({
  assessment,
  assessedAt,
}: EnvironmentalExposurePanelProps) {
  const [showProvenance, setShowProvenance] = useState(false);
  const env = assessment.destinationEnvironmental;

  if (!env) {
    return null;
  }

  const sourceLabel =
    env.environmentalProvenance === "verified_historical"
      ? "Verified historical result"
      : "Live completed result";

  return (
    <SectionCard title="Environmental exposure">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-lg font-semibold text-slate-900">{env.label}</p>
          <p className="mt-1 text-slate-700">
            Arrival window: {env.fortyGuardQueryWindowLocal}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {env.meanTemperatureC} °C
            <span className="ml-2 text-sm font-normal text-slate-500">mean at destination</span>
          </p>
        </div>

        <p className="text-slate-600">
          Source: FortyGuard · {sourceLabel}
        </p>

        <button
          type="button"
          onClick={() => setShowProvenance((current) => !current)}
          className="min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {showProvenance ? "Hide provenance" : "View provenance"}
        </button>

        {showProvenance ? (
          <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
            {assessedAt ? (
              <div>
                <dt className="font-medium text-slate-900">Assessed</dt>
                <dd>{new Date(assessedAt).toLocaleString()}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-slate-900">Departure</dt>
              <dd>{env.departureDateTimeLocal.display}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Estimated arrival</dt>
              <dd>{env.estimatedArrivalDateTimeLocal.display}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Peak / min</dt>
              <dd>
                {env.maximumTemperatureC} °C / {env.minimumTemperatureC ?? "—"} °C
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Activity ID</dt>
              <dd className="break-all font-mono text-xs">{env.fortyGuardActivityId}</dd>
            </div>
            {env.environmentalProvenanceNote ? (
              <div>
                <dt className="font-medium text-slate-900">Note</dt>
                <dd>{env.environmentalProvenanceNote}</dd>
              </div>
            ) : null}
            {assessment.transitionEnvironmental ? (
              <div>
                <dt className="font-medium text-slate-900">Journey</dt>
                <dd>
                  {assessment.transitionEnvironmental.transportLabel} ·{" "}
                  {assessment.transitionEnvironmental.durationMinutes} min (coordinator-entered)
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </SectionCard>
  );
}
