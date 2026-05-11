"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          setError(data.detail.map((d: { msg: string }) => d.msg).join("; "));
        } else {
          setError(data.detail ?? "Password reset failed.");
        }
        return;
      }
      setDone(true);
    } catch {
      setError("Cannot reach server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-chart-animate absolute inset-0 bg-[url('/auth/dark-bg.png')] bg-cover bg-left opacity-100 dark:block hidden" />
        <div className="auth-chart-animate absolute inset-0 bg-[url('/auth/light-bg.png')] bg-cover bg-left opacity-100 dark:hidden block" />
        <div className="absolute inset-0 bg-gradient-to-l from-background/95 via-background/80 to-transparent dark:from-[#070b10]/90 dark:via-[#0b1118]/70" />
      </div>

      <div className="relative flex min-h-screen items-center justify-end px-6 py-10 sm:px-10">
        <div className="absolute left-6 top-6 sm:left-10 sm:top-8 flex items-center gap-2">
          <Image src="/logo.png" alt="FX AlphaLab" width={120} height={75} className="h-auto w-[100px] sm:w-[120px]" priority />
          <span className="text-xl font-semibold text-[#E8ECF0]">AlphaLab</span>
        </div>

        <Card className="w-full max-w-[420px] -translate-x-7 border-white/20 bg-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#0b1219]/85 dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <CardHeader className="items-center gap-3 pb-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-wide text-[#D2B166]">
                {done ? "Password updated" : "Reset your password"}
              </CardTitle>
              {!done && (
                <CardDescription className="text-sm text-muted-foreground/90 dark:text-white/80">
                  Must be at least 12 characters with upper, lower, number, and symbol.
                </CardDescription>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {done ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground/90 dark:text-white/80">
                  Your password has been updated. You can now sign in with your new password.
                </p>
                <Button
                  type="button"
                  className="h-11 w-full font-semibold"
                  onClick={() => router.push("/auth")}
                >
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="new-password"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNew ? "text" : "password"}
                      placeholder="Create a new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="h-11 rounded-lg bg-white/70 pl-10 pr-11 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="h-11 rounded-lg bg-white/70 pl-10 pr-11 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                    />
                    <button
                      type="button"
                      aria-label="Toggle confirm password visibility"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="h-11 w-full font-semibold" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </Button>

                <p className="text-center text-sm text-muted-foreground/90">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={() => router.push("/auth")}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to sign in
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
