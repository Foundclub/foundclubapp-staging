import {
  buildPopupDismissKey,
  isPopupDismissalActive,
  parsePopupDismissalRecord,
  serializePopupDismissalRecord,
  shouldDeferStartupPopup,
} from '@/context/popupManagerUtils';

import { POPUP_DISMISS_SCOPES, POPUP_KINDS } from '@/constants/popupRegistry';

describe('popupManagerUtils', () => {
  test('buildPopupDismissKey keeps popup id and cooldown key readable', () => {
    expect(buildPopupDismissKey('calendar', 'match-42')).toBe('popup.dismiss.calendar.match-42');
  });

  test('daily dismissals expire after 24 hours', () => {
    const now = Date.UTC(2026, 2, 31, 10, 0, 0);
    const recent = parsePopupDismissalRecord(serializePopupDismissalRecord({
      dismissedAt: now - (60 * 60 * 1000),
      scope: POPUP_DISMISS_SCOPES.DAY,
    }));
    const stale = parsePopupDismissalRecord(serializePopupDismissalRecord({
      dismissedAt: now - (26 * 60 * 60 * 1000),
      scope: POPUP_DISMISS_SCOPES.DAY,
    }));

    expect(isPopupDismissalActive(recent, { now })).toBe(true);
    expect(isPopupDismissalActive(stale, { now })).toBe(false);
  });

  test('until_state_changes dismissals remain active only for the same state key', () => {
    const record = parsePopupDismissalRecord(serializePopupDismissalRecord({
      scope: POPUP_DISMISS_SCOPES.UNTIL_STATE_CHANGES,
      stateKey: 'team-a|team-b',
    }));

    expect(isPopupDismissalActive(record, { stateKey: 'team-a|team-b' })).toBe(true);
    expect(isPopupDismissalActive(record, { stateKey: 'team-a|team-c' })).toBe(false);
  });

  test('startup blocking popups defer when another startup popup already showed in the quiet window', () => {
    expect(shouldDeferStartupPopup({
      descriptor: {
        blocking: true,
        id: 'match-stats-prompt',
        kind: POPUP_KINDS.STARTUP_BLOCKING,
      },
      isStartupWindowActive: true,
      shownStartupBlockingPopupId: 'boot-error-alert',
    })).toBe(true);
  });

  test('non-blocking discovery popups can also be deferred by a recent startup popup', () => {
    expect(shouldDeferStartupPopup({
      descriptor: {
        blocking: true,
        deferIfRecentStartupPopup: true,
        id: 'external-competition-prompt',
        kind: POPUP_KINDS.STARTUP_BLOCKING,
      },
      isStartupWindowActive: true,
      shownStartupBlockingPopupId: 'league-action-prompt',
    })).toBe(true);
  });
});
