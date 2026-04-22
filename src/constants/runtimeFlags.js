const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const hasExplicitFlagValue = (rawValue) => (
  typeof rawValue === 'string' && rawValue.trim().length > 0
);

const appRuntimeEnv = String(process.env.APP_ENV || process.env.ENV || '').trim().toLowerCase();
const notificationsDefaultEnabledForEnv = appRuntimeEnv === 'staging' || appRuntimeEnv === 'production';

const legacyForceNotificationsBootstrapDisabled = parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);
const legacyForceNotificationsBootstrapEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_NOTIFICATIONS_BOOTSTRAP,
);
const explicitPushNotificationsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_PUSH_NOTIFICATIONS,
);
const explicitSmartNotificationsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_SMART_NOTIFICATIONS,
);
const explicitNotificationTestTriggerEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_NOTIFICATION_TEST_TRIGGER,
);
const explicitStartupTutorialsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_STARTUP_TUTORIALS,
);
const explicitLeagueActionPromptsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_LEAGUE_ACTION_PROMPTS,
);
const explicitMatchStatsPromptsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_MATCH_STATS_PROMPTS,
);
const explicitRemotePopupCampaignsEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_REMOTE_POPUP_CAMPAIGNS,
);

const hasExplicitPushFlag = hasExplicitFlagValue(process.env.FC_ENABLE_PUSH_NOTIFICATIONS);
const hasExplicitSmartFlag = hasExplicitFlagValue(process.env.FC_ENABLE_SMART_NOTIFICATIONS);
const hasExplicitStartupTutorialsFlag = hasExplicitFlagValue(process.env.FC_ENABLE_STARTUP_TUTORIALS);
const hasExplicitLeagueActionPromptsFlag = hasExplicitFlagValue(process.env.FC_ENABLE_LEAGUE_ACTION_PROMPTS);
const hasExplicitMatchStatsPromptsFlag = hasExplicitFlagValue(process.env.FC_ENABLE_MATCH_STATS_PROMPTS);
const hasExplicitRemotePopupCampaignsFlag = hasExplicitFlagValue(process.env.FC_ENABLE_REMOTE_POPUP_CAMPAIGNS);

let enablePushNotifications = false;
let notificationsBootstrapPolicy = 'disabled-by-default-local';

if (legacyForceNotificationsBootstrapDisabled) {
  enablePushNotifications = false;
  notificationsBootstrapPolicy = 'disabled-by-legacy-flag';
} else if (hasExplicitPushFlag) {
  enablePushNotifications = explicitPushNotificationsEnabled;
  notificationsBootstrapPolicy = explicitPushNotificationsEnabled
    ? 'enabled-by-explicit-flag'
    : 'disabled-by-explicit-flag';
} else if (legacyForceNotificationsBootstrapEnabled) {
  enablePushNotifications = true;
  notificationsBootstrapPolicy = 'enabled-by-legacy-flag';
} else if (notificationsDefaultEnabledForEnv) {
  enablePushNotifications = true;
  notificationsBootstrapPolicy = 'enabled-by-default-for-env';
}

let enableSmartNotifications = false;
let smartNotificationsPolicy = 'disabled-by-default-local';

if (hasExplicitSmartFlag) {
  enableSmartNotifications = explicitSmartNotificationsEnabled;
  smartNotificationsPolicy = explicitSmartNotificationsEnabled
    ? 'enabled-by-explicit-flag'
    : 'disabled-by-explicit-flag';
} else if (notificationsDefaultEnabledForEnv && enablePushNotifications) {
  enableSmartNotifications = true;
  smartNotificationsPolicy = 'enabled-by-default-for-env';
}

const enableNotificationTestTrigger = appRuntimeEnv === 'local'
  && explicitNotificationTestTriggerEnabled;
const enableStartupTutorials = hasExplicitStartupTutorialsFlag
  ? explicitStartupTutorialsEnabled
  : true;
const enableLeagueActionPrompts = hasExplicitLeagueActionPromptsFlag
  ? explicitLeagueActionPromptsEnabled
  : true;
const enableMatchStatsPrompts = hasExplicitMatchStatsPromptsFlag
  ? explicitMatchStatsPromptsEnabled
  : true;
const enableRemotePopupCampaigns = hasExplicitRemotePopupCampaignsFlag
  ? explicitRemotePopupCampaignsEnabled
  : true;

export const ENABLE_PUSH_NOTIFICATIONS = enablePushNotifications;
export const ENABLE_SMART_NOTIFICATIONS = enableSmartNotifications;
export const ENABLE_NOTIFICATION_TEST_TRIGGER = enableNotificationTestTrigger;
export const ENABLE_STARTUP_TUTORIALS = enableStartupTutorials;
export const ENABLE_LEAGUE_ACTION_PROMPTS = enableLeagueActionPrompts;
export const ENABLE_MATCH_STATS_PROMPTS = enableMatchStatsPrompts;
export const ENABLE_REMOTE_POPUP_CAMPAIGNS = enableRemotePopupCampaigns;
export const DISABLE_NOTIFICATIONS_BOOTSTRAP = !enablePushNotifications;
export const NOTIFICATIONS_BOOTSTRAP_POLICY = notificationsBootstrapPolicy;
export const APP_RUNTIME_ENV = appRuntimeEnv || 'unknown';
export const SMART_NOTIFICATIONS_POLICY = smartNotificationsPolicy;
export const NOTIFICATIONS_RUNTIME_CONFIG = {
  appEnv: appRuntimeEnv || 'unknown',
  push: {
    enabled: enablePushNotifications,
    policy: notificationsBootstrapPolicy,
    shouldEnableByDefault: notificationsDefaultEnabledForEnv,
  },
  smart: {
    enabled: enableSmartNotifications,
    policy: smartNotificationsPolicy,
  },
  startupGuards: {
    leagueActionPrompts: enableLeagueActionPrompts,
    matchStatsPrompts: enableMatchStatsPrompts,
    remotePopupCampaigns: enableRemotePopupCampaigns,
    tutorials: enableStartupTutorials,
  },
  testTrigger: {
    enabled: enableNotificationTestTrigger,
    localOnly: true,
  },
};
