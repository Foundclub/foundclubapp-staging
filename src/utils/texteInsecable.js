// FINITIONS (recette émulateur du 2026-09-28, Android 16) — LE TEXTE D'UNE PASTILLE.
//
// 🔎 Ce que les captures montrent : un texte GRAS de plusieurs mots, dans une boîte qui
// épouse sa largeur mesurée, perd son dernier mot (« Version » pour « Version 2 ») ; un
// mot seul, dans la même boîte, reste entier (« Titulaire », « Remplaçant »).
// Une pastille épouse FORCÉMENT son texte — on ne peut pas l'élargir comme un bouton.
// ⇒ On lui retire ses points de coupure : ses espaces deviennent insécables, et le
// texte se comporte comme un mot seul.
//
// ponytail: parade d'affichage, pas la cause. Cause SUPPOSÉE : mesure du texte par
// React Native plus étroite que son dessin par Android 16 (cible API 36). Voie de
// sortie : corriger la mesure côté natif, puis retirer cette fonction.

const ESPACE_INSECABLE = String.fromCharCode(160);

/**
 * Le texte d'une pastille, sans aucun point de coupure.
 * @param {unknown} texte - Le libellé, tel que `t()` le rend.
 * @returns {string} - Le même libellé, espaces insécables ; chaîne vide si rien.
 */
const texteInsecable = (texte) => (
  texte === null || texte === undefined ? '' : String(texte).replace(/ /g, ESPACE_INSECABLE)
);

export default texteInsecable;
