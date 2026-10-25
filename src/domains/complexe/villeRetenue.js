import { getItem, removeItem, setItem } from '@/platform/storage';

/**
 * LA VILLE RETENUE — RESA-FIN-APP (20/10/2026), E-P01 : la ville choisie pour chercher un terrain est
 * gardée sur le téléphone d'une visite à l'autre (tournées 1 et 2 : « Réserver ailleurs » rouvrait la
 * feuille de position 30 min après). Un choix d'affichage local, jamais envoyé au serveur ; la position,
 * si on l'autorise ensuite, l'efface. Témoin : `EP01.recherche.test.js` (RESA-FIN-APP).
 */
const CLE = 'reserverTerrain.ville';

/**
 * La ville retenue sur ce téléphone, si elle est lisible.
 * @returns {{ label: string, lat: number, lng: number } | null} La ville, ou null.
 */
export const lireVilleRetenue = () => {
  try {
    const lue = JSON.parse(String(getItem(CLE) || 'null'));
    if (!lue?.label || !Number.isFinite(lue?.lat) || !Number.isFinite(lue?.lng)) return null;
    return { label: String(lue.label), lat: Number(lue.lat), lng: Number(lue.lng) };
  } catch {
    return null;
  }
};

/**
 * Retient la ville (ou l'oublie), sans jamais faire tomber l'écran si le stockage manque.
 * @param {{ label: string, lat: number, lng: number } | null} ville - La ville, ou null.
 * @returns {void}
 */
export const retenirVille = (ville) => {
  try {
    if (ville) setItem(CLE, JSON.stringify({ label: ville.label, lat: ville.lat, lng: ville.lng }));
    else removeItem(CLE);
  } catch {
    // Pas de stockage : la ville vaut pour cette visite seulement.
  }
};
