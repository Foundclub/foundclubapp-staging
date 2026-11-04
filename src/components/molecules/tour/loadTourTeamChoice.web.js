import TourTeamChoice from '@/components/molecules/tour/TourTeamChoice';

/**
 * T3-GUIDE-SITE : le serveur du site sert les fichiers tels quels, `require` n'y existe pas. Sa
 * couche est déjà chargée à part, seulement quand le guide y est allumé.
 * @returns {import('react').ComponentType} L'écran de la question.
 */
const loadTourTeamChoice = () => TourTeamChoice;

export default loadTourTeamChoice;
