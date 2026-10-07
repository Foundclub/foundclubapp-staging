import { PermissionsAndroid, Platform } from 'react-native';

import { checkImageSize } from '@/platform/media/photoLimits';

/**
 * Le selecteur de photos, charge A L'APPEL : `@/platform/media` tire les modules natifs du
 * selecteur de documents, que les temoins des ecrans (« Nouvelle discussion », le fil) ne
 * doublent pas — les charger a l'import faisait tomber leurs suites entieres.
 * @returns {{ capturePhoto: (o?: any) => Promise<any>, pickImage: (o?: any) => Promise<any> }}
 */
// eslint-disable-next-line global-require -- chargement differe voulu (voir ci-dessus)
const selecteur = () => require('@/platform/media');

/**
 * MSG1BA (§3.15, §3.16) — LA PHOTO D'UN GROUPE EST REDUITE COMME L'AVATAR DU PROFIL : memes
 * reglages que `SelectAvatar` (1000 px de cote, qualite 0,8, sans base64), passes au meme
 * selecteur (`@/platform/media`) qui redimensionne nativement avant que le fichier existe.
 * Pas de chemin neuf. (La camera arriere par defaut : pas de selfie, donc pas de de-miroir.)
 */
const REGLAGES_DE_L_AVATAR = Object.freeze({
  includeBase64: false,
  maxHeight: 1000,
  maxWidth: 1000,
  mediaType: 'photo',
  quality: 0.8,
});

/**
 * @typedef {object} PhotoChoisie
 * @property {string} apercu - Ce que l'ecran affiche tout de suite (uri locale).
 * @property {any} fichier - Ce qui part dans le formulaire : `{ uri, name, type }` au
 *   telephone, le `File` du navigateur sur le site.
 */

/**
 * Ouvre la camera ou la galerie et rend la photo choisie, deja reduite.
 * @param {'camera' | 'galerie'} source
 * @param {(cle: string, repli: string) => string} t
 * @returns {Promise<PhotoChoisie | { erreur: string } | null>} `null` si on a annule.
 */
export const choisirLaPhotoDuGroupe = async (source, t) => {
  if (Platform.OS === 'web') {
    const { capturePhoto, pickImage } = selecteur();
    const fichier = source === 'camera' ? await capturePhoto() : await pickImage();
    if (!fichier) return null;
    const refus = checkImageSize(fichier.size);
    if (refus) return { erreur: refus };
    return { apercu: URL.createObjectURL(fichier), fichier };
  }

  if (source === 'camera' && Platform.OS === 'android') {
    const accord = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      buttonNegative: t('common.actions.cancel', 'Annuler'),
      buttonPositive: t('common.actions.ok', 'OK'),
      message: t(
        'permissions.camera.message',
        'L\'application a besoin d\'accéder à ta caméra pour prendre une photo.',
      ),
      title: t('permissions.camera.title', 'Permission Caméra'),
    });
    if (accord !== PermissionsAndroid.RESULTS.GRANTED) {
      return { erreur: t('permissions.camera.denied', 'Permission caméra refusée') };
    }
  }

  const { capturePhoto, pickImage } = selecteur();
  const reponse = source === 'camera'
    ? await capturePhoto({ ...REGLAGES_DE_L_AVATAR, saveToPhotos: false })
    : await pickImage(REGLAGES_DE_L_AVATAR);
  if (reponse?.didCancel) return null;
  if (reponse?.errorCode) {
    return {
      erreur: reponse.errorMessage
        || t('profile.errors.photoUnavailable', 'L\'appareil photo n\'est pas disponible.'),
    };
  }
  const image = reponse?.assets?.[0];
  if (!image?.uri) {
    return {
      erreur: t('profile.errors.photoNotRetrieved', 'La photo n\'a pas pu être récupérée. Réessaie.'),
    };
  }
  const refus = checkImageSize(image.fileSize);
  if (refus) return { erreur: refus };
  return {
    apercu: image.uri,
    fichier: {
      name: image.fileName || `groupe-${Date.now()}.jpg`,
      type: image.type || 'image/jpeg',
      uri: image.uri,
    },
  };
};

export default choisirLaPhotoDuGroupe;
