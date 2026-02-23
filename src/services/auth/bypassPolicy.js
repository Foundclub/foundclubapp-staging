export const isFirebaseBypassEnabled = (env = process.env) => (
  String(env.APP_ENV || '').trim().toLowerCase() === 'local'
  && env.BYPASS_FIREBASE_AUTH === 'true'
);
