"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface UserData {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function formatBalance(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Stagger-in animation ─────────────────────────────────────────────────────
const style = `
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.anim-row {
  opacity: 0;
  animation: fadeSlideUp 0.4s cubic-bezier(.22,.68,0,1) forwards;
}
`;

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser]       = useState<UserData | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

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

      const [meRes, accRes] = await Promise.allSettled([
        fetch(`${API_BASE}/auth/me`, { headers: h }),
        fetch(`${API_BASE}/trading/account`, { headers: h }),
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
      const res  = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
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
      showToast(true, "Profile updated.");
    } catch {
      showToast(false, "Cannot reach server.");
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = user?.role === "admin";

  return (
    <>
      <style>{style}</style>

      <div className="min-h-screen bg-[#E8EAEF] flex flex-col">

        {/* ── Top bar ────────────────────────────────────────────────────────── */}
        <header className="h-12 bg-[#1A1D24] flex items-center px-6 gap-4 shrink-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-[#6B7280] hover:text-white transition-colors text-xs tracking-widest uppercase"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <span className="text-[#2A2D3A] select-none">╱</span>
          <span className="text-xs tracking-widest uppercase text-[#9CA3AF]">Account Settings</span>
        </header>

        {/* ── Main layout ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT SIDEBAR — identity + stats */}
          <aside className="w-72 shrink-0 bg-[#1A1D24] flex flex-col">

            {/* Avatar block */}
            <div
              className="anim-row flex flex-col items-center pt-12 pb-8 px-8 border-b border-[#2A2D3A]"
              style={{ animationDelay: "0ms" }}
            >
              {/* Avatar ring */}
              <div className="relative mb-5">
                <div className="h-20 w-20 rounded-full bg-[#1F4AA8] flex items-center justify-center ring-2 ring-[#1F4AA8]/40 ring-offset-4 ring-offset-[#1A1D24]">
                  <span className="text-white font-bold text-2xl tracking-tight font-mono">
                    {user ? getInitials(user.full_name, user.email) : "··"}
                  </span>
                </div>
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-[#10B981] ring-2 ring-[#1A1D24]" />
              </div>

              <h2 className="text-white font-semibold text-base text-center leading-tight truncate w-full text-center">
                {user?.full_name || user?.email.split("@")[0] || "—"}
              </h2>
              <p className="text-[#6B7280] text-xs mt-1 truncate w-full text-center font-mono">{user?.email}</p>

              <div className="mt-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase ${
                    isAdmin
                      ? "bg-[#1F4AA8]/20 text-[#93B4FF] border border-[#1F4AA8]/40"
                      : "bg-[#0D9488]/20 text-[#5EEAD4] border border-[#0D9488]/30"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isAdmin ? "bg-[#93B4FF]" : "bg-[#5EEAD4]"}`} />
                  {user?.role ?? "—"}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col flex-1 px-6 py-6 gap-0">

              {/* Balance */}
              <div
                className="anim-row pb-6 border-b border-[#2A2D3A]"
                style={{ animationDelay: "60ms" }}
              >
                <p className="text-[10px] tracking-widest uppercase text-[#4B5563] mb-2 flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  MT5 Balance
                </p>
                {balance !== null ? (
                  <p className="font-mono text-2xl font-bold text-white tabular-nums">
                    <span className="text-[#6B7280] text-sm mr-0.5">$</span>
                    {formatBalance(balance)}
                  </p>
                ) : (
                  <p className="font-mono text-sm text-[#4B5563] italic">Not connected</p>
                )}

                <button
                  onClick={() => {/* non-functional */}}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[#0D9488]/10 hover:bg-[#0D9488]/20 border border-[#0D9488]/30 text-[#5EEAD4] text-xs font-bold tracking-widest uppercase transition-colors"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Funds
                </button>
              </div>

              {/* Meta stats */}
              {[
                { label: "Account ID", value: user ? `#${String(user.id).padStart(6, "0")}` : "—", mono: true },
                { label: "Member Since", value: user?.created_at ? formatDate(user.created_at) : "—", mono: false },
                { label: "Last Login", value: user?.last_login_at ? formatDate(user.last_login_at) : "—", mono: false },
                { label: "Status", value: user?.is_active ? "ACTIVE" : "SUSPENDED", mono: true, color: user?.is_active ? "#10B981" : "#DC2626" },
              ].map(({ label, value, mono, color }, i) => (
                <div
                  key={label}
                  className="anim-row py-4 border-b border-[#2A2D3A] last:border-0"
                  style={{ animationDelay: `${120 + i * 40}ms` }}
                >
                  <p className="text-[10px] tracking-widest uppercase text-[#4B5563] mb-1">{label}</p>
                  <p
                    className={`text-sm ${mono ? "font-mono" : ""}`}
                    style={{ color: color ?? "#9CA3AF" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT PANEL — form */}
          <main className="flex-1 overflow-y-auto">
            <form
              onSubmit={handleSave}
              className="max-w-xl mx-auto py-12 px-8"
            >

              {/* Section: Identity */}
              <div
                className="anim-row"
                style={{ animationDelay: "80ms" }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#1F4AA8]">01</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#1A1D24]">Identity</span>
                  <div className="flex-1 h-px bg-[#D1D5DB]" />
                </div>

                <div className="space-y-5">
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
              </div>

              {/* Section: Security */}
              <div
                className="anim-row mt-10"
                style={{ animationDelay: "140ms" }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#1F4AA8]">02</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#1A1D24]">Security</span>
                  <div className="flex-1 h-px bg-[#D1D5DB]" />
                  <span className="text-[10px] text-[#9CA3AF] tracking-wide">Leave blank to keep current password</span>
                </div>

                <div className="space-y-5">
                  <Field
                    id="current_pw"
                    label="Current Password"
                    type="password"
                    value={currentPw}
                    onChange={setCurrentPw}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                  />
                  <div className="grid grid-cols-2 gap-4">
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
                      label="Confirm Password"
                      type="password"
                      value={confirmPw}
                      onChange={setConfirmPw}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              {/* Toast */}
              {toast && (
                <div
                  className={`anim-row mt-6 flex items-center gap-3 px-4 py-3 border-l-2 text-sm ${
                    toast.ok
                      ? "bg-[#F0FDF9] border-[#10B981] text-[#065F46]"
                      : "bg-[#FEF2F2] border-[#DC2626] text-[#991B1B]"
                  }`}
                  style={{ animationDelay: "0ms" }}
                >
                  {toast.ok
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                    : <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                  }
                  <span className="font-medium">{toast.msg}</span>
                </div>
              )}

              {/* Submit */}
              <div
                className="anim-row mt-8"
                style={{ animationDelay: "200ms" }}
              >
                <button
                  type="submit"
                  disabled={saving || !mounted}
                  className="w-full h-11 bg-[#1F4AA8] hover:bg-[#1a3e8f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving
                    </>
                  ) : "Save Changes"}
                </button>
              </div>
            </form>
          </main>

        </div>
      </div>
    </>
  );
}

// ── Minimal terminal-style field ─────────────────────────────────────────────
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
    <div className="group">
      <label
        htmlFor={id}
        className="block text-[10px] font-bold tracking-widest uppercase text-[#6B7280] mb-1.5 group-focus-within:text-[#1F4AA8] transition-colors"
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
        className="w-full h-10 bg-white border border-[#D1D5DB] px-3 text-sm text-[#1A1D24] placeholder:text-[#D1D5DB] focus:outline-none focus:border-[#1F4AA8] focus:ring-1 focus:ring-[#1F4AA8]/20 transition-all font-mono rounded-none"
      />
    </div>
  );
}
