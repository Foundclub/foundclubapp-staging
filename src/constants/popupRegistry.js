export const POPUP_KINDS = {
  IN_APP_BLOCKING: 'in_app_blocking',
  NON_BLOCKING: 'non_blocking',
  STARTUP_BLOCKING: 'startup_blocking',
};

export const POPUP_SURFACES = {
  BANNER: 'banner',
  BOTTOM_SHEET: 'bottom_sheet',
  MODAL: 'modal',
  NATIVE_ALERT: 'native_alert',
};

export const POPUP_DISMISS_SCOPES = {
  DAY: 'day',
  PERSISTED: 'persisted',
  SESSION: 'session',
  UNTIL_STATE_CHANGES: 'until_state_changes',
};

export const POPUP_IDS = {
  BOOT_ERROR_ALERT: 'boot-error-alert',
  EXTERNAL_COMPETITION_PROMPT: 'external-competition-prompt',
  HOME_HUB_ENTRY_GATE: 'home-hub-entry-gate',
  LEAGUE_ACTION_PROMPT: 'league-action-prompt',
  LEAGUE_COUNTER_PROPOSAL: 'league-counter-proposal',
  MATCH_STATS_PROMPT: 'match-stats-prompt',
  NOTIFICATION_CALENDAR_ALERT: 'notification-calendar-alert',
  ONBOARDING_OVERLAY: 'onboarding-overlay',
  PUSH_PERMISSION_PREPROMPT: 'push-permission-preprompt',
  SMART_LINEUP_REMINDER: 'smart-lineup-reminder',
  SMART_MATCH_RECAP: 'smart-match-recap',
  TEAM_ASSIGN_TRAINER_GUIDE: 'team-assign-trainer-guide',
};

/**
 * @typedef {{
 *  id: string;
 *  kind: string;
 *  surface: string;
 *  priority: number;
 *  blocking: boolean;
 *  dismissScope?: string;
 *  allowedRoutes?: string[];
 *  deferIfRecentStartupPopup?: boolean;
 * }} PopupDescriptor
 */

/** @type {Record<string, PopupDescriptor>} */
export const POPUP_REGISTRY = {
  [POPUP_IDS.BOOT_ERROR_ALERT]: {
    blocking: true,
    id: POPUP_IDS.BOOT_ERROR_ALERT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 100,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.PUSH_PERMISSION_PREPROMPT]: {
    blocking: true,
    dismissScope: POPUP_DISMISS_SCOPES.DAY,
    id: POPUP_IDS.PUSH_PERMISSION_PREPROMPT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 90,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.LEAGUE_COUNTER_PROPOSAL]: {
    blocking: true,
    id: POPUP_IDS.LEAGUE_COUNTER_PROPOSAL,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 75,
    surface: POPUP_SURFACES.BOTTOM_SHEET,
  },
  [POPUP_IDS.LEAGUE_ACTION_PROMPT]: {
    blocking: true,
    id: POPUP_IDS.LEAGUE_ACTION_PROMPT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 70,
    surface: POPUP_SURFACES.BOTTOM_SHEET,
  },
  [POPUP_IDS.MATCH_STATS_PROMPT]: {
    blocking: true,
    id: POPUP_IDS.MATCH_STATS_PROMPT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 65,
    surface: POPUP_SURFACES.BOTTOM_SHEET,
  },
  [POPUP_IDS.NOTIFICATION_CALENDAR_ALERT]: {
    blocking: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: POPUP_IDS.NOTIFICATION_CALENDAR_ALERT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 60,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.SMART_MATCH_RECAP]: {
    blocking: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: POPUP_IDS.SMART_MATCH_RECAP,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 50,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.SMART_LINEUP_REMINDER]: {
    blocking: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: POPUP_IDS.SMART_LINEUP_REMINDER,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 45,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.EXTERNAL_COMPETITION_PROMPT]: {
    blocking: true,
    deferIfRecentStartupPopup: true,
    dismissScope: POPUP_DISMISS_SCOPES.DAY,
    id: POPUP_IDS.EXTERNAL_COMPETITION_PROMPT,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 40,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.TEAM_ASSIGN_TRAINER_GUIDE]: {
    blocking: true,
    deferIfRecentStartupPopup: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: POPUP_IDS.TEAM_ASSIGN_TRAINER_GUIDE,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 35,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.HOME_HUB_ENTRY_GATE]: {
    blocking: true,
    deferIfRecentStartupPopup: true,
    dismissScope: POPUP_DISMISS_SCOPES.DAY,
    id: POPUP_IDS.HOME_HUB_ENTRY_GATE,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 25,
    surface: POPUP_SURFACES.MODAL,
  },
  [POPUP_IDS.ONBOARDING_OVERLAY]: {
    blocking: true,
    deferIfRecentStartupPopup: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: POPUP_IDS.ONBOARDING_OVERLAY,
    kind: POPUP_KINDS.STARTUP_BLOCKING,
    priority: 20,
    surface: POPUP_SURFACES.MODAL,
  },
};

export const getPopupDescriptor = (popupId) => {
  const descriptor = POPUP_REGISTRY[String(popupId || '').trim()];
  if (descriptor) {
    return descriptor;
  }

  return {
    blocking: true,
    dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    id: String(popupId || '').trim(),
    kind: POPUP_KINDS.IN_APP_BLOCKING,
    priority: 0,
    surface: POPUP_SURFACES.MODAL,
  };
};
