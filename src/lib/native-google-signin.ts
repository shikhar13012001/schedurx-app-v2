"use client";

// signInWithPopup (the Firebase JS SDK's default Google sign-in flow) relies
// on window.open() completing a real popup OAuth handshake — that doesn't
// work inside the schedurx-apk-app Capacitor WebView (no proper popup/
// multi-window support), and fails with a 400 "malformed request" from
// identitytoolkit.googleapis.com once the broken handshake reaches Firebase.
//
// Inside the native shell, this uses @capacitor-firebase/authentication's
// native Google Sign-In instead — a real native flow (not a WebView popup).
//
// IMPORTANT: `skipNativeAuth: false` (capacitor.config.ts) only signs into
// the NATIVE Android FirebaseAuth SDK (confirmed by reading the plugin's own
// Java source — FirebaseAuthentication.java's handleSuccessfulSignIn calls
// getFirebaseAuthInstance().signInWithCredential(), where that instance is
// com.google.firebase.auth.FirebaseAuth, not this WebView's JS SDK). It does
// NOT sync into firebase/auth's getAuth() running in the page — that's a
// separate, unrelated auth session, and nothing in the plugin bridges them
// automatically. So this manually finishes the JS-side sign-in using the
// Google idToken the native call hands back, via the exact same
// GoogleAuthProvider.credential() + signInWithCredential() flow
// signInWithPopup would have produced — every existing caller
// (onIdTokenChanged in providers.tsx, .getIdToken() at each call site below)
// keeps working unchanged either way.
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type User } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";
import { isNativeShell } from "@/lib/native-missed-call";

export async function signInWithGoogleAdaptive(): Promise<User> {
  if (isNativeShell()) {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    const { credential } = await FirebaseAuthentication.signInWithGoogle();
    if (!credential?.idToken) {
      throw new Error("Google sign-in didn't return an ID token");
    }
    const jsCredential = GoogleAuthProvider.credential(credential.idToken, credential.accessToken);
    const result = await signInWithCredential(getFirebaseAuth(), jsCredential);
    return result.user;
  }

  const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
  return result.user;
}
