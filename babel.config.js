// Logique améliorée pour le choix du fichier d'environnement
const getEnvPath = () => {
  if (process.env.APP_ENV === 'staging') return '.env.staging';
  if (process.env.APP_ENV === 'production') return '.env.production';
  return '.env.local'; // Par défaut (APP_ENV=local ou vide), on prend le .env.local
};

module.exports = {
  plugins: [
    [
      'module-resolver',
      {
        alias: { '@': './src' },
        extensions: ['.js', '.json'],
        root: ['./src'],
      },
    ],
    ['inline-dotenv', { 
      path: getEnvPath() 
    }],
    'react-native-reanimated/plugin',
  ],
  presets: ['module:@react-native/babel-preset'],
};
