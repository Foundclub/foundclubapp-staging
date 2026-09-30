import { SorteAlerte } from '@/domains/searchAlert/alerteEvenement';
import useAlerteRecherche from '@/domains/searchAlert/useAlerteRecherche';

/**
 * ALERTES (audit V1, A20) — l'alerte d'événements de Rechercher › Événement.
 * ALERTES-ANNONCES (30/09) : le chemin de création est devenu commun aux
 * événements et aux annonces (`useAlerteRecherche`) ; ce hook en est la porte
 * « événements », gardée pour ses appelants et les trois témoins qui la doublent.
 * @returns {ReturnType<typeof useAlerteRecherche>} Ce que la recherche en utilise.
 */
function useAlerteEvenement() {
  return useAlerteRecherche(SorteAlerte.evenement);
}

export default useAlerteEvenement;
