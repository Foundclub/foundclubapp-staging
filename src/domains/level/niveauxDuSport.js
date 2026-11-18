// NIVEAUX-PAR-SPORT (17/11/2026) — filtre pur des niveaux d'equipe par sport.
import { cleDeSport } from '@/domains/activity/cleDeSport';

/**
 * Les niveaux a proposer pour ce sport : ceux qui ne sont relies a aucun sport (« tous sports »),
 * plus ceux qui sont relies a ce sport. INSCRIPTION-PARCOURS-2 (D257, Q1 d'Adel) : les 4 niveaux
 * « Debutant … Expert » sont pour tous, la competition est reliee aux sports a competition ; la
 * speleo n'a que les 4, le foot a les 4 puis la competition. Le sport se reconnait a son documentId
 * (equipes) ou a son nom (inscription, qui ne garde que le nom ; « Volley » = « Volleyball »).
 * Un serveur ancien ne renvoie pas `activities` : tous ses niveaux valent alors « tous sports ».
 * L'ordre recu est garde.
 * @template {{ activities?: { documentId?: string, name?: string }[] | null }} T
 * @param {T[] | undefined} niveaux - Les niveaux, tels que getLevels les rend.
 * @param {string | undefined} sport - Le documentId ou le nom du sport choisi (vide si aucun).
 * @returns {T[]}
 */
export const niveauxPourLeSport = (niveaux, sport) => {
  const liste = niveaux || [];
  const cle = sport ? cleDeSport(sport) : '';
  const sportsDe = (/** @type {T} */ niveau) => (
    Array.isArray(niveau?.activities) ? niveau.activities : []
  );
  const estCeSport = (/** @type {{ documentId?: string, name?: string }} */ activite) => (
    Boolean(sport) && (activite?.documentId === sport
      || (Boolean(activite?.name) && cleDeSport(activite.name) === cle))
  );
  return liste.filter((niveau) => (
    sportsDe(niveau).length === 0 || sportsDe(niveau).some(estCeSport)
  ));
};
