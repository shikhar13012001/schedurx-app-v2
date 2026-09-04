"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { onAuthStateChanged, onIdTokenChanged } from "firebase/auth";
import { Toaster } from "sonner";
import { ThemeApplier } from "./theme";
import { queryClient } from "@/lib/query-client";
import { getFirebaseAuth } from "@/lib/firebase";
import { useSession } from "@/stores";
import { isNativeShell, nativeMissedCall } from "@/lib/native-missed-call";

// Keeps the local session cache honest against Firebase's own persisted auth
// state — if the Firebase session ends (elsewhere, or a revoked token), the
// app must not keep rendering as if the user were still signed in.
function AuthSync() {
  const { session, logout } = useSession();
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && session) logout();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Keeps the native missed-call plugin's cached auth token fresh — a no-op
// outside the Capacitor shell. Firebase refreshes the ID token roughly
// hourly on its own (and immediately on login/logout); each refresh is
// pushed down so a background WorkManager upload (which has no Firebase SDK
// of its own — see MissedCallPrefs.kt) has a token to send. Also stamps the
// backend origin once per launch, since the native side has no access to
// this app's own NEXT_PUBLIC_API_BASE_URL build-time config.
function NativeMissedCallSync() {
  useEffect(() => {
    if (!isNativeShell()) return;
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBaseUrl) void nativeMissedCall.setBackendOrigin(apiBaseUrl);

    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      const token = user ? await user.getIdToken() : null;
      void nativeMissedCall.cacheAuthToken(token);
    });
    return unsubscribe;
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <AuthSync />
      <NativeMissedCallSync />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgb(var(--surface) / .94)",
            color: "rgb(var(--ink))",
            border: "1px solid rgb(var(--border) / .55)",
            borderRadius: 22,
            boxShadow: "0 18px 50px rgb(var(--shadow) / .09)",
            backdropFilter: "blur(18px)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
