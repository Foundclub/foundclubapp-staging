/**
 * Guide Dirigeant·e : les réglages en attente d'une décision d'Adel, en un seul endroit.
 * (`prompts/PROMPT_GUIDE_D_COMMUN.md`, numéros du §9 de la carte.) Inverser une décision, c'est
 * changer une ligne ici, et rien d'autre.
 */
export const PRESIDENT_GUIDE_SETTINGS = Object.freeze({
  // Faux : le dirigeant garde le tour v2. Vrai quand l'essentiel (M1 à M4) est fini.
  enabled: false,
  // Décision 1, mur d'argent, A : sans offre Club, M2 est montré, pas joué. Faux pour B. ②③④ se
  // jouent pour tous : la première installation et le premier partenaire sont offerts (« 77- C »).
  visitWithoutClubPlan: true,
  // Décision 3, A : seuls les dirigeants inscrits depuis la sortie du guide se le voient proposer.
  // Date de la sortie, à poser le jour du départ ; sans date, aucune proposition à l'accueil.
  offerSince: null,
  // Décision 4 : la partie ② (partenaire) se passe. Décision 5 : M2 aussi.
  coachPassable: true,
  partnerPassable: true,
  // Décision 8, A : B1 et B4 s'arrêtent au récap, puis une bulle.
  stopBonusAtRecap: true,
});

export default PRESIDENT_GUIDE_SETTINGS;
