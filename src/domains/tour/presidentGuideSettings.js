import { Platform } from 'react-native';

import { GUIDE_SUR_LE_SITE } from '@/config/fonctionsMasquees';

// Le guide Dirigeant·e du TÉLÉPHONE : son interrupteur à lui (la TestFlight l'allume à part).
const GUIDE_DIRIGEANT_SUR_LE_TELEPHONE = false;

/**
 * Guide Dirigeant·e : les réglages en attente d'une décision d'Adel, en un seul endroit.
 * (`prompts/PROMPT_GUIDE_D_COMMUN.md`, numéros du §9 de la carte.) Inverser une décision, c'est
 * changer une ligne ici, et rien d'autre.
 */
export const PRESIDENT_GUIDE_SETTINGS = Object.freeze({
  // Faux : le dirigeant garde le tour v2. Vrai quand l'essentiel (M1 à M4) est fini.
  // GUIDES-SITE (Adel, 09/11) : sur le site, il suit l'interrupteur du site.
  enabled: Platform.OS === 'web' ? GUIDE_SUR_LE_SITE : GUIDE_DIRIGEANT_SUR_LE_TELEPHONE,
  // Décision 1, mur d'argent, A : sans offre Club, M2 est montré, pas joué. Faux pour B. ②③④ se
  // jouent pour tous : la première installation et le premier partenaire sont offerts (« 77- C »).
  visitWithoutClubPlan: true,
  // Décision 3, A : seuls les dirigeants inscrits depuis la sortie du guide se le voient proposer.
  // Date de la sortie, à poser le jour du départ ; sans date, aucune proposition à l'accueil.
  offerSince: null,
  // Décision 4 : la partie ② (partenaire) se passe. Décision 5 : M2 aussi.
  coachPassable: true,
  partnerPassable: true,
});

export default PRESIDENT_GUIDE_SETTINGS;
