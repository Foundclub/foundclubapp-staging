/**
 * MSG-MEDIA (29/10) — la durée d'une vidéo choisie sur le site, lue par le navigateur lui-même :
 * une balise <video> hors écran charge les seules métadonnées du fichier local.
 * @param {Blob | null | undefined} fichier - Le fichier choisi.
 * @returns {Promise<number>} La durée en secondes ; 0 si le navigateur ne sait pas la lire
 * (on ne refuse pas ce qu'on n'a pas mesuré).
 */
const lireDureeVideo = (fichier) => new Promise((resolve) => {
  if (!fichier || typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    resolve(0);
    return;
  }
  const adresse = URL.createObjectURL(fichier);
  const video = document.createElement('video');
  const finir = (/** @type {number} */ duree) => {
    URL.revokeObjectURL(adresse);
    resolve(Number.isFinite(duree) && duree > 0 ? duree : 0);
  };
  video.preload = 'metadata';
  video.onloadedmetadata = () => finir(video.duration);
  video.onerror = () => finir(0);
  video.src = adresse;
});

export default lireDureeVideo;
