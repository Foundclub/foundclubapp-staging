import { getImageUrl } from '@/utils/imageUrl';

// IMPL-1B-PHOTO (19/11/2026, demande d'Adel du 18/11 « la photo comme sur la carte événement
// de la recherche ») — LA PHOTO DU LIEU, choisie ICI une seule fois pour le bandeau de la fiche
// du tournoi (EventHeader), sa carte (EventCardNew : Rechercher, accueil) et la carte de
// « Gérer le tournoi » (TournamentOrganizerBoard).
// Le serveur (IMPL-5B, `admin/src/api/event/utils/venue-media.js`) rattache sous `facility`,
// seulement si le terrain appartient à un complexe ACTIF : `photos` (celles du terrain) et
// `complexe.photos`. Ordre : la photo du terrain, sinon celle du complexe, sinon rien
// (l'appelant garde son illustration). Témoin : photoDuLieu.test.js.

/**
 * @typedef {{ url?: string | null, alternativeText?: string | null,
 *   formats?: Record<string, { url?: string | null }> | null }} MediaDuLieu
 */

const aUneAdresse = (/** @type {any} */ fichier) => Boolean(
  fichier && typeof fichier.url === 'string' && fichier.url,
);

/**
 * La photo du lieu d'un événement, à la taille demandée.
 * @param {any} event - L'événement (fiche ou carte de liste).
 * @param {'thumbnail' | 'small' | 'medium' | 'large'} taille - La taille réduite voulue ;
 *   l'original à défaut.
 * @returns {{ alt: string, uri: string } | null} L'adresse et le texte alternatif, ou null
 *   sans photo.
 */
export const photoDuLieu = (event, taille) => {
  const lieu = event?.facility;
  if (!lieu || typeof lieu !== 'object') return null;
  const photosDuTerrain = Array.isArray(lieu.photos) ? lieu.photos : [];
  const photosDuComplexe = Array.isArray(lieu.complexe?.photos) ? lieu.complexe.photos : [];
  /** @type {MediaDuLieu | undefined} */
  const photo = photosDuTerrain.find(aUneAdresse) || photosDuComplexe.find(aUneAdresse);
  if (!photo) return null;
  const reduite = photo.formats?.[taille]?.url;
  const uri = getImageUrl(typeof reduite === 'string' && reduite ? reduite : String(photo.url));
  if (!uri) return null;
  const alt = String(photo.alternativeText || lieu.complexe?.name || lieu.name || '').trim();
  return { alt, uri };
};

export default photoDuLieu;
