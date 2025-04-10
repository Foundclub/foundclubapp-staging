const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const {
  withSentryConfig,
} = require('@sentry/react-native/metro');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = withSentryConfig(
  wrapWithReanimatedMetroConfig(mergeConfig(getDefaultConfig(__dirname), config)),
);
