import { NativeModules, Platform } from 'react-native';

import { buildInviteUrlFromInstallReferrer } from '@/domains/invitations/deferredInvite';
import { readInviteLink } from '@/domains/invitations/inviteLink';
import { storage } from '@/store/appContext';

const INSTALL_REFERRER_READ_KEY = 'deferredInvite.installReferrer.v1';
const IOS_CLIPBOARD_OFFER_KEY = 'deferredInvite.iosClipboardOffer.v1';
const DONE = 'done';

const loadClipboard = () => {
  // Chargement a la demande : Android et les tests sans module natif ne doivent pas l'initialiser.
  // eslint-disable-next-line global-require
  const clipboardModule = require('@react-native-clipboard/clipboard');
  return clipboardModule.default || clipboardModule;
};

/**
 * Android uniquement : interroge Google Play une fois apres l'installation.
 * Un echec temporaire n'est pas memorise, afin qu'un prochain lancement puisse
 * reessayer. Une reponse Play, meme organique, est definitive pour l'installation.
 * @returns {Promise<string | null>} lien canonique INVIT2, ou null.
 */
export const readAndroidDeferredInviteUrl = async () => {
  if (Platform.OS !== 'android') return null;
  if (storage.getString(INSTALL_REFERRER_READ_KEY) === DONE) return null;

  const readReferrer = NativeModules?.FoundClubInstallReferrer?.getInstallReferrer;
  if (typeof readReferrer !== 'function') return null;

  try {
    const rawReferrer = await readReferrer();
    storage.set(INSTALL_REFERRER_READ_KEY, DONE);
    return buildInviteUrlFromInstallReferrer(rawReferrer);
  } catch (_error) {
    return null;
  }
};

/**
 * iOS : verifier la presence d'une URL ne lit pas le presse-papiers et ne
 * declenche pas l'alerte de confidentialite. La vraie lecture reste reservee
 * au bouton explicite « Reprendre ».
 * @returns {Promise<boolean>}
 */
export const shouldOfferIOSClipboardInvite = async () => {
  if (Platform.OS !== 'ios') return false;
  if (storage.getString(IOS_CLIPBOARD_OFFER_KEY) === DONE) return false;

  try {
    const Clipboard = loadClipboard();
    const hasURL = await Clipboard.hasWebURL?.();
    storage.set(IOS_CLIPBOARD_OFFER_KEY, DONE);
    return hasURL === true;
  } catch (_error) {
    return false;
  }
};

/**
 * Lecture consentie par l'appui utilisateur ; les URL etrangeres sont ignorees.
 * @returns {Promise<string | null>}
 */
export const readIOSClipboardInviteUrl = async () => {
  if (Platform.OS !== 'ios') return null;
  try {
    const Clipboard = loadClipboard();
    const rawUrl = await Clipboard.getString();
    return readInviteLink(rawUrl).ok ? rawUrl : null;
  } catch (_error) {
    return null;
  }
};
