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
    ['inline-dotenv', {
      path: (() => {
        const env = process.env.APP_ENV || 'staging';
        if (env === 'local') return '.env.local';
        if (env === 'production') return '.env.production';
        return '.env.staging';
      })()
    }],
    'react-native-reanimated/plugin',
  ],
  presets: ['module:@react-native/babel-preset'],
};
