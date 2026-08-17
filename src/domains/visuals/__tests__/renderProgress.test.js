import * as renderProgress from '../renderProgress';

const { isLongWait, LONG_WAIT_MS } = renderProgress;

// T04 (2026-08-17) — CE FICHIER A ÉTÉ RETOURNÉ, ET C'EST VOULU.
//
// S07 y verrouillait un compte à rebours (« encore N s environ ») bâti sur une
// estimation SUPPOSÉE de 3,5 à 4,5 s. La mesure du 2026-08-17 (22 rendus par
// format, chaîne de rendu réelle rejouée sur un i7-11800H 16 cœurs, Chromium
// chaud) a donné : `post` médiane 3,7 à 5,2 s, pire 13,0 s · `a4` pire 22,9 s —
// et ces chiffres EXCLUENT les requêtes Strapi, le logo distant et le transport
// des 1,29 Mo vers le téléphone, sur un serveur 6 vCPU Haswell plus lent.
//
// ⇒ Les témoins de S07 sur `getRenderEstimateMs`, `PROGRESS_CAP` et
//   `remainingSeconds` ne pouvaient pas survivre : ils gardaient la cohérence
//   INTERNE d'un modèle dont la mesure a montré qu'il était faux dehors. Ce qu'ils
//   protégeaient vraiment — ⛔ jamais de « 0 s », ⛔ jamais de barre pleine — est
//   désormais garanti par construction : il n'y a plus ni compteur ni barre.
//
// Ce qui reste à verrouiller tient en une phrase : le seul nombre qui subsiste
// parle du PASSÉ (le temps déjà écoulé), jamais de l'avenir.

describe('renderProgress — 🔒 aucune durée n est promise', () => {
  // LE TÉMOIN D'ARRÊT DU LOT : si un jour quelqu'un rajoute une estimation, une
  // barre proportionnelle ou un compte à rebours, ce fichier doit le voir passer.
  it('🔒 le module n exporte AUCUNE estimation, AUCUN plafond de barre', () => {
    // `__esModule` est le drapeau posé par Babel, pas une exportation du fichier.
    const exportes = Object.keys(renderProgress).filter((nom) => nom !== '__esModule');
    expect(exportes.sort()).toEqual(['LONG_WAIT_MS', 'isLongWait'].sort());
  });

  // Le seuil n'est pas un chiffre de confort : il est posé JUSTE AU-DESSUS du
  // pire cas mesuré (12 989 ms pour `post`). En dessous, l'écran crierait au loup
  // pour une attente que la mesure a vue arriver normalement.
  it('le seuil d attente anormale dépasse le pire cas mesuré le 2026-08-17', () => {
    expect(LONG_WAIT_MS).toBeGreaterThan(12989);
  });
});

describe('renderProgress — 🔒 la phrase ne change qu après le pire cas mesuré', () => {
  it('pendant tout ce que la mesure a observé, l attente reste ordinaire', () => {
    // 3,1 s (le rendu le plus rapide mesuré) ... 13,0 s (le pire) : rien d anormal.
    [0, 3100, 5200, 8407, 12989, LONG_WAIT_MS - 1].forEach((elapsedMs) => {
      expect(isLongWait(elapsedMs)).toBe(false);
    });
  });

  it('au-delà, elle bascule — et elle y reste', () => {
    [LONG_WAIT_MS, LONG_WAIT_MS + 1, 22937, 60000, 600000].forEach((elapsedMs) => {
      expect(isLongWait(elapsedMs)).toBe(true);
    });
  });

  // L'horloge du téléphone peut être recalée PENDANT l'attente : un temps écoulé
  // négatif ou absurde ne doit pas déclencher un message d'alerte.
  it('une horloge recalée ne fabrique pas une fausse alerte', () => {
    [-1, -600000, NaN, Infinity, undefined, null, '15000'].forEach((absurde) => {
      expect(isLongWait(/** @type {any} */ (absurde))).toBe(false);
    });
  });
});
