// ==========================================================================
// RÈGLE DE DENSITÉ (DESIGN-DENSITE, validée par Adel le 20/11/2026, densite_go d1 = A).
// « Un seul cadre, 16 px partout, rien de cliquable sous 44 px. » Les maquettes validées
// (T-DESIGN-TOURNOI, 18/11) sont dessinées avec ces chiffres ; la recette 51 b empilait deux ou
// trois cadres de 22 à 24 px chacun. Les 9 points, pour un humain :
//   1. Un seul cadre dans la page (pas de carte dans une carte ; les fenêtres et feuilles
//      gardent leurs cartes). Dedans, on sépare par un trait fin.
//   2. Marge de page : 16 téléphone, 24 tablette (≥ 768), 40 ordinateur (≥ 1 024), posée UNE
//      fois par le conteneur de page (`ScreenContainer densePadding`).
//   3. Ordinateur : contenu ≤ 1 200 px ; au-delà de 1 024, colonne principale + 380, écart 28.
//   4. Cartes : padding 16, coins 16 (20 pour la carte mise en avant), fond primary900, bord
//      primary500 à 24 %.
//   5. Listes : une carte, lignes de 56 px minimum séparées par un trait.
//   6. Écarts : 12 entre deux cartes, 24 avant un titre de section, 12 sous ce titre.
//   7. Boutons : 47 l'action principale, 44 les autres ; rien de cliquable sous 44.
//   8. Photo d'en-tête : bord à bord sur téléphone (236 px) ; colonne sur ordinateur (280, coins 20).
//   9. Un seul fond de page, sans voile gris par-dessus les blocs.
// Témoins : src/theme/__tests__/DESIGN-DENSITE.regle.test.js. Les points de rupture sont
// ceux du site (src/responsive/breakpoints.js), recopiés ici pour que le thème ne dépende de rien.
// ==========================================================================

export const DENSITE = Object.freeze({
  boutonMin: 44,
  boutonPrincipal: 47,
  carteMiseEnAvantRayon: 20,
  cartePadding: 16,
  carteRayon: 16,
  colonneLaterale: 380,
  contenuMax: 1200,
  ecartBlocs: 12,
  ecartColonnes: 28,
  ecartSection: 24,
  ecartSousTitre: 12,
  ligneMin: 56,
  margeOrdinateur: 40,
  margeTablette: 24,
  margeTelephone: 16,
  photoHauteurOrdinateur: 280,
  photoHauteurTelephone: 236,
  photoRayonOrdinateur: 20,
});

const TABLETTE = 768;
const ORDINATEUR = 1024;

/**
 * La marge latérale de page pour une largeur d'écran (point 2 de la règle).
 * @param {number} largeur
 * @returns {number}
 */
export const margeDePage = (largeur) => {
  if (largeur >= ORDINATEUR) return DENSITE.margeOrdinateur;
  if (largeur >= TABLETTE) return DENSITE.margeTablette;
  return DENSITE.margeTelephone;
};
