import i18n from '@/theme/strings';

import { BYTES_PER_MB } from '@/platform/media/photoLimits';
import { isVideoMime, VIDEO_MAX_BYTES, videoSizeRefusal } from '@/platform/media/videoLimits';

/**
 * MSGVIDZIP (29/10) — LA VIDÉO EST COMPRESSÉE PAR LE TÉLÉPHONE AVANT L'ENVOI.
 *
 * Décision d'Adel (« 2- C ») : la galerie rend l'original (une minute en 1080p pèse 60 à
 * 130 Mo) ; `react-native-compressor` le ramène à la manière de WhatsApp. La limite
 * VIDEO_MAX_BYTES (videoLimits.js) s'applique APRÈS compression. Si la compression échoue,
 * l'original part s'il tient sous la limite ; sinon, refus clair.
 *
 * Le module natif est chargé à l'appel seulement : une photo ou un document ne le touchent
 * jamais, et son absence (téléphone sans le module, témoins) se lit comme un échec de
 * compression, pas comme une panne de l'écran.
 * Témoin : platform/media/__tests__/MSGVIDZIP.preparerVideo.test.js.
 *
 * VIDEO-RAME (03/11) — iPhone : après une lourde vidéo, l'app rame puis iOS la ferme. La
 * compression occupe le téléphone sans rien dire : on ne la lance pas pour rien, jamais deux à
 * la fois, on sait l'arrêter, et ses fichiers ne restent pas (Conversation.js efface après
 * l'envoi). Le plantage lui-même n'est pas établi : ceci réduit le risque, sans le supprimer.
 * Témoin : platform/media/__tests__/VIDEO-RAME.preparerVideo.test.js.
 */

/** La galerie ouverte, ou encore en train de copier le fichier choisi. */
let galerieEnCours = false;

/**
 * Le refus d'une seconde vidéo pendant que la première se prépare.
 * @returns {string}
 */
const texteDejaEnPreparation = () => i18n.t('conversation.video.alreadyPreparing', {
  defaultValue: 'Une vidéo est déjà en préparation. Réessaie quand elle sera partie.',
});

/**
 * VIDEO-RAME — Ouvre la galerie, jamais par-dessus elle-même. Le sélecteur iOS se referme PUIS
 * copie le fichier choisi : plusieurs Go sans rien à l'écran. Ne gardant qu'UN rappel, il
 * l'appellerait deux fois si on le rouvrait là, ce qui arrête l'app (RCTTurboModule.mm,
 * LOG(FATAL)).
 * La garde vit hors de l'écran : quitter puis revenir ne la remet pas à zéro.
 * ponytail: les autres appelants de launchImageLibrary (photos, formulaires) ne passent pas ici ;
 * leur copie est brève. Une vidéo en copie suivie d'une photo ailleurs reste possible.
 * @template T
 * @param {() => Promise<T>} ouvrir
 * @returns {Promise<{ reponse: T } | { refus: string }>}
 */
export const ouvrirGalerieUneSeuleFois = async (ouvrir) => {
  if (galerieEnCours) return { refus: texteDejaEnPreparation() };
  galerieEnCours = true;
  try {
    return { reponse: await ouvrir() };
  } finally {
    galerieEnCours = false;
  }
};

/** Côté le plus long d'une vidéo compressée, en pixels (720p : lisible plein écran). */
export const VIDEO_COMPRESSION_MAX_SIDE = 1280;

/**
 * Le débit visé au plus bas pour ce côté : 1,2 Mb/s d'image et 128 kb/s de son, en octets par
 * seconde (`estimateBitrate`, react-native-compressor 1.19.4, iOS).
 */
const PLANCHER_OCTETS_PAR_SECONDE = (1200000 + 128000) / 8;

// ponytail: ce débit est une moyenne visée, une image très fixe peut passer dessous. La marge de
// 2 évite de refuser à tort ; entre 16 et 32 min, le téléphone peut encore travailler pour rien.
const MARGE_DU_REFUS_D_AVANCE = 2;

/**
 * Le module natif, chargé à l'appel seulement.
 * @returns {any}
 */
// eslint-disable-next-line global-require
const moduleDeCompression = () => require('react-native-compressor');

/**
 * La compression en cours : une seule à la fois sur le téléphone.
 * @type {{ annulee: boolean, id: string } | null}
 */
let preparationEnCours = null;

/**
 * @typedef {{
 *   duration?: number, fileName?: string, size?: number, type?: string, uri?: any,
 * }} Media
 * @typedef {(
 *   { asset: Media, compressee: boolean } | { annulee: true } | { refus: string }
 * )} VideoPreparee
 */

/**
 * Le nom du fichier compressé.
 * @param {string} fileName
 * @returns {string} Le même nom, en .mp4 (ce que rend la compression).
 */
const enMp4 = (fileName) => `${String(fileName || 'video').replace(/\.[^./]+$/, '')}.mp4`;

/**
 * Trop longue pour tenir, même réduite ? Une taille, une durée ou une image inconnue : on tente.
 * @param {Media & { height?: number, width?: number }} asset
 * @returns {boolean}
 */
const neTiendraPas = (asset) => {
  const coteLong = Math.max(Number(asset.width) || 0, Number(asset.height) || 0);
  if (coteLong < VIDEO_COMPRESSION_MAX_SIDE) return false;
  if ((Number(asset.size) || 0) <= VIDEO_MAX_BYTES) return false;
  const plancher = (Number(asset.duration) || 0) * PLANCHER_OCTETS_PAR_SECONDE;
  return plancher > VIDEO_MAX_BYTES * MARGE_DU_REFUS_D_AVANCE;
};

/**
 * Efface un fichier temporaire de vidéo. Seuls les dossiers temporaires sont touchés : un document
 * choisi ailleurs reste à sa place. Un échec ne gêne personne.
 * @param {unknown} uri
 * @returns {Promise<void>}
 */
export const oublierFichierVideo = async (uri) => {
  const adresse = String(uri || '');
  if (!/^file:\/\/.*\/(tmp|cache)\//i.test(adresse)) return;
  try {
    // eslint-disable-next-line global-require
    const { default: BlobUtil } = require('react-native-blob-util');
    await BlobUtil.fs.unlink(decodeURI(adresse.replace(/^file:\/\//, '')));
  } catch {
    // Déjà parti, ou iOS le rangera : rien à dire à la personne.
  }
};

/**
 * Arrête la compression en cours (on a quitté la conversation). Rien ne partira.
 * @returns {void}
 */
export const annulerPreparationVideo = () => {
  if (!preparationEnCours) return;
  const { id } = preparationEnCours;
  preparationEnCours.annulee = true;
  // La place se libère tout de suite : une compression qui ne répondrait plus ne bloque personne.
  preparationEnCours = null;
  if (!id) return;
  try {
    moduleDeCompression().Video.cancelCompression(id);
  } catch {
    // Le module absent n'a rien à arrêter.
  }
};

/**
 * Prépare une pièce jointe avant l'envoi : une vidéo est compressée, le reste passe tel quel.
 * @param {Media} asset - La pièce jointe normalisée (Conversation.js, `normalizePickedAsset`).
 * @returns {Promise<VideoPreparee>}
 */
export const preparerVideo = async (asset) => {
  if (!isVideoMime(asset?.type) || !asset?.uri) return { asset, compressee: false };
  if (preparationEnCours) return { refus: texteDejaEnPreparation() };
  if (neTiendraPas(asset)) return { refus: videoSizeRefusal(asset.size) };

  const preparation = { annulee: false, id: '' };
  preparationEnCours = preparation;
  try {
    const { getFileSize, Video } = moduleDeCompression();
    const uri = await Video.compress(String(asset.uri), {
      compressionMethod: 'auto',
      getCancellationId: (/** @type {string} */ id) => { preparation.id = id; },
      maxSize: VIDEO_COMPRESSION_MAX_SIDE,
    });
    if (preparation.annulee) {
      await oublierFichierVideo(uri);
      return { annulee: true };
    }
    const size = Number(await getFileSize(uri)) || 0;
    const refus = videoSizeRefusal(size);
    if (refus) {
      await oublierFichierVideo(uri);
      return { refus };
    }
    return {
      asset: {
        ...asset, fileName: enMp4(asset.fileName || ''), size, type: 'video/mp4', uri,
      },
      compressee: true,
    };
  } catch {
    // Une compression annulée échoue aussi : l'original ne part pas à la place.
    if (preparation.annulee) return { annulee: true };
    const taille = Number(asset.size) || 0;
    if (taille <= VIDEO_MAX_BYTES) return { asset, compressee: false };
    return {
      refus: i18n.t('conversation.video.tooLargeUncompressed', {
        defaultValue: 'Vidéo trop lourde : {{max}} Mo maximum. Le téléphone n a pas pu la réduire.',
        max: Math.round(VIDEO_MAX_BYTES / BYTES_PER_MB),
      }),
    };
  } finally {
    if (preparationEnCours === preparation) preparationEnCours = null;
  }
};

export default preparerVideo;
