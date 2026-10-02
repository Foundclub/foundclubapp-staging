import { useEffect } from 'react';

import { RouteNames } from '@/navigation/routeNames';

/**
 * ST-VUES — L ECRAN « STATISTIQUES » (TeamStats) EST ABANDONNE PAR LE DESIGN VALIDE
 * (« FoundClub — Statistiques », planche 15, 02/10).
 *
 * Il etait un doublon pauvre de « Vie d'équipe » (presences, absences, retards en
 * colonnes), sans porte depuis le 21/02/2026. Son ADRESSE reste — un lien profond, un
 * favori, `/teams/:teamId/stats` sur le site — et ouvre desormais la fiche de
 * l equipe, onglet Stats, sur « Vie d'équipe » : jamais un ecran mort.
 *
 * ⛔ La route `TeamStats` n est PAS retiree : ses fichiers (`routeNames.js`,
 * `webRoutes.js`, `TeamStack.js`) sont des fichiers-carrefour partages par les
 * autres lots, et la retirer casserait les adresses deja distribuees. Ce composant
 * est son seul occupant : il ne dessine rien, il redirige.
 * @param {object} props - Les proprietes de l ecran.
 * @param {any} props.navigation - La navigation de la pile Equipe.
 * @param {any} props.route - Les parametres : `teamId`.
 * @returns {null} - Rien : l ecran est remplace avant d etre vu.
 */
function TeamStatsScreen({ navigation, route }) {
  const teamId = route?.params?.teamId;

  useEffect(() => {
    if (teamId) {
      navigation.replace(RouteNames.TeamDetails, { initialTab: 'stats', teamId });
      return;
    }
    navigation.replace(RouteNames.MyTeamList);
  }, [navigation, teamId]);

  return null;
}

export default TeamStatsScreen;
