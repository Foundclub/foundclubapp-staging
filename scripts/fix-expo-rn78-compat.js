/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const expoFactoryPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'ios',
  'AppDelegates',
  'ExpoReactNativeFactory.swift',
);

const replacementBlock = `    // RN 0.78 compatibility:
    // \`RCTRootViewFactoryConfiguration.loadSourceForBridgeWithProgress\`
    // is available in newer RN versions only.
    // Keep this disabled to avoid iOS compile failure on current stack.
`;

const run = () => {
  if (!fs.existsSync(expoFactoryPath)) {
    console.log('[postinstall] expo compatibility patch skipped: file not found.');
    return;
  }

  const content = fs.readFileSync(expoFactoryPath, 'utf8');
  if (!content.includes('configuration.loadSourceForBridgeWithProgress')) {
    console.log('[postinstall] expo compatibility patch skipped: API already absent.');
    return;
  }

  const blockPattern =
    / {4}configuration\.loadSourceForBridgeWithProgress = \{ bridge, onProgress, onComplete in\r?\n {6}weakDelegate\.loadSource\(for: bridge, onProgress: onProgress, onComplete: onComplete\)\r?\n {4}\}\r?\n/;

  const patched = content.replace(blockPattern, replacementBlock);
  if (patched === content) {
    console.warn('[postinstall] expo compatibility patch could not be applied (unexpected format).');
    return;
  }

  fs.writeFileSync(expoFactoryPath, patched, 'utf8');
  console.log('[postinstall] expo RN0.78 compatibility patch applied.');
};

run();
