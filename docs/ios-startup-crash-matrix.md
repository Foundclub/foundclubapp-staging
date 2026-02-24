# iOS Startup Crash Investigation Matrix

## Scope
- Target issue: iPhone launch crash (`SIGABRT`, `ExceptionsManagerQueue`).
- Baseline GOOD IPA: `application-d41f88f8-abfd-4b5a-9d58-e3bf31fc79de.ipa`.
- Baseline CRASH IPA: `application-2d2a3b59-652e-4d80-917d-fbd49d287353.ipa`.

## Known Binary Facts
- `Info.plist` app-level values are identical between GOOD and CRASH.
- `GoogleService-Info.plist` is present in both.
- `modules.json` adds `react-native-document-picker@9.2.0` in CRASH.
- CRASH bundle contains new notification/MMKV bootstrap fallback strings.

## Build Matrix
| Build ID | Commit | Profile | Flags | Install Type | Launch Attempts | Crash | Notes |
|---|---|---|---|---|---|---|---|
| d41f88f8-abfd-4b5a-9d58-e3bf31fc79de | (fill) | staging | default | clean install | 3 | No | GOOD baseline |
| 2d2a3b59-652e-4d80-917d-fbd49d287353 | (fill) | staging | default | clean install | 3 | Yes | CRASH baseline |
| (fill) | `3dad555` | staging | default | clean + upgrade | 3 + 1 | (fill) | bisect step 1 |
| (fill) | `b602d4d` | staging | default | clean + upgrade | 3 + 1 | (fill) | bisect step 2 |
| (fill) | `c9f5440` | staging | default | clean + upgrade | 3 + 1 | (fill) | bisect step 3 |
| (fill) | culprit commit | staging | `FC_DISABLE_NOTIFICATIONS_BOOTSTRAP=1` | clean + upgrade | 3 + 1 | (fill) | isolation A |
| (fill) | culprit commit | staging | `FC_DISABLE_DOCUMENT_PICKER=1` | clean + upgrade | 3 + 1 | (fill) | isolation B |

## Test Procedure (strict)
1. Clean install scenario:
   - Remove app from iPhone.
   - Install IPA.
   - Launch app 3 times (force close between launches).
2. Upgrade scenario:
   - Install prior build.
   - Install current build over it.
   - Launch once.
3. For each failure:
   - Save `.ips` crash report.
   - Record timestamp and build id in this matrix.

## Required Runtime Markers
- `[BOOT] BOOT_APP_START`
- `[BOOT] BOOT_STORE_READY`
- `[BOOT] BOOT_NOTIFICATIONS_READY` or `[BOOT] BOOT_NOTIFICATIONS_DISABLED`

## Flag Controls
- `FC_DISABLE_NOTIFICATIONS_BOOTSTRAP=1` disables `NotificationBootstrap`.
- `FC_DISABLE_DOCUMENT_PICKER=1` disables file picker action in Conversation.

## EAS Build Commands
```bash
# default staging
eas build --platform ios --profile staging

# isolation A: disable notification bootstrap
FC_DISABLE_NOTIFICATIONS_BOOTSTRAP=1 eas build --platform ios --profile staging

# isolation B: disable document picker
FC_DISABLE_DOCUMENT_PICKER=1 eas build --platform ios --profile staging
```

```powershell
# default staging
eas build --platform ios --profile staging

# isolation A: disable notification bootstrap
$env:FC_DISABLE_NOTIFICATIONS_BOOTSTRAP="1"; eas build --platform ios --profile staging

# isolation B: disable document picker
$env:FC_DISABLE_DOCUMENT_PICKER="1"; eas build --platform ios --profile staging
```
