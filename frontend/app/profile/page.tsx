"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Crown,
  Link2,
  Link2Off,
  Eye,
  EyeOff,
  Shield,
  User,
  Lock,
  CreditCard,
  Server,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradeModalProvider, useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { UpgradeModal } from "@/components/trading/upgrade-modal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface UserData {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  tier: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

interface MT5Account {
  mt5_login: number;
  mt5_server: string;
  mt5_name: string | null;
  mt5_currency: string | null;
  mt5_leverage: number | null;
  mt5_account_type: string | null;
  connected_at: string;
  last_verified_at: string;
}

interface MT5Status {
  connected: boolean;
  account: MT5Account | null;
}

const EXNESS_SERVERS = [
  "Exness-MT5Trial16",
  "Exness-MT5Real3",
  "Exness-MT5Real6",
  "Exness-MT5Real7",
  "Exness-MT5Real8",
  "Exness-MT5Real12",
  "Exness-MT5Real14",
  "Exness-MT5Real16",
];

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  return (
    <UpgradeModalProvider>
      <UpgradeModal />
      <ProfilePageInner />
    </UpgradeModalProvider>
  );
}

function ProfilePageInner() {
  const router = useRouter();

  const [user, setUser]         = useState<UserData | null>(null);
  const [balance, setBalance]   = useState<number | null>(null);
  const [mt5Status, setMt5Status] = useState<MT5Status | null>(null);
  const [mounted, setMounted]   = useState(false);

  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState<{ ok: boolean; msg: string } | null>(null);
  const toastTimer           = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/auth"); return; }

    async function load() {
      const token = localStorage.getItem("access_token");
      const h = { Authorization: `Bearer ${token}` };
      const [meRes, accRes, mt5Res] = await Promise.allSettled([
        fetch(`${API_BASE}/auth/me`, { headers: h }),
        fetch(`${API_BASE}/trade/account`, { headers: h }),
        fetch(`${API_BASE}/mt5/status`, { headers: h }),
      ]);
      if (meRes.status === "fulfilled" && meRes.value.ok) {
        const u: UserData = await meRes.value.json();
        setUser(u);
        setFullName(u.full_name ?? "");
        setEmail(u.email);
      }
      if (accRes.status === "fulfilled" && accRes.value.ok) {
        const a = await accRes.value.json();
        setBalance(a.balance ?? null);
      }
      if (mt5Res.status === "fulfilled" && mt5Res.value.ok) {
        const m: MT5Status = await mt5Res.value.json();
        setMt5Status(m);
      }
      setMounted(true);
    }
    load();
  }, [router]);

  function showToast(ok: boolean, msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ ok, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPw && newPw !== confirmPw) { showToast(false, "New passwords do not match."); return; }

    const body: Record<string, string | null> = {};
    if (fullName !== (user?.full_name ?? "")) body.full_name = fullName || null;
    if (email !== user?.email)               body.email = email;
    if (newPw) { body.current_password = currentPw; body.new_password = newPw; }
    if (!Object.keys(body).length)           { showToast(false, "No changes detected."); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
          : (data.detail ?? "Update failed");
        showToast(false, msg);
        return;
      }
      setUser(data);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      localStorage.setItem("user", JSON.stringify(data));
      showToast(true, "Profile updated successfully.");
    } catch {
      showToast(false, "Cannot reach server.");
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header (matches dashboard) ── */}
      <header className="h-16 shrink-0 flex items-center justify-between border-b border-border bg-card px-6 shadow-[var(--card-shadow)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <span className="text-border select-none">/</span>
          <span className="text-xs font-semibold text-foreground">Account Settings</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
          >
            Admin Panel
          </button>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto shadow-[var(--card-shadow)]">

          {/* Avatar */}
          <div className="flex flex-col items-center px-6 pt-8 pb-6 border-b border-border">
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/10">
                <span className="text-white font-bold text-xl tracking-tight font-mono">
                  {user ? getInitials(user.full_name, user.email) : "··"}
                </span>
              </div>
              <span className={cn(
                "absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
                user?.is_active ? "bg-[var(--buy)]" : "bg-destructive"
              )} />
            </div>
            <p className="text-sm font-semibold text-foreground text-center truncate w-full leading-tight">
              {user?.full_name || user?.email.split("@")[0] || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground text-center mt-0.5 truncate w-full font-mono">
              {user?.email}
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase",
                isAdmin
                  ? "bg-primary/10 text-primary"
                  : "bg-[var(--buy)]/10 text-[var(--buy)]"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isAdmin ? "bg-primary" : "bg-[var(--buy)]")} />
                {user?.role ?? "—"}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col px-4 py-4 gap-0">

            {/* Balance */}
            <div className="pb-4 border-b border-border mb-4">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5 font-medium">
                <Activity className="h-3 w-3" />
                MT5 Balance
              </p>
              {balance !== null ? (
                <p className="font-mono text-xl font-bold text-foreground tabular-nums">
                  ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">Not connected</p>
              )}
            </div>

            {/* Meta */}
            {[
              { label: "Account ID",   value: user ? `#${String(user.id).padStart(6, "0")}` : "—", mono: true },
              { label: "Member Since", value: user?.created_at    ? formatDate(user.created_at)    : "—", mono: false },
              { label: "Last Login",   value: user?.last_login_at ? formatDate(user.last_login_at) : "—", mono: false },
              {
                label: "Status",
                value: user?.is_active ? "Active" : "Suspended",
                mono: true,
                cls: user?.is_active ? "text-[var(--buy)]" : "text-destructive",
              },
            ].map(({ label, value, mono, cls }) => (
              <div key={label} className="py-3 border-b border-border last:border-0">
                <p className="text-[10px] tracking-wider uppercase text-muted-foreground mb-0.5 font-medium">{label}</p>
                <p className={cn("text-xs font-medium text-foreground", mono && "font-mono", cls)}>{value}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main content: 2-column grid ── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">

            {/* Toast */}
            {toast && (
              <div className={cn(
                "mb-5 flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium",
                toast.ok
                  ? "bg-[var(--buy)]/5 border-[var(--buy)]/30 text-[var(--buy)]"
                  : "bg-destructive/5 border-destructive/30 text-destructive"
              )}>
                {toast.ok
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <XCircle      className="h-4 w-4 shrink-0" />
                }
                {toast.msg}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-5">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-5">

                  {/* Identity card */}
                  <SectionCard
                    icon={<User className="h-3.5 w-3.5" />}
                    title="Identity"
                    number="01"
                  >
                    <div className="space-y-4">
                      <Field
                        id="full_name"
                        label="Full Name"
                        type="text"
                        value={fullName}
                        onChange={setFullName}
                        placeholder="Your full name"
                      />
                      <Field
                        id="email"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@example.com"
                      />
                    </div>
                  </SectionCard>

                  {/* Security card */}
                  <SectionCard
                    icon={<Lock className="h-3.5 w-3.5" />}
                    title="Security"
                    number="02"
                    hint="Leave blank to keep current password"
                  >
                    <div className="space-y-4">
                      <Field
                        id="current_pw"
                        label="Current Password"
                        type="password"
                        value={currentPw}
                        onChange={setCurrentPw}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          id="new_pw"
                          label="New Password"
                          type="password"
                          value={newPw}
                          onChange={setNewPw}
                          placeholder="••••••••••••"
                          autoComplete="new-password"
                        />
                        <Field
                          id="confirm_pw"
                          label="Confirm"
                          type="password"
                          value={confirmPw}
                          onChange={setConfirmPw}
                          placeholder="••••••••••••"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </SectionCard>

                  {/* Save button */}
                  <button
                    type="submit"
                    disabled={saving || !mounted}
                    className="h-10 w-full bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold tracking-widest uppercase transition-colors rounded-lg flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : "Save Changes"}
                  </button>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="flex flex-col gap-5">

                  {/* Plan card */}
                  <PlanSection tier={user?.tier ?? "free"} />

                  {/* MT5 card */}
                  <SectionCard
                    icon={<Server className="h-3.5 w-3.5" />}
                    title="MT5 Account"
                    number="04"
                    statusBadge={
                      mt5Status?.connected
                        ? <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-[var(--buy)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--buy)] animate-pulse" />
                            Connected
                          </span>
                        : undefined
                    }
                  >
                    <MT5Section
                      status={mt5Status}
                      onStatusChange={setMt5Status}
                      showToast={showToast}
                    />
                  </SectionCard>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Reusable section card ── */
function SectionCard({
  icon, title, number, hint, statusBadge, children,
}: {
  icon: React.ReactNode;
  title: string;
  number: string;
  hint?: string;
  statusBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-[var(--card-shadow)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">{number}</span>
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-semibold text-foreground tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
          {statusBadge}
        </div>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

/* ── MT5 section (no wrapper card — lives inside SectionCard) ── */
function MT5Section({
  status,
  onStatusChange,
  showToast,
}: {
  status: MT5Status | null;
  onStatusChange: (s: MT5Status) => void;
  showToast: (ok: boolean, msg: string) => void;
}) {
  const [mt5Login, setMt5Login]       = useState("");
  const [mt5Password, setMt5Password] = useState("");
  const [mt5Server, setMt5Server]     = useState(EXNESS_SERVERS[0]);
  const [showPw, setShowPw]           = useState(false);
  const [connecting, setConnecting]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!mt5Login || !mt5Password) { showToast(false, "Please fill in all MT5 fields."); return; }
    setConnecting(true);
    try {
      const res = await fetch(`${API_BASE}/mt5/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          mt5_login: parseInt(mt5Login, 10),
          mt5_password: mt5Password,
          mt5_server: mt5Server,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(false, data.detail ?? "MT5 connection failed."); return; }
      onStatusChange(data as MT5Status);
      setMt5Password("");
      showToast(true, "MT5 account connected successfully.");
    } catch {
      showToast(false, "Cannot reach server.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_BASE}/mt5/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(false, data.detail ?? "Disconnect failed.");
        return;
      }
      onStatusChange({ connected: false, account: null });
      showToast(true, "MT5 account disconnected.");
    } catch {
      showToast(false, "Cannot reach server.");
    } finally {
      setDisconnecting(false);
    }
  }

  const acc = status?.account ?? null;

  if (status?.connected && acc) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Account",  value: String(acc.mt5_login),                                        mono: true },
            { label: "Server",   value: acc.mt5_server,                                               mono: true },
            { label: "Holder",   value: acc.mt5_name ?? "—",                                          mono: false },
            { label: "Currency", value: acc.mt5_currency ?? "—",                                      mono: true },
            { label: "Leverage", value: acc.mt5_leverage ? `1:${acc.mt5_leverage}` : "—",             mono: true },
            { label: "Type",     value: acc.mt5_account_type
                ? acc.mt5_account_type.charAt(0).toUpperCase() + acc.mt5_account_type.slice(1) : "—", mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-background rounded-md px-3 py-2.5 border border-border">
              <p className="text-[9px] tracking-wider uppercase text-muted-foreground mb-0.5 font-medium">{label}</p>
              <p className={cn("text-xs font-medium text-foreground truncate", mono && "font-mono")}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3" />
            Connected {new Date(acc.connected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-destructive hover:text-destructive/70 disabled:opacity-40 transition-colors"
          >
            <Link2Off className="h-3 w-3" />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Link your MT5 account to verify your identity and unlock live account data.
        Your password is verified once and never stored.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
            MT5 Login Number
          </label>
          <input
            type="number"
            value={mt5Login}
            onChange={(e) => setMt5Login(e.target.value)}
            placeholder="e.g. 12345678"
            required
            className="w-full h-9 bg-background border border-border rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
            MT5 Password
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={mt5Password}
              onChange={(e) => setMt5Password(e.target.value)}
              placeholder="Your MT5 account password"
              required
              autoComplete="off"
              className="w-full h-9 bg-background border border-border rounded-md px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Never stored — used once to verify your account.</p>
        </div>

        <div>
          <label className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
            Broker Server
          </label>
          <div className="relative">
            <select
              value={mt5Server}
              onChange={(e) => setMt5Server(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 pr-8 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono appearance-none cursor-pointer"
            >
              {EXNESS_SERVERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={connecting}
        className="w-full h-9 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold tracking-widest uppercase transition-colors rounded-md"
      >
        {connecting ? (
          <>
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <Link2 className="h-3.5 w-3.5" />
            Connect MT5 Account
          </>
        )}
      </button>
    </form>
  );
}

/* ── Plan section ── */
const TIER_META: Record<string, {
  label: string;
  colorCls: string;
  bgCls: string;
  borderCls: string;
  Icon?: React.ElementType;
  features: string[];
  nextTier?: "pro" | "elite";
  upgradeCta?: string;
}> = {
  free: {
    label: "Free",
    colorCls: "text-muted-foreground",
    bgCls: "bg-muted/30",
    borderCls: "border-border",
    features: ["Live price feed", "Candlestick charts", "Basic dashboard"],
    nextTier: "pro",
    upgradeCta: "Upgrade to Pro",
  },
  pro: {
    label: "Pro",
    colorCls: "text-blue-600",
    bgCls: "bg-blue-50/50",
    borderCls: "border-blue-200",
    Icon: Zap,
    features: ["Everything in Free", "AI Signals — Technical & Macro", "Today's Call + Details", "Multi-pair watchlist signals"],
    nextTier: "elite",
    upgradeCta: "Upgrade to Elite",
  },
  elite: {
    label: "Elite",
    colorCls: "text-amber-600",
    bgCls: "bg-amber-50/50",
    borderCls: "border-amber-200",
    Icon: Crown,
    features: ["Everything in Pro", "All 4 AI Agents", "Agent Pulse panel", "Deep Dive Reports"],
  },
};

function PlanSection({ tier }: { tier: string }) {
  const meta = TIER_META[tier] ?? TIER_META.free;
  const { open } = useUpgradeModal();
  const Icon = meta.Icon;

  return (
    <SectionCard
      icon={<CreditCard className="h-3.5 w-3.5" />}
      title="Plan"
      number="03"
    >
      <div className={cn("rounded-lg border p-4", meta.bgCls, meta.borderCls)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={cn("h-4 w-4", meta.colorCls)} />}
            <span className={cn("text-xs font-bold tracking-widest uppercase", meta.colorCls)}>
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground">· Current plan</span>
          </div>
          {meta.nextTier && (
            <button
              type="button"
              onClick={() => open(meta.nextTier!)}
              className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
            >
              {meta.upgradeCta}
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {meta.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs text-foreground/70">
              <span className={cn("h-1 w-1 rounded-full shrink-0", meta.colorCls.replace("text-", "bg-"))} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

/* ── Reusable form field ── */
function Field({
  id, label, type, value, onChange, placeholder, autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full h-9 bg-background border border-border rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
      />
    </div>
  );
}
