import { Platform } from 'react-native';

const parseBooleanFlag = (rawValue) => {
  if (typeof rawValue !== 'string') return false;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const forceNotificationsBootstrapDisabled = parseBooleanFlag(
  process.env.FC_DISABLE_NOTIFICATIONS_BOOTSTRAP,
);
const forceNotificationsBootstrapEnabled = parseBooleanFlag(
  process.env.FC_ENABLE_NOTIFICATIONS_BOOTSTRAP,
);
const defaultNotificationsBootstrapDisabled = Platform.OS === 'ios';

let notificationsBootstrapPolicy = 'enabled-by-default';
let disableNotificationsBootstrap = false;

if (forceNotificationsBootstrapEnabled) {
  notificationsBootstrapPolicy = 'force-enabled-by-env';
  disableNotificationsBootstrap = false;
} else if (forceNotificationsBootstrapDisabled) {
  notificationsBootstrapPolicy = 'force-disabled-by-env';
  disableNotificationsBootstrap = true;
} else if (defaultNotificationsBootstrapDisabled) {
  notificationsBootstrapPolicy = 'disabled-by-default-on-ios';
  disableNotificationsBootstrap = true;
}

export const DISABLE_NOTIFICATIONS_BOOTSTRAP = disableNotificationsBootstrap;
export const NOTIFICATIONS_BOOTSTRAP_POLICY = notificationsBootstrapPolicy;
