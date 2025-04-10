module.exports = {
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@': './src',
        },
        extensions: ['.js', '.json'],
        root: ['./src'],
      },
    ],
    'inline-dotenv',
    'react-native-reanimated/plugin',
  ],
  presets: ['module:@react-native/babel-preset'],
};
