"use client";

import { buildPreparedCaseSections } from "@/lib/prepared-case-display";
import type { DischargeRecord } from "@/types/discharge-workflow";

type PreparedCaseSummaryProps = {
  record: DischargeRecord;
};

export function PreparedCaseSummary({ record }: PreparedCaseSummaryProps) {
  const sections = buildPreparedCaseSections(record);

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      aria-label="Prepared discharge summary"
    >
      <h2 className="text-lg font-bold text-slate-900">Prepared discharge review</h2>
      <p className="mt-1 text-sm text-slate-600">
        Synthetic case · review before running assessment.
      </p>
      <dl className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </dt>
            <dd className="mt-1 space-y-0.5 text-sm text-slate-800">
              {section.items.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
