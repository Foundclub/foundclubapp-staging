/**
 * Y01 — LE SEUL ENDROIT QUI DIT QUELLE TAILLE UNE PHOTO A LE DROIT D'AVOIR.
 *
 * Constat d'Adel du 2026-08-19 : « une photo prise avec la caméra est refusée,
 * fichier trop lourd », alors que la même photo choisie dans la galerie passe.
 *
 * 📏 Ce qui a été MESURÉ le 2026-08-19 (sharp 0.34, image photo-réaliste) :
 *   - photo brute d'un téléphone récent, 4032x3024 : 2,81 Mo en JPEG q0.8 ;
 *   - la MÊME image en PNG sans perte : 30,85 Mo, soit **x11** ;
 *   - la re-capture `react-native-view-shot` d'une vue de 1000x1000 :
 *     2,53 Mo en PNG sur Android, et **22,80 Mo sur un iPhone x3**.
 *
 * ⚠️ L'amplification x3 est PROPRE A iOS, et elle est vérifiée :
 * `RNViewShot.mm:113` appelle `UIGraphicsBeginImageContextWithOptions(size, NO, 0)`
 * — le `0` veut dire « à l'échelle de l'écran », donc 1000 points deviennent
 * 3000 pixels. Android ne fait PAS cela : `ViewShot.java:440` appelle
 * `Bitmap.createScaledBitmap(bitmap, width, height, true)`, où la taille
 * demandée EST la taille finale.
 *
 * ⇒ Un avatar de 237 Ko ressortait à ~22 Mo parce que le dé-miroir C01 le
 * ré-encodait en PNG sans perte. AUCUN autre chemin ne redimensionnait avant
 * d'envoyer : seul `SelectAvatar` posait `maxWidth`/`maxHeight`.
 *
 * ⚠️ On compresse, on ne détruit pas : 2048 px de côté reste au-dessus de la
 * définition de tous les écrans de l'app, et q0.8 est la qualité déjà retenue
 * par la caméra elle-même. Un écusson de club reste lisible.
 */

/** Côté maximal, en pixels, d'une image envoyée au serveur. */
export const PHOTO_MAX_DIMENSION = 2048;

/** Compression JPEG appliquée à toute photo sortante (0-1). */
export const PHOTO_QUALITY = 0.8;

/**
 * Options à passer à `react-native-image-picker` pour que la bibliothèque
 * redimensionne NATIVEMENT, avant même que le fichier existe.
 */
export const PHOTO_PICKER_LIMITS = Object.freeze({
  maxHeight: PHOTO_MAX_DIMENSION,
  maxWidth: PHOTO_MAX_DIMENSION,
  quality: PHOTO_QUALITY,
});

/** Format rendu par une re-capture `captureRef` (dé-miroir du selfie C01). */
export const CAPTURE_FORMAT = 'jpg';

/** Type MIME correspondant à {@link CAPTURE_FORMAT}. */
export const CAPTURE_MIME = 'image/jpeg';

/** Extension de fichier correspondant à {@link CAPTURE_FORMAT}. */
export const CAPTURE_EXTENSION = 'jpg';

export const BYTES_PER_MB = 1024 * 1024;

/**
 * Plafond de refus, côté app. Il n'existe AUCUN plafond côté serveur qu'une
 * photo puisse atteindre (mesuré le 2026-08-19 : greffon d'upload Strapi 1 Go
 * par défaut, corps de requête 200 Mo via formidable, Caddy sans directive).
 * Ce plafond-ci est donc le seul qui parle à l'utilisateur — il doit dire sa
 * valeur.
 */
export const MAX_UPLOAD_IMAGE_BYTES = 15 * BYTES_PER_MB;

/**
 * Le refus, rédigé pour être lu : il NOMME la taille maximale autorisée.
 * @param {number} maxBytes Plafond appliqué, en octets.
 * @returns {string} Message affichable tel quel.
 */
export const buildFileTooLargeMessage = (maxBytes) => (
  `Fichier trop volumineux (max ${Math.round(maxBytes / BYTES_PER_MB)} Mo).`
);

/**
 * Contrôle de sortie : une image trop grosse est refusée AVANT l'envoi, avec
 * un message qui dit le plafond. Une taille inconnue (0 / undefined) ne
 * déclenche rien — on ne refuse pas ce qu'on n'a pas mesuré.
 * @param {number | undefined | null} sizeInBytes Taille du fichier, en octets.
 * @param {number} [maxBytes] Plafond à appliquer.
 * @returns {string} Le message de refus, ou '' si l'image passe.
 */
export const checkImageSize = (sizeInBytes, maxBytes = MAX_UPLOAD_IMAGE_BYTES) => {
  const size = Number(sizeInBytes || 0) || 0;
  return size > maxBytes ? buildFileTooLargeMessage(maxBytes) : '';
};

export default {
  buildFileTooLargeMessage,
  BYTES_PER_MB,
  CAPTURE_EXTENSION,
  CAPTURE_FORMAT,
  CAPTURE_MIME,
  checkImageSize,
  MAX_UPLOAD_IMAGE_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_PICKER_LIMITS,
  PHOTO_QUALITY,
};
