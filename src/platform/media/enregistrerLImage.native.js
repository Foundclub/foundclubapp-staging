// @ts-nocheck
/**
 * app/src/platform/media/enregistrerLImage.native.js
 *
 * MSGIMG — ENREGISTRER DANS LA GALERIE une image recue dans une conversation.
 * 🗣️ Adel, 20/10/2026 : « il faut qu'on puisse l'enregistrer dans sa galerie, l'image.
 * La telecharger. »
 *
 * 🧩 CE QUI EXISTAIT DEJA, ET QU ON REPREND (§1 bis, barreau 2) :
 *  - le geste de la carte joueur (`useShareCard.js`) : `CameraRoll.saveAsset`, avec la
 *    permission d'ecriture demandee SEULEMENT sur Android <= 9 ;
 *  - le rapatriement d'un fichier distant (`downloadRemoteFile.native.js`) :
 *    `react-native-blob-util` dans le cache, charge A LA DEMANDE (il n'est pas transforme
 *    par Jest : un import en tete ferait tomber les suites qui ne le connaissent pas).
 *    La galerie d'Android n'accepte qu'un fichier LOCAL : on rapatrie d'abord.
 *
 * ⚠️ PAS D'ALBUM SUR IPHONE, ET C EST VOULU. La bibliotheque ne demande sur iOS que
 * l'acces « ajout » (`NSPhotoLibraryAddUsageDescription`, `requestAddOnly`) ; or
 * retrouver ou creer un album exige l'acces COMPLET a la phototheque. Avec un album,
 * l'enregistrement echouerait sans meme demander. L'image va donc dans « Photos »
 * (pellicule) sur iPhone, et dans DCIM/FoundClub sur Android.
 *
 * Chaque echec porte une raison NOMMEE (`error.reason`) : l'ecran en tire sa phrase,
 * en particulier le refus d'acces, qui renvoie vers les reglages.
 */
import i18next from 'i18next';
import { PermissionsAndroid, Platform } from 'react-native';

import { extensionDeLUrl } from '@/platform/media/downloadRemoteFile';

/** Ce qui a empeche l'enregistrement — porte par `error.reason`. */
export const ECHECS_D_ENREGISTREMENT = {
  HTTP: 'http_error',
  PERMISSION: 'permission_refusee',
  SANS_ADRESSE: 'no_url',
};

/** L'album de la galerie Android (le meme que la carte joueur). */
export const ALBUM_ANDROID = 'FoundClub';

/**
 * `react-native-blob-util`, charge a la demande (cf. en tete).
 * @returns {any} Le module.
 */
const blobUtil = () => {
  // eslint-disable-next-line global-require -- chargement a la demande, cf. en tete
  const module = require('react-native-blob-util');
  return module?.default || module;
};

/**
 * `CameraRoll`, charge a la demande pour la meme raison.
 * @returns {any} La galerie.
 */
const galerie = () => {
  // eslint-disable-next-line global-require -- chargement a la demande, cf. en tete
  const module = require('@react-native-camera-roll/camera-roll');
  return module.CameraRoll;
};

/**
 * Une erreur qui porte sa raison.
 * @param {string} raison Une valeur de ECHECS_D_ENREGISTREMENT.
 * @param {string} message Le message, pour les journaux.
 * @returns {Error} L'erreur.
 */
const echec = (raison, message) => {
  const erreur = new Error(message);
  erreur.reason = raison;
  return erreur;
};

/**
 * Android <= 9 (API < 29) exige encore WRITE_EXTERNAL_STORAGE pour ecrire dans la galerie.
 * @returns {Promise<boolean>} Vrai si l'ecriture est permise.
 */
const ecriturePermise = async () => {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) return true;
  const statut = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  );
  return statut === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * La galerie a-t-elle refuse faute d'acces ? (iOS : E_PHOTO_LIBRARY_AUTH_DENIED / RESTRICTED)
 * @param {any} erreur L'erreur de CameraRoll.
 * @returns {boolean} Vrai pour un refus d'acces.
 */
const estUnRefusDAcces = (erreur) => /AUTH_DENIED|AUTH_RESTRICTED|denied|not authori[sz]ed/i
  .test(`${erreur?.code || ''} ${erreur?.message || ''}`);

/**
 * Enregistre une image (distante ou locale) dans la galerie du telephone.
 * @param {string} url L'adresse de l'image.
 * @returns {Promise<{ issue: 'enregistree' }>} L'issue.
 */
export const enregistrerLImage = async (url) => {
  const adresse = String(url || '').trim();
  if (!adresse) {
    throw echec(ECHECS_D_ENREGISTREMENT.SANS_ADRESSE, 'Aucune adresse d image a enregistrer.');
  }
  if (!(await ecriturePermise())) {
    throw echec(ECHECS_D_ENREGISTREMENT.PERMISSION, 'Ecriture dans la galerie refusee.');
  }

  let fichier = adresse;
  if (/^https?:\/\//i.test(adresse)) {
    const blob = blobUtil();
    const dossier = blob?.fs?.dirs?.CacheDir || blob?.fs?.dirs?.DocumentDir;
    const chemin = `${dossier}/foundclub-image-${Date.now()}.${extensionDeLUrl(adresse, 'jpg')}`;
    const reponse = await blob
      .config({ fileCache: true, overwrite: true, path: chemin })
      .fetch('GET', adresse);
    const code = Number(reponse?.info?.()?.status || 0);
    if (code >= 400) {
      throw echec(ECHECS_D_ENREGISTREMENT.HTTP, i18next.t(
        'downloadRemoteFile.errors.http',
        'Le serveur a refuse le fichier ({{code}}).',
        { code },
      ));
    }
    const local = String(reponse?.path?.() || chemin);
    fichier = local.startsWith('file://') ? local : `file://${local}`;
  }

  try {
    await galerie().saveAsset(fichier, {
      album: Platform.OS === 'android' ? ALBUM_ANDROID : '',
      type: 'photo',
    });
  } catch (erreur) {
    if (estUnRefusDAcces(erreur)) {
      throw echec(ECHECS_D_ENREGISTREMENT.PERMISSION, 'Acces a la phototheque refuse.');
    }
    throw erreur;
  }
  return { issue: 'enregistree' };
};

export default { ECHECS_D_ENREGISTREMENT, enregistrerLImage };
