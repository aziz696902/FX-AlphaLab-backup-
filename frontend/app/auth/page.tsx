"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

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
    is_active: boolean;
    created_at: string;
    last_login_at: string | null;
  };
}

function storeTokens(data: TokenResponse) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

const API_BASE_BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_token_failed: "Could not connect to Google. Please try again.",
  google_userinfo_failed: "Could not retrieve your Google profile.",
  google_no_email: "Your Google account has no verified email.",
  missing_tokens: "Authentication failed. Please try again.",
};

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      router.replace("/dashboard");
    }
  }, [router]);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [oauthError, setOauthError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const err = new URLSearchParams(window.location.search).get("error");
    return err ? (GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed.") : null;
  });

  // ── Login state ────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // ── Signup state ───────────────────────────────────────────────────────────
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupAgreed, setSignupAgreed] = useState(false);

  function switchToSignup() {
    setLoginError(null);
    setMode("signup");
  }

  function switchToLogin() {
    setSignupError(null);
    setMode("login");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE_BACKEND}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail ?? "Login failed");
        return;
      }
      storeTokens(data as TokenResponse);
      router.push("/dashboard");
    } catch {
      setLoginError("Cannot reach server. Is the backend running?");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    if (!signupAgreed) {
      setSignupError("You must agree to the compliance policy.");
      return;
    }
    setSignupLoading(true);
    try {
      const res = await fetch(`${API_BASE_BACKEND}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          full_name: signupName || null,
          role: signupRole || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          setSignupError(data.detail.map((d: { msg: string }) => d.msg).join("; "));
        } else {
          setSignupError(data.detail ?? "Signup failed");
        }
        return;
      }
      storeTokens(data as TokenResponse);
      router.push("/dashboard");
    } catch {
      setSignupError("Cannot reach server. Is the backend running?");
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-chart-animate absolute inset-0 bg-[url('/auth/dark-bg.png')] bg-cover bg-left opacity-100 dark:block hidden" />
        <div className="auth-chart-animate absolute inset-0 bg-[url('/auth/light-bg.png')] bg-cover bg-left opacity-100 dark:hidden block" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(15,23,42,0.05),transparent_50%)] dark:bg-[radial-gradient(circle_at_left,rgba(15,23,42,0.5),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-l from-background/95 via-background/80 to-transparent dark:from-[#070b10]/90 dark:via-[#0b1118]/70" />
      </div>

      <div className="relative flex min-h-screen items-center justify-end px-6 py-10 sm:px-10">
        <div className="absolute left-6 top-6 sm:left-10 sm:top-8 flex items-center gap-2">
          <Image src="/logo.png" alt="FX AlphaLab" width={120} height={75} className="h-auto w-[100px] sm:w-[120px]" priority />
          <span className="text-xl font-semibold text-[#E8ECF0]">AlphaLab</span>
        </div>

        <Card className="w-full max-w-[420px] -translate-x-7 border-white/20 bg-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#0b1219]/85 dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <CardHeader className="items-center gap-3 pb-4 text-center">
            <Image src="/logo.png" alt="FX AlphaLab" width={48} height={30} className="h-auto w-12" priority />
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-wide text-[#D2B166]">
                {mode === "login" ? "Sign in" : "Create your account"}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90 dark:text-white/80">
                {mode === "login"
                  ? "Sign in to your market intelligence workspace"
                  : "Get started with FX-AlphaLab in seconds"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="login-email"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-11 rounded-lg bg-white/70 pl-10 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="login-password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-11 rounded-lg bg-white/70 pl-10 pr-11 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end text-sm text-muted-foreground">
                  <button type="button" className="text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>

                {loginError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {loginError}
                  </p>
                )}

                <Button type="submit" className="h-11 w-full gap-2 text-base font-semibold" disabled={loginLoading}>
                  {loginLoading ? "Signing in…" : "Sign in"}
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                  <span className="h-px w-full bg-border" />
                  OR
                  <span className="h-px w-full bg-border" />
                </div>

                {oauthError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {oauthError}
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { window.location.href = `${API_BASE_BACKEND}/auth/google`; }}
                  className="h-11 w-full gap-2 rounded-lg border-border bg-white/80 text-foreground dark:bg-[#0c141c]/70 dark:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.1H42V20H24v8h11.3C33.8 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.2l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.2l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.4 35.5 26.8 36 24 36c-5.4 0-9.8-3.3-11.3-8l-6.6 5.1C9.5 39.4 16.3 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.1H42V20H24v8h11.3c-1.1 3-3.3 5.3-6.3 6.8l6.3 5.3C38.9 36.7 44 31.1 44 24c0-1.3-.1-2.6-.4-3.9z"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <p className="text-center text-sm text-muted-foreground/90">
                  New here?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={switchToSignup}
                  >
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="signup-name"
                  >
                    Full name
                  </label>
                  <Input
                    id="signup-name"
                    placeholder="Alex Morgan"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    autoComplete="name"
                    className="h-11 rounded-lg bg-white/70 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="signup-email"
                  >
                    Work email
                  </label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="alex@fund.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-11 rounded-lg bg-white/70 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="signup-password"
                  >
                    Password
                  </label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a secure password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    className="h-11 rounded-lg bg-white/70 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 dark:text-white/80"
                    htmlFor="signup-role"
                  >
                    Role (optional)
                  </label>
                  <Input
                    id="signup-role"
                    placeholder="Portfolio manager"
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value)}
                    className="h-11 rounded-lg bg-white/70 text-foreground placeholder:text-muted-foreground dark:bg-[#0c141c]/70 dark:text-white dark:placeholder:text-white/70"
                  />
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground/90 dark:text-white/80">
                  <Checkbox
                    checked={signupAgreed}
                    onCheckedChange={(checked) => setSignupAgreed(!!checked)}
                  />
                  <span>
                    I agree to the compliance policy and understand that AlphaLab is for professional use only.
                  </span>
                </div>

                {signupError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {signupError}
                  </p>
                )}

                <Button type="submit" className="h-11 w-full font-semibold" disabled={signupLoading}>
                  {signupLoading ? "Creating account…" : "Create account"}
                </Button>

                <p className="text-center text-sm text-muted-foreground/90">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={switchToLogin}
                  >
                    Sign in
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
