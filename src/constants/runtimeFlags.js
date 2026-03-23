const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

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

const enablePushNotifications = legacyForceNotificationsBootstrapDisabled
  ? false
  : Boolean(explicitPushNotificationsEnabled || legacyForceNotificationsBootstrapEnabled);
const enableSmartNotifications = explicitSmartNotificationsEnabled;

let notificationsBootstrapPolicy = 'disabled-by-default';

if (enablePushNotifications) {
  notificationsBootstrapPolicy = explicitPushNotificationsEnabled
    ? 'enabled-by-explicit-flag'
    : 'enabled-by-legacy-flag';
} else if (legacyForceNotificationsBootstrapDisabled) {
  notificationsBootstrapPolicy = 'disabled-by-legacy-flag';
}

export const ENABLE_PUSH_NOTIFICATIONS = enablePushNotifications;
export const ENABLE_SMART_NOTIFICATIONS = enableSmartNotifications;
export const ENABLE_NOTIFICATION_TEST_TRIGGER = explicitNotificationTestTriggerEnabled;
export const DISABLE_NOTIFICATIONS_BOOTSTRAP = !enablePushNotifications;
export const NOTIFICATIONS_BOOTSTRAP_POLICY = notificationsBootstrapPolicy;
