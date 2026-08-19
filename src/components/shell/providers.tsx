"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Toaster } from "sonner";
import { ThemeApplier } from "./theme";
import { queryClient } from "@/lib/query-client";
import { getFirebaseAuth } from "@/lib/firebase";
import { useSession } from "@/stores";

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <AuthSync />
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
