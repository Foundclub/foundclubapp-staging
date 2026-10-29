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
 */

/** Côté le plus long d'une vidéo compressée, en pixels (720p : lisible plein écran). */
export const VIDEO_COMPRESSION_MAX_SIDE = 1280;

/**
 * @typedef {{
 *   duration?: number, fileName?: string, size?: number, type?: string, uri?: any,
 * }} Media
 * @typedef {{ asset: Media, compressee: boolean } | { refus: string }} VideoPreparee
 */

/**
 * Le nom du fichier compressé.
 * @param {string} fileName
 * @returns {string} Le même nom, en .mp4 (ce que rend la compression).
 */
const enMp4 = (fileName) => `${String(fileName || 'video').replace(/\.[^./]+$/, '')}.mp4`;

/**
 * Prépare une pièce jointe avant l'envoi : une vidéo est compressée, le reste passe tel quel.
 * @param {Media} asset - La pièce jointe normalisée (Conversation.js, `normalizePickedAsset`).
 * @returns {Promise<VideoPreparee>}
 */
export const preparerVideo = async (asset) => {
  if (!isVideoMime(asset?.type) || !asset?.uri) return { asset, compressee: false };

  try {
    // eslint-disable-next-line global-require
    const { getFileSize, Video } = require('react-native-compressor');
    const uri = await Video.compress(String(asset.uri), {
      compressionMethod: 'auto',
      maxSize: VIDEO_COMPRESSION_MAX_SIDE,
    });
    const size = Number(await getFileSize(uri)) || 0;
    const refus = videoSizeRefusal(size);
    if (refus) return { refus };
    return {
      asset: {
        ...asset, fileName: enMp4(asset.fileName || ''), size, type: 'video/mp4', uri,
      },
      compressee: true,
    };
  } catch {
    const taille = Number(asset.size) || 0;
    if (taille <= VIDEO_MAX_BYTES) return { asset, compressee: false };
    return {
      refus: i18n.t('conversation.video.tooLargeUncompressed', {
        defaultValue: 'Vidéo trop lourde : {{max}} Mo maximum. Le téléphone n a pas pu la réduire.',
        max: Math.round(VIDEO_MAX_BYTES / BYTES_PER_MB),
      }),
    };
  }
};

export default preparerVideo;
