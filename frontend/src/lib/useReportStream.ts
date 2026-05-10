"use client";

import { useEffect } from "react";
import { useAgentStore, type ReportPayload } from "@/store/agentStore";

function normalizePayload(payload: unknown): ReportPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("report" in payload) {
    return payload as ReportPayload;
  }

  return { report: payload as ReportPayload["report"] };
}

export default function useReportStream() {
  const hydrate = useAgentStore((state) => state.hydrateFromPayload);

  useEffect(() => {
    const source = new EventSource("/api/report/stream");

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const payload = normalizePayload(data);
        if (payload) {
          hydrate(payload);
        }
      } catch {
        return;
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [hydrate]);
}
