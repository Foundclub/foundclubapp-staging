# Metro Console Hygiene Checklist

## Cold Start
- Launch app with `APP_ENV=local` and verify no Sentry warning about `Sentry.wrap` before `Sentry.init`.
- Verify tutorial logs do not spam unless `global.__FC_TUTORIAL_DEBUG__ = true`.
- Verify no full payload dumps (FCM token, OTP confirm object, full `/events` JSON).

## Auth
- Login with OTP and verify no sensitive data is logged.
- Switch account and verify no `[auth/invalid-custom-token]` warning is emitted.
- Add account and cancel add-account flow; verify session remains stable.

## Notifications
- Verify FCM token registration still succeeds.
- Tap push from:
  - foreground
  - background
  - cold start
- Verify navigation fallback goes to `NotificationList` only when destination is invalid.

## Onboarding
- Complete sport step and verify next route navigation does not trigger `NAVIGATE ... not handled`.
- Verify skip from sport step navigates to a valid route.

## Messaging / Socket
- Open messaging list + conversation and verify only one active socket connection is used.
- Verify typing indicators and message events still work.
- Verify no repeated `Socket URL` logs.

## Events
- Open event feeds and verify event query logs are summarized (count/page/pageSize/total/queryHash).
- Verify featured and normal event lists still load and paginate.

