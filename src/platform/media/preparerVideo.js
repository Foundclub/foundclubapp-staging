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

/** Au-delà, on ne croit plus la copie : 6,48 Go venus d'iCloud prennent de longues minutes. */
const DELAI_DE_LA_GALERIE_MS = 15 * 60 * 1000;

/** Ce que rend le délai, pour ne pas le confondre avec une réponse de la galerie. */
const GALERIE_SANS_REPONSE = Symbol('galerie sans réponse');

/**
 * Le refus d'une seconde vidéo pendant que la première se prépare.
 * @returns {string}
 */
const texteDejaEnPreparation = () => i18n.t('conversation.video.alreadyPreparing', {
  defaultValue: 'Une vidéo est déjà en préparation. Réessaie quand elle sera partie.',
});

/** Côté le plus long d'une vidéo compressée, en pixels (720p : lisible plein écran). */
export const VIDEO_COMPRESSION_MAX_SIDE = 1280;

/** Le son d'une vidéo compressée, en bits par seconde (`VideoMain.swift`). */
const DEBIT_DU_SON = 128000;

/** Le débit le plus haut du réglage normal à 1280 px, son compris (`estimateBitrate`). */
const DEBIT_NORMAL_MAXIMUM = 2000000 + DEBIT_DU_SON;

/** En dessous, l'image d'un 720p devient illisible : c'est ce qui borne à 30 min environ. */
const DEBIT_D_IMAGE_MINIMUM = 500000;

/** Ce débit est une moyenne visée : on vise 90 % de la limite pour ne pas la dépasser à la fin. */
const PART_DE_LA_LIMITE_VISEE = 0.9;

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
 * VIDEO-RAME (« 6- b ») — Le débit d'image qui fait tenir une longue vidéo sous la limite.
 * ⚠️ Ce réglage plus fort n'a jamais tourné sur un iPhone : à mesurer sur une vraie longue vidéo.
 * @param {Media} asset
 * @returns {number} 0 : le réglage normal suffit (ou durée inconnue, ou original sous la limite).
 */
const debitPourTenir = (asset) => {
  const duree = Number(asset.duration) || 0;
  const taille = Number(asset.size) || 0;
  if (duree <= 0 || (taille > 0 && taille <= VIDEO_MAX_BYTES)) return 0;
  const limiteVisee = VIDEO_MAX_BYTES * 8 * PART_DE_LA_LIMITE_VISEE;
  if (duree * DEBIT_NORMAL_MAXIMUM <= limiteVisee) return 0;
  return Math.floor(limiteVisee / duree) - DEBIT_DU_SON;
};

/**
 * Trop longue pour tenir, même au réglage le plus fort ? Taille ou durée inconnue : on tente.
 * @param {Media} asset
 * @returns {boolean}
 */
const neTiendraPas = (asset) => {
  if ((Number(asset.size) || 0) <= VIDEO_MAX_BYTES) return false;
  const debit = debitPourTenir(asset);
  return debit > 0 && debit < DEBIT_D_IMAGE_MINIMUM;
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
 * VIDEO-RAME — Ouvre la galerie, jamais par-dessus elle-même. Le sélecteur iOS se referme PUIS
 * copie le fichier choisi : plusieurs Go sans rien à l'écran. Ne gardant qu'UN rappel, il
 * l'appellerait deux fois si on le rouvrait là, ce qui arrête l'app (RCTTurboModule.mm,
 * LOG(FATAL)). Lu dans le code, jamais joué sur un iPhone.
 * La garde vit hors de l'écran : quitter puis revenir ne la remet pas à zéro.
 *
 * M0031 : une copie qui ne répond jamais ne bloque pas les médias jusqu'à la fermeture de l'app.
 * ponytail: on ne sait pas ce que fait encore le sélecteur. Passé le délai, une copie très lente
 * qui reviendrait pendant une nouvelle sélection redonnerait le double rappel ; et le délai court
 * aussi pendant qu'on parcourt la galerie. Sortie : la garde native, le jour où on la patche.
 * ponytail: les autres appelants de launchImageLibrary (photos, formulaires) ne passent pas ici ;
 * leur copie est brève. Une vidéo en copie suivie d'une photo ailleurs reste possible.
 * @template T
 * @param {() => Promise<T>} ouvrir
 * @returns {Promise<{ reponse: T } | { refus: string }>}
 */
export const ouvrirGalerieUneSeuleFois = async (ouvrir) => {
  if (galerieEnCours) return { refus: texteDejaEnPreparation() };
  galerieEnCours = true;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let minuteur;
  try {
    const ouverture = ouvrir();
    const delai = new Promise((resolve) => {
      minuteur = setTimeout(() => resolve(GALERIE_SANS_REPONSE), DELAI_DE_LA_GALERIE_MS);
    });
    const reponse = /** @type {T} */ (await Promise.race([ouverture, delai]));
    if (reponse !== GALERIE_SANS_REPONSE) return { reponse };
    // Revenue trop tard, elle ne sert plus : personne ne l'attend à l'écran.
    Promise.resolve(ouverture)
      .then((/** @type {any} */ tardive) => {
        const fichier = tardive?.assets?.[0];
        return isVideoMime(fichier?.type) ? oublierFichierVideo(fichier?.uri) : undefined;
      })
      .catch(() => {});
    return {
      refus: i18n.t('conversation.video.pickTimeout', {
        defaultValue: 'Le téléphone n a pas pu récupérer ce fichier. Réessaie.',
      }),
    };
  } finally {
    clearTimeout(minuteur);
    galerieEnCours = false;
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
 * @param {{ onProgres?: (pourcent: number) => void }} [suivi]
 * @returns {Promise<VideoPreparee>}
 */
export const preparerVideo = async (asset, { onProgres } = {}) => {
  if (!isVideoMime(asset?.type) || !asset?.uri) return { asset, compressee: false };
  if (preparationEnCours) return { refus: texteDejaEnPreparation() };
  if (neTiendraPas(asset)) return { refus: videoSizeRefusal(asset.size) };

  const preparation = { annulee: false, id: '' };
  preparationEnCours = preparation;
  try {
    const { getFileSize, Video } = moduleDeCompression();
    const debitVise = debitPourTenir(asset);
    const debit = debitVise && Math.max(debitVise, DEBIT_D_IMAGE_MINIMUM);
    const uri = await Video.compress(String(asset.uri), {
      ...(debit ? { bitrate: debit, compressionMethod: 'manual' } : { compressionMethod: 'auto' }),
      getCancellationId: (/** @type {string} */ id) => { preparation.id = id; },
      maxSize: VIDEO_COMPRESSION_MAX_SIDE,
      // Sans ce pas, le module enverrait un événement par image dès qu'on l'écoute.
      progressDivider: 5,
    }, ...(onProgres ? [(/** @type {number} */ progres) => onProgres(
      Math.round(progres <= 1 ? progres * 100 : progres),
    )] : []));
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
