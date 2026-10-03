// @ts-nocheck
/**
 * app/src/platform/media/saveTextFile.web.js
 *
 * COLL-C5 (03/10/2026) — jumeau WEB de `saveTextFile.native.js` : le navigateur sait télécharger
 * un texte fabriqué en mémoire (Blob -> URL objet -> <a download>), le même geste que le
 * téléchargement d'une affiche (`visualRender.web.js`). Même forme de retour que le jumeau natif.
 * Il existe aussi pour la RÉSOLUTION : le site compile `app/src` sans l'extension `.native.js`.
 */

import { FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

/**
 * Télécharge le texte sous ce nom.
 * @param {object} params
 * @param {string} params.contenu - Le texte (UTF-8).
 * @param {string} params.fileName - Le nom du fichier.
 * @param {string} [params.mimeType] - Le type.
 * @returns {Promise<{ opened: boolean, outcome: string }>} L'issue, nommée.
 */
export const saveTextFile = async ({ contenu, fileName, mimeType = 'text/plain' }) => {
  const fichier = new Blob([String(contenu ?? '')], { type: `${mimeType};charset=utf-8` });
  const adresse = URL.createObjectURL(fichier);
  try {
    const lien = document.createElement('a');
    lien.download = fileName;
    lien.href = adresse;
    lien.rel = 'noopener';
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
  } finally {
    // Laisse le navigateur amorcer le téléchargement avant de révoquer l'adresse.
    setTimeout(() => URL.revokeObjectURL(adresse), 10000);
  }
  return { opened: true, outcome: FILE_SHARE_OUTCOMES.DOWNLOADS };
};

export default { saveTextFile };
