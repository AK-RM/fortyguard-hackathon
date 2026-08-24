import type { DischargeLocation } from "@/types/discharge-workflow";

type JourneyMapProps = {
  origin: DischargeLocation;
  destination: DischargeLocation;
};

function projectPoint(
  latitude: number,
  longitude: number,
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  },
  width: number,
  height: number
) {
  const x =
    ((longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
  const y =
    height -
    ((latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;

  return { x, y };
}

export function JourneyMap({ origin, destination }: JourneyMapProps) {
  const width = 420;
  const height = 220;
  const padding = 28;
  const bounds = {
    minLat: Math.min(origin.latitude, destination.latitude) - 0.08,
    maxLat: Math.max(origin.latitude, destination.latitude) + 0.08,
    minLng: Math.min(origin.longitude, destination.longitude) - 0.08,
    maxLng: Math.max(origin.longitude, destination.longitude) + 0.08,
  };

  const originPoint = projectPoint(
    origin.latitude,
    origin.longitude,
    bounds,
    width - padding * 2,
    height - padding * 2
  );
  const destinationPoint = projectPoint(
    destination.latitude,
    destination.longitude,
    bounds,
    width - padding * 2,
    height - padding * 2
  );

  const ox = originPoint.x + padding;
  const oy = originPoint.y + padding;
  const dx = destinationPoint.x + padding;
  const dy = destinationPoint.y + padding;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Hospital to destination geographic overview"
      >
        <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="8" />
        <line
          x1={ox}
          y1={oy}
          x2={dx}
          y2={dy}
          stroke="#0284c7"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <circle cx={ox} cy={oy} r="7" fill="#0f766e" />
        <circle cx={dx} cy={dy} r="7" fill="#c2410c" />
        <text x={ox + 10} y={oy - 10} className="fill-slate-700 text-[11px]">
          Hospital / origin
        </text>
        <text x={dx + 10} y={dy - 10} className="fill-slate-700 text-[11px]">
          Post-discharge destination
        </text>
      </svg>
      <p className="mt-2 text-xs text-slate-500">
        Geographic overview only — not a calculated route, road geometry, or
        FortyGuard heatmap layer.
      </p>
    </div>
  );
}
