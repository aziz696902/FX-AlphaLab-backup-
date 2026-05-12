"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Mail, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function VerifyPendingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      setError("Cannot reach server. Try again.");
    } finally {
      setResending(false);
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
                Check your email
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90 dark:text-white/80">
                We sent a verification link to
              </CardDescription>
              {email && (
                <p className="text-sm font-semibold text-foreground dark:text-white break-all">
                  {email}
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-center text-xs text-muted-foreground/80 dark:text-white/60">
              Click the link in the email to activate your account. The link expires in 24 hours.
            </p>

            {resent && (
              <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                New verification link sent.
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {email && (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full gap-2 text-sm"
                onClick={handleResend}
                disabled={resending || resent}
              >
                <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Sending…" : resent ? "Link sent" : "Resend verification email"}
              </Button>
            )}

            <p className="text-center text-sm text-muted-foreground/90">
              Already verified?{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => router.push("/auth")}
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerifyPendingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <VerifyPendingContent />
    </Suspense>
  );
}
