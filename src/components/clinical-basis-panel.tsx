"use client";

import {
  ACTION_METHODOLOGY,
  CLINICAL_METHODOLOGY_DISCLAIMER,
  CLINICAL_METHODOLOGY_SUMMARY,
  CLINICAL_SOURCES,
  FACTOR_METHODOLOGY,
} from "@/lib/clinical-methodology";

export function ClinicalBasisPanel() {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          Clinical basis &amp; methodology
          <span className="text-xs font-normal text-sky-700 group-open:hidden">
            Expand
          </span>
          <span className="hidden text-xs font-normal text-sky-700 group-open:inline">
            Collapse
          </span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
        <p>{CLINICAL_METHODOLOGY_SUMMARY}</p>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          {CLINICAL_METHODOLOGY_DISCLAIMER}
        </p>

        <div>
          <h3 className="font-semibold text-slate-900">Authoritative sources</h3>
          <ul className="mt-2 space-y-1">
            {Object.values(CLINICAL_SOURCES).map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-800 hover:underline"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">Included vulnerability factors</h3>
          <ul className="mt-2 space-y-3">
            {FACTOR_METHODOLOGY.map((entry) => (
              <li
                key={entry.factorOrAction}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="font-medium text-slate-900">{entry.factorOrAction}</p>
                <p className="mt-1">{entry.whyIncluded}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Supports: {entry.supports}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Does not validate: {entry.doesNotSupport}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">Action categories</h3>
          <ul className="mt-2 space-y-3">
            {ACTION_METHODOLOGY.map((entry) => (
              <li
                key={entry.factorOrAction}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="font-medium text-slate-900">{entry.factorOrAction}</p>
                <p className="mt-1">{entry.whyIncluded}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
