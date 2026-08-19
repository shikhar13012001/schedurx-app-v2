// Browser-side error tracking. Inert until NEXT_PUBLIC_SENTRY_DSN is set —
// Sentry.init with an empty dsn disables the SDK rather than throwing, so
// this is safe to ship even before a Sentry project exists.
import * as Sentry from "@sentry/nextjs";

// The ~67kB shared-bundle cost of @sentry/nextjs's browser SDK is fixed
// once installed — it doesn't shrink by zeroing tracesSampleRate or
// integrations (verified empirically against this app's build output), so
// there's no bundle-size reason to cut corners on what it actually captures.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
