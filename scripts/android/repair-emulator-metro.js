const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PACKAGE_NAME = 'com.foundclub.staging';
const DEFAULT_DEV_HOST = '10.0.2.2:8081';
const DEFAULT_PORT = '8081';
const DEFAULT_API_PORT = '1337';

const packageName = process.argv[2] || DEFAULT_PACKAGE_NAME;
const devHost = process.argv[3] || DEFAULT_DEV_HOST;
const port = devHost.split(':')[1] || DEFAULT_PORT;

const adbCandidates = [
  process.env.ADB_PATH,
  process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : null,
  process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe') : null,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe') : null,
  'adb',
].filter(Boolean);

const resolveAdbPath = () => {
  const candidate = adbCandidates.find((entry) => entry === 'adb' || fs.existsSync(entry));
  if (!candidate) {
    throw new Error('Impossible de trouver adb.');
  }
  return candidate;
};

const adbPath = resolveAdbPath();

const runAdb = (args, options = {}) => {
  const {
    allowFailure = false,
    encoding = 'utf8',
    stdio = 'pipe',
  } = options;

  try {
    return execFileSync(adbPath, args, { encoding, stdio });
  } catch (error) {
    if (allowFailure) {
      return null;
    }
    throw error;
  }
};

const parseConnectedDevices = (rawOutput) => rawOutput
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(/\s+/))
  .filter(([deviceId, status]) => deviceId && status === 'device')
  .map(([deviceId]) => deviceId);

const connectedDevices = parseConnectedDevices(runAdb(['devices']));
const emulatorDevices = connectedDevices.filter((deviceId) => deviceId.startsWith('emulator-'));

if (emulatorDevices.length === 0) {
  console.log('[metro-repair] Aucun emulateur Android detecte. Rien a faire.');
  process.exit(0);
}

const prefsPath = `/data/user/0/${packageName}/shared_prefs/${packageName}_preferences.xml`;
const reverseArgs = [`tcp:${port}`, `tcp:${port}`];
const apiReverseArgs = [`tcp:${DEFAULT_API_PORT}`, `tcp:${DEFAULT_API_PORT}`];
const sedPattern = `s#127.0.0.1:${port}#${devHost}#g`;

emulatorDevices.forEach((deviceId) => {
  console.log(`[metro-repair] ${deviceId}: adb reverse ${reverseArgs.join(' ')}`);
  runAdb(['-s', deviceId, 'reverse', ...reverseArgs], { stdio: 'inherit' });
  console.log(`[metro-repair] ${deviceId}: adb reverse ${apiReverseArgs.join(' ')}`);
  runAdb(['-s', deviceId, 'reverse', ...apiReverseArgs], { stdio: 'inherit' });

  const currentPrefs = runAdb(
    ['-s', deviceId, 'shell', 'run-as', packageName, 'cat', prefsPath],
    { allowFailure: true },
  );

  if (!currentPrefs) {
    console.log(
      `[metro-repair] ${deviceId}: preferences introuvables pour ${packageName}. Ouvrez l'app une fois puis relancez cette commande si besoin.`,
    );
    return;
  }

  if (String(currentPrefs).includes(devHost)) {
    console.log(`[metro-repair] ${deviceId}: debug_http_host deja regle sur ${devHost}.`);
    return;
  }

  runAdb(
    ['-s', deviceId, 'shell', 'run-as', packageName, 'sed', '-i', sedPattern, prefsPath],
    { stdio: 'inherit' },
  );

  const updatedPrefs = runAdb(
    ['-s', deviceId, 'shell', 'run-as', packageName, 'cat', prefsPath],
    { allowFailure: true },
  );

  if (updatedPrefs && String(updatedPrefs).includes(devHost)) {
    console.log(`[metro-repair] ${deviceId}: debug_http_host mis a jour vers ${devHost}.`);
    return;
  }

  console.warn(
    `[metro-repair] ${deviceId}: impossible de verifier la mise a jour de debug_http_host.`,
  );
});
