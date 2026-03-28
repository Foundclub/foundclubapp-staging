import {
  getAuth,
  signInWithPhoneNumber as firebaseSignInWithPhoneNumber,
} from '@react-native-firebase/auth';

export const getAuthInstance = () => getAuth();

export const sendOtp = async (phoneNumber) => firebaseSignInWithPhoneNumber(getAuthInstance(), phoneNumber);

export const confirmOtp = async ({ code, confirmation }) => confirmation.confirm(code);

export const getCurrentUser = () => getAuthInstance().currentUser;

export const onAuthStateChanged = (callback) => getAuthInstance().onAuthStateChanged(callback);

export const logout = async () => {
  const auth = getAuthInstance();
  if (!auth?.currentUser) {
    return;
  }

  await auth.signOut();
};

export default {
  confirmOtp,
  getAuthInstance,
  getCurrentUser,
  logout,
  onAuthStateChanged,
  sendOtp,
};
