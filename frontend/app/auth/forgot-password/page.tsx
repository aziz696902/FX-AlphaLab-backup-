"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Something went wrong.");
        return;
      }
      setSent(true);
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
          <span className="text-xl font-semibold text-[#E8ECF0]">FX-AlphaLab</span>
        </div>

        <Card className="w-full max-w-[420px] -translate-x-7 border-white/20 bg-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#0b1219]/85 dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <CardHeader className="items-center gap-3 pb-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-wide text-[#D2B166]">
                Forgot password?
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90 dark:text-white/80">
                Enter your email and we'll send you a reset link.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground/90 dark:text-white/80">
                  If that email is registered, you'll receive a reset link shortly.
                  Check your inbox — the link expires in 15 minutes.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full gap-2"
                  onClick={() => router.push("/auth")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="forgot-email"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 rounded-lg bg-white/70 pl-10 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="h-11 w-full font-semibold" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
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
