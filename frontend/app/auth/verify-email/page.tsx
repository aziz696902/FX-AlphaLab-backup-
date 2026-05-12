"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: {
    id: number;
    email: string;
    full_name: string | null;
    role: string;
    tier: string;
    is_active: boolean;
    email_verified_at: string | null;
    created_at: string;
    last_login_at: string | null;
  };
}

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the URL.");
      return;
    }

    fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.detail ?? "Verification failed.");
          setStatus("error");
          return;
        }
        const d = data as TokenResponse;
        localStorage.setItem("access_token", d.access_token);
        localStorage.setItem("refresh_token", d.refresh_token);
        localStorage.setItem("user", JSON.stringify(d.user));
        setStatus("success");
        setTimeout(() => router.replace("/dashboard"), 2000);
      })
      .catch(() => {
        setErrorMsg("Cannot reach server. Try again later.");
        setStatus("error");
      });
  }, [token, router]);

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
            {status === "loading" && (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
            <CardTitle className="text-2xl font-bold tracking-wide text-[#D2B166]">
              {status === "loading" && "Verifying…"}
              {status === "success" && "Email verified!"}
              {status === "error" && "Verification failed"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 text-center">
            {status === "loading" && (
              <p className="text-sm text-muted-foreground/80 dark:text-white/60">
                Please wait while we verify your account…
              </p>
            )}
            {status === "success" && (
              <p className="text-sm text-muted-foreground/80 dark:text-white/60">
                Your account is active. Redirecting to the dashboard…
              </p>
            )}
            {status === "error" && (
              <>
                <p className="text-sm text-muted-foreground/80 dark:text-white/60">{errorMsg}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full"
                  onClick={() => router.push("/auth")}
                >
                  Back to sign in
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
