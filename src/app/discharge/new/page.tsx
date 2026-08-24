"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useDischargeStorage } from "@/hooks/use-discharge-storage";
import {
  createBlankDischargeRecord,
  generateDischargeId,
  upsertDischargeRecord,
} from "@/lib/discharge-storage";

export default function NewDischargePage() {
  const router = useRouter();
  const { state, ready, persist } = useDischargeStorage();
  const createdRef = useRef(false);

  useEffect(() => {
    if (!ready || !state || createdRef.current) {
      return;
    }

    createdRef.current = true;
    const id = generateDischargeId(state.discharges);
    const created = createBlankDischargeRecord(id);
    persist(upsertDischargeRecord(state, created));
    router.replace(`/discharge/${id}`);
  }, [ready, state, persist, router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-600">
      Creating new discharge assessment…
    </div>
  );
}
