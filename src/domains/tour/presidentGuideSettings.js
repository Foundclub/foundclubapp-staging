/**
 * Guide Dirigeant·e : les réglages en attente d'une décision d'Adel, en un seul endroit.
 * (`prompts/PROMPT_GUIDE_D_COMMUN.md`, numéros du §9 de la carte.) Inverser une décision, c'est
 * changer une ligne ici, et rien d'autre.
 */
export const PRESIDENT_GUIDE_SETTINGS = Object.freeze({
  // Faux : le dirigeant garde le tour v2. Vrai quand l'essentiel (M1 à M4) est fini.
  enabled: false,
  // Décision 1, mur d'argent, A : sans offre Club, ②③④ et M2 sont montrés, pas joués. Faux pour B.
  visitWithoutClubPlan: true,
  // Décision 3, A : seuls les dirigeants inscrits depuis la sortie du guide se le voient proposer.
  // Date de la sortie, à poser le jour du départ ; sans date, aucune proposition à l'accueil.
  offerSince: null,
  // Décision 4 : la partie ② (partenaire) se passe. Décision 5 : M2 aussi.
  partnerPassable: true,
  coachPassable: true,
  // Décision 8, A : B1 et B4 s'arrêtent au récap, puis une bulle.
  stopBonusAtRecap: true,
});

export default PRESIDENT_GUIDE_SETTINGS;
