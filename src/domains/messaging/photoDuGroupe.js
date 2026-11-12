import { PermissionsAndroid, Platform } from 'react-native';

// PHOTO-SITE (12/11, D90) : le selecteur de photos, charge A L'APPEL par le chargeur partage.
// L'app et jest prennent complexeChargeurs.js (un `require` a l'appel : `@/platform/media` tire
// les modules natifs du selecteur de documents, que les temoins des ecrans ne doublent pas) ; le
// site prend complexeChargeurs.web.js, qui l'importe en tete. Avant, un `require` ecrit ici : au
// site construit il rendait `undefined` (comme M1205), et « Choisir dans la galerie » ne faisait
// rien. Temoins : site.sansRequire.test.js, photoDuGroupe.PHOTO-SITE.test.js et
// web/tests/components/photo-site-groupe.spec.ts.
// ponytail: le chargeur porte le nom du chantier complexe (comme EventChatRow, CHAT-EVT-T9) ;
// le temoin RESA-L7-1 garde les memes exports app / site. Sortie : un chargeur partage a part.
import { media as selecteur } from '@/services/complexe/complexeChargeurs';

import { createLogger } from '@/utils/logger/logger';

import { checkImageSize } from '@/platform/media/photoLimits';

const journal = createLogger('photo-du-groupe');

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
 * Le chemin sans filet : ouvre la camera ou la galerie (voir `choisirLaPhotoDuGroupe`).
 * @param {'camera' | 'galerie'} source
 * @param {(cle: string, repli: string) => string} t
 * @returns {Promise<PhotoChoisie | { erreur: string } | null>} `null` si on a annule.
 */
const ouvrirLeSelecteur = async (source, t) => {
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
      erreur: t(
        'profile.errors.photoNotRetrieved',
        'La photo n\'a pas pu être récupérée. Réessaie.',
      ),
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

/**
 * Ouvre la camera ou la galerie et rend la photo choisie, deja reduite.
 * PHOTO-SITE (12/11, D90) — aucun des trois ecrans qui l'appellent n'entoure l'appel d'un `try` :
 * un selecteur introuvable ou qui leve se dit ici (un message a l'ecran, un avertissement au
 * journal) au lieu de ne rien faire.
 * @param {'camera' | 'galerie'} source
 * @param {(cle: string, repli: string) => string} t
 * @returns {Promise<PhotoChoisie | { erreur: string } | null>} `null` si on a annule.
 */
export const choisirLaPhotoDuGroupe = async (source, t) => {
  try {
    return await ouvrirLeSelecteur(source, t);
  } catch (erreur) {
    journal.warn('selecteur de photo en panne', {
      erreur: String(/** @type {any} */ (erreur)?.message || erreur),
      source,
    });
    return {
      erreur: t(
        'profile.errors.photoNotRetrieved',
        'La photo n\'a pas pu être récupérée. Réessaie.',
      ),
    };
  }
};

export default choisirLaPhotoDuGroupe;
