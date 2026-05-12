"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const error = params.get("error");
    if (error) {
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-error", error }, window.location.origin);
        window.close();
      } else {
        router.replace(`/auth?error=${encodeURIComponent(error)}`);
      }
      return;
    }

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const user = params.get("user");

    if (!access_token || !refresh_token || !user) {
      if (window.opener) {
        window.opener.postMessage({ type: "google-oauth-error", error: "missing_tokens" }, window.location.origin);
        window.close();
      } else {
        router.replace("/auth?error=missing_tokens");
      }
      return;
    }

    if (window.opener) {
      window.opener.postMessage({ type: "google-oauth-success", access_token, refresh_token, user }, window.location.origin);
      window.close();
    } else {
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user", user);
      router.replace("/dashboard");
    }
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
