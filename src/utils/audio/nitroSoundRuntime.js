import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { createLogger } from '@/utils/logger/logger';

const nitroRuntimeLogger = createLogger('nitro-sound-runtime');

let cachedCanLoadNitroSoundModule;
let hasLoggedNitroDisableReason = false;
const nitroGlobal = global;

const safeRead = (resolver, fallback = null) => {
  try {
    return resolver();
  } catch (_error) {
    return fallback;
  }
};

const hasInstalledNitroRuntime = () => Boolean(
  safeRead(() => nitroGlobal?.NitroModulesProxy, null)
  // eslint-disable-next-line no-underscore-dangle
  && safeRead(() => nitroGlobal?.__nitroJsiCache, null)
  // eslint-disable-next-line no-underscore-dangle
  && safeRead(() => nitroGlobal?.__nitroDispatcher, null),
);

const hasNitroNativeModule = () => Boolean(
  safeRead(() => TurboModuleRegistry?.get?.('NitroModules'), null)
  || safeRead(() => NativeModules?.NitroModules, null),
);

const logNitroDisableReason = (reason) => {
  if (hasLoggedNitroDisableReason) return;
  hasLoggedNitroDisableReason = true;
  nitroRuntimeLogger.warn(reason, {
    isBridgeless: safeRead(() => global?.RN$Bridgeless === true, false) === true,
    platform: Platform.OS,
  });
};

export const canLoadNitroSoundModule = () => {
  if (cachedCanLoadNitroSoundModule !== undefined) {
    return cachedCanLoadNitroSoundModule;
  }

  if (hasInstalledNitroRuntime()) {
    cachedCanLoadNitroSoundModule = true;
    return cachedCanLoadNitroSoundModule;
  }

  const isBridgeless = safeRead(() => global?.RN$Bridgeless === true, false) === true;
  if (Platform.OS === 'android' && isBridgeless) {
    cachedCanLoadNitroSoundModule = false;
    logNitroDisableReason('Nitro Sound disabled on Android bridgeless runtime');
    return cachedCanLoadNitroSoundModule;
  }

  cachedCanLoadNitroSoundModule = hasNitroNativeModule();
  if (!cachedCanLoadNitroSoundModule) {
    logNitroDisableReason('Nitro Sound native module unavailable');
  }
  return cachedCanLoadNitroSoundModule;
};
