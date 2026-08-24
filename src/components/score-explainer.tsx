import {
  SCORE_EXPLAINER_DISCLAIMER,
  groupContributionsByCategory,
} from "@/lib/heat-discharge-risk";
import type { ScoreContribution } from "@/lib/heat-discharge-risk";

const CATEGORY_LABELS = {
  environmental: "Environmental",
  clinical: "Clinical",
  homeSupport: "Home / support",
} as const;

type ScoreExplainerProps = {
  score: number;
  rawScore: number;
  contributions: ScoreContribution[];
};

export function ScoreExplainer({
  score,
  rawScore,
  contributions,
}: ScoreExplainerProps) {
  const sections = groupContributionsByCategory(contributions);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">
          Why {score}? Transparent contribution breakdown
        </p>
        <p className="mt-1">{SCORE_EXPLAINER_DISCLAIMER}</p>
      </div>

      {sections.map((section) => (
        <div key={section.category}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[section.category]}
          </h3>
          <ul className="mt-2 space-y-2">
            {section.contributions.map((contribution) => (
              <li
                key={contribution.id}
                className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    +{contribution.points} {contribution.label}
                  </p>
                  <p className="mt-0.5 text-slate-600">{contribution.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-sm font-medium text-slate-900">
        Raw workflow score: {rawScore} · Capped workflow score: {score}/100
      </p>
    </div>
  );
}
