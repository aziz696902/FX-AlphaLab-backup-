"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Wallet, KeyRound, Mail, Shield, PlusCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function roleBadgeClass(role: string) {
  return role === "admin"
    ? "bg-[#1F4AA8] text-white border-[#1F4AA8]"
    : "bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/30";
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/auth"); return; }

    async function load() {
      try {
        const token = localStorage.getItem("access_token");
        const headers = { Authorization: `Bearer ${token}` };

        const [meRes, accRes] = await Promise.allSettled([
          fetch(`${API_BASE}/auth/me`, { headers }),
          fetch(`${API_BASE}/trading/account`, { headers }),
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
      } catch {
        // ignore
      }
    }

    load();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (newPw && newPw !== confirmPw) {
      setToast({ type: "error", message: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      const body: Record<string, string | null> = {};
      if (fullName !== (user?.full_name ?? "")) body.full_name = fullName || null;
      if (email !== user?.email) body.email = email;
      if (newPw) { body.current_password = currentPw; body.new_password = newPw; }

      if (Object.keys(body).length === 0) {
        setToast({ type: "error", message: "No changes to save." });
        setSaving(false);
        return;
      }

      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
          : (data.detail ?? "Update failed");
        setToast({ type: "error", message: msg });
        return;
      }

      setUser(data);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setToast({ type: "success", message: "Profile updated successfully." });

      // Update localStorage user cache
      localStorage.setItem("user", JSON.stringify(data));
    } catch {
      setToast({ type: "error", message: "Cannot reach server." });
    } finally {
      setSaving(false);
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-3 shadow-[var(--card-shadow)]">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <div className="h-5 w-px bg-border" />
        <span className="text-sm font-medium text-foreground">Profile Settings</span>
      </header>

      <main className="max-w-2xl mx-auto py-10 px-4 space-y-6">
        {/* Profile hero */}
        <Card className="shadow-[var(--card-shadow)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-full bg-[#1F4AA8] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xl tracking-tight">
                  {user ? initials(user.full_name, user.email) : "—"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-semibold text-foreground truncate">
                    {user?.full_name || user?.email.split("@")[0] || "—"}
                  </h1>
                  {user && (
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium ${roleBadgeClass(user.role)}`}>
                      {user.role.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                {memberSince && (
                  <p className="text-xs text-muted-foreground mt-0.5">Member since {memberSince}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Funding */}
        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#0D9488]" />
              Account Funding
            </CardTitle>
            <CardDescription>Your MT5 trading account balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available Balance</p>
                <p className="text-3xl font-mono font-bold text-foreground tabular-nums">
                  {balance !== null
                    ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground text-2xl">MT5 not connected</span>
                  }
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2 bg-[#0D9488] hover:bg-[#0B7A6F] text-white border-0"
                onClick={() => {/* non-functional */}}
              >
                <PlusCircle className="h-4 w-4" />
                Add Money
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="shadow-[var(--card-shadow)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Account Details
            </CardTitle>
            <CardDescription>Update your name, email, or password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="flex items-center gap-1.5 text-xs font-medium">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="h-9"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-9"
                />
              </div>

              <div className="border-t border-border pt-5 space-y-4">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <KeyRound className="h-3.5 w-3.5" />
                  Change Password
                  <span className="normal-case tracking-normal font-normal ml-1">— leave blank to keep current</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="current_pw" className="text-xs">Current Password</Label>
                  <Input id="current_pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-9" autoComplete="current-password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new_pw" className="text-xs">New Password</Label>
                    <Input id="new_pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-9" autoComplete="new-password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_pw" className="text-xs">Confirm New</Label>
                    <Input id="confirm_pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-9" autoComplete="new-password" />
                  </div>
                </div>
              </div>

              {/* Toast */}
              {toast && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
                  toast.type === "success"
                    ? "bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {toast.type === "success"
                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                    : <AlertCircle className="h-4 w-4 shrink-0" />
                  }
                  {toast.message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
