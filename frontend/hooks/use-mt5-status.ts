"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MT5Account {
  mt5_login: number;
  mt5_server: string;
  mt5_name: string | null;
  mt5_currency: string | null;
  mt5_leverage: number | null;
  mt5_account_type: string | null;
  connected_at: string;
  last_verified_at: string;
}

export interface MT5Status {
  connected: boolean;
  account: MT5Account | null;
}

export function useMt5Status(): MT5Status {
  const [status, setStatus] = useState<MT5Status>({ connected: false, account: null });

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    fetch(`${API_BASE}/mt5/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MT5Status | null) => { if (data) setStatus(data); })
      .catch(() => {});
  }, []);

  return status;
}
