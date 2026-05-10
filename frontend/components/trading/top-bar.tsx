"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Settings, User, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CoordinatorReportAPI } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const instruments = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];

interface TopBarProps {
  activeInstrument: string;
  onInstrumentChange: (symbol: string) => void;
  onResetLayout?: () => void;
  report: CoordinatorReportAPI | null;
}

function useAccountBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/trading/account`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setBalance(data.balance ?? null);
        }
      } catch {
        // MT5 not connected — balance stays null
      }
    }
    fetchBalance();
    const id = setInterval(fetchBalance, 30_000);
    return () => clearInterval(id);
  }, []);

  return balance;
}

export function TopBar({ activeInstrument, onInstrumentChange, onResetLayout, report }: TopBarProps) {
  const router = useRouter();
  const lastUpdated = report?.date ?? null;
  const balance = useAccountBalance();

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.replace("/auth");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-[var(--card-shadow)]">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="FX AlphaLab" width={48} height={30} className="h-auto w-12" />
          <span className="font-semibold text-foreground">AlphaLab</span>
        </div>
        <Badge variant="default" className="bg-[var(--long)] text-white text-[10px] px-1.5 py-0.5 h-5">
          LIVE
        </Badge>
        <span className="text-xs text-muted-foreground">
          Signal date:{" "}
          <span className="font-mono">{lastUpdated ?? "—"}</span>
        </span>
        {report?.hold_reason && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 h-5 border-amber-200">
            HOLD: {report.hold_reason}
          </Badge>
        )}
      </div>

      {/* Center - Instrument Tabs */}
      <nav className="flex items-center gap-1">
        {instruments.map((sym) => (
          <button
            key={sym}
            onClick={() => onInstrumentChange(sym)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors relative",
              activeInstrument === sym
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sym}
            {activeInstrument === sym && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </nav>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* MT5 Balance */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted border border-border">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
            {balance !== null
              ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Settings className="h-3.5 w-3.5 mr-2" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onResetLayout}>
                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                Reset Layout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="h-3.5 w-3.5 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
