// NIVEAUX-PAR-SPORT (17/11/2026) — filtre pur des niveaux d'equipe par sport, sans dependance.

/**
 * NIVEAUX-PAR-SPORT (17/11/2026) — les niveaux a proposer pour une equipe de ce sport : ceux qui
 * sont relies au sport s'il en a, sinon ceux qui ne sont relies a aucun sport (« tous sports »).
 * Un serveur ancien ne renvoie pas `activities` : tous ses niveaux valent alors « tous sports ».
 * L'ordre recu est garde.
 * @template {{ activities?: { documentId?: string }[] | null }} T
 * @param {T[] | undefined} niveaux - Les niveaux, tels que getLevels les rend.
 * @param {string | undefined} sport - Le documentId du sport choisi (vide si aucun).
 * @returns {T[]}
 */
export const niveauxPourLeSport = (niveaux, sport) => {
  const liste = niveaux || [];
  const sportsDe = (/** @type {T} */ niveau) => (
    Array.isArray(niveau?.activities) ? niveau.activities : []
  );
  const propres = sport
    ? liste.filter((niveau) => sportsDe(niveau).some((activite) => activite?.documentId === sport))
    : [];
  return propres.length ? propres : liste.filter((niveau) => sportsDe(niveau).length === 0);
};
