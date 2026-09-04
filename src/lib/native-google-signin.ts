"use client";

// signInWithPopup (the Firebase JS SDK's default Google sign-in flow) relies
// on window.open() completing a real popup OAuth handshake — that doesn't
// work inside the schedurx-apk-app Capacitor WebView (no proper popup/
// multi-window support), and fails with a 400 "malformed request" from
// identitytoolkit.googleapis.com once the broken handshake reaches Firebase.
//
// Inside the native shell, this uses @capacitor-firebase/authentication's
// native Google Sign-In instead — a real native flow (not a WebView popup).
// With its default `skipNativeAuth: false`, the plugin automatically syncs
// the resulting session into the JS SDK's getAuth() too, so every existing
// caller (onAuthStateChanged/onIdTokenChanged in providers.tsx, .getIdToken()
// at each call site below) keeps working unchanged — this is the only
// function that needs to know two flows exist.
import { signInWithPopup, type User } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";
import { isNativeShell } from "@/lib/native-missed-call";

export async function signInWithGoogleAdaptive(): Promise<User> {
  if (isNativeShell()) {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    await FirebaseAuthentication.signInWithGoogle();
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error("Sign-in didn't complete");
    return user;
  }

  const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
  return result.user;
}
