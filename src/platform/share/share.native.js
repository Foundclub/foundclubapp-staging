import { Share } from 'react-native';

export const share = async (payload) => Share.share(payload);

/**
 * RESA-L6B-2 (20/10/2026) — copie un texte dans le presse-papiers du téléphone. Le module natif est
 * chargé au geste : en tête de fichier, il casserait chaque témoin jest qui monte l'écran.
 * @param {string} texte - Le texte.
 * @returns {Promise<boolean>} Vrai si la copie a eu lieu.
 */
export const copier = async (texte) => {
  try {
    // eslint-disable-next-line global-require
    const module = require('@react-native-clipboard/clipboard');
    (module?.default || module).setString(String(texte ?? ''));
    return true;
  } catch (_erreur) {
    return false;
  }
};

export default {
  copier,
  share,
};
