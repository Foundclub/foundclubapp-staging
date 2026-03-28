import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';

const DEFAULT_RECAPTCHA_CONTAINER_ID = 'fc-recaptcha-container';

let recaptchaVerifier = null;

const getFirebaseConfig = () => ({
  apiKey: String(process.env.WEB_FIREBASE_API_KEY || ''),
  appId: String(process.env.WEB_FIREBASE_APP_ID || ''),
  authDomain: String(process.env.WEB_FIREBASE_AUTH_DOMAIN || ''),
  messagingSenderId: String(process.env.WEB_FIREBASE_MESSAGING_SENDER_ID || ''),
  projectId: String(process.env.WEB_FIREBASE_PROJECT_ID || ''),
  storageBucket: String(process.env.WEB_FIREBASE_STORAGE_BUCKET || ''),
});

const isFirebaseConfigured = () => {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.appId && config.authDomain && config.projectId);
};

const ensureRecaptchaContainer = (containerId = DEFAULT_RECAPTCHA_CONTAINER_ID) => {
  if (typeof document === 'undefined') {
    return containerId;
  }

  const existingNode = document.getElementById(containerId);
  if (existingNode) {
    return containerId;
  }

  const nextNode = document.createElement('div');
  nextNode.id = containerId;
  nextNode.style.position = 'fixed';
  nextNode.style.bottom = '0';
  nextNode.style.left = '0';
  nextNode.style.opacity = '0';
  nextNode.style.pointerEvents = 'none';
  document.body.appendChild(nextNode);
  return containerId;
};

const getFirebaseApp = () => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase Web n est pas configure pour cette application.');
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseConfig());
};

export const getAuthInstance = () => getAuth(getFirebaseApp());

export const resetRecaptcha = () => {
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;
};

const getOrCreateRecaptchaVerifier = async (containerId = DEFAULT_RECAPTCHA_CONTAINER_ID) => {
  if (typeof document === 'undefined') {
    throw new Error('Le navigateur est requis pour initialiser le reCAPTCHA.');
  }

  const resolvedContainerId = ensureRecaptchaContainer(containerId);
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(getAuthInstance(), resolvedContainerId, {
      size: 'invisible',
    });
  }

  await recaptchaVerifier.render();
  return recaptchaVerifier;
};

export const sendOtp = async (phoneNumber, options = {}) => {
  const verifier = await getOrCreateRecaptchaVerifier(options.containerId);
  return signInWithPhoneNumber(getAuthInstance(), phoneNumber, verifier);
};

export const confirmOtp = async ({ code, confirmation }) => confirmation.confirm(code);

export const getCurrentUser = () => {
  if (!isFirebaseConfigured()) return null;
  return getAuthInstance().currentUser;
};

export const onAuthStateChanged = (callback) => {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }

  return getAuthInstance().onAuthStateChanged(callback);
};

export const logout = async () => {
  if (!isFirebaseConfigured()) {
    resetRecaptcha();
    return;
  }

  await signOut(getAuthInstance());
  resetRecaptcha();
};

export default {
  confirmOtp,
  getAuthInstance,
  getCurrentUser,
  logout,
  onAuthStateChanged,
  resetRecaptcha,
  sendOtp,
};
