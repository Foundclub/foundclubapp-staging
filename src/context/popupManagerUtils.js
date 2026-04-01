import { POPUP_DISMISS_SCOPES, POPUP_KINDS } from '@/constants/popupRegistry';

export const POPUP_DAILY_DISMISS_MS = 24 * 60 * 60 * 1000;

export const buildPopupDismissKey = (popupId, cooldownKey = 'default') => (
  `popup.dismiss.${String(popupId || '').trim()}.${String(cooldownKey || 'default').trim() || 'default'}`
);

export const parsePopupDismissalRecord = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      dismissedAt: Number(parsed.dismissedAt || 0),
      scope: String(parsed.scope || ''),
      stateKey: typeof parsed.stateKey === 'string' ? parsed.stateKey : undefined,
    };
  } catch (_error) {
    return null;
  }
};

export const serializePopupDismissalRecord = ({
  dismissedAt = Date.now(),
  scope,
  stateKey,
}) => JSON.stringify({
  dismissedAt,
  scope,
  ...(stateKey ? { stateKey } : {}),
});

export const isPopupDismissalActive = (record, options = {}) => {
  if (!record?.scope) return false;

  const now = Number(options.now || Date.now());
  const nextStateKey = typeof options.stateKey === 'string' ? options.stateKey : '';

  switch (record.scope) {
    case POPUP_DISMISS_SCOPES.DAY:
      return now - Number(record.dismissedAt || 0) < POPUP_DAILY_DISMISS_MS;
    case POPUP_DISMISS_SCOPES.PERSISTED:
      return true;
    case POPUP_DISMISS_SCOPES.UNTIL_STATE_CHANGES:
      return Boolean(record.stateKey) && record.stateKey === nextStateKey;
    default:
      return false;
  }
};

export const shouldDeferStartupPopup = ({
  descriptor,
  isStartupWindowActive,
  shownStartupBlockingPopupId,
}) => {
  if (!descriptor?.id) return false;
  if (!isStartupWindowActive) return false;

  if (
    descriptor.kind === POPUP_KINDS.STARTUP_BLOCKING
    && descriptor.blocking
    && shownStartupBlockingPopupId
    && shownStartupBlockingPopupId !== descriptor.id
  ) {
    return true;
  }

  if (descriptor.deferIfRecentStartupPopup && shownStartupBlockingPopupId) {
    return true;
  }

  return false;
};
