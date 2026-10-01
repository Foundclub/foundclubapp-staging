/**
 * COLL-CLUBS (01/10/2026) — ce que les ecrans « Clubs rattaches » et la fiche d un club,
 * cote mairie, ecrivent : fonctions PURES, sans appel reseau ni client HTTP (memoire
 * piege-env-absent-worktree-import-service : les hooks restent dans services/).
 *
 * 🔒 SPEC §2 G et H : ces fonctions ne recoivent que ce que le serveur rend a la mairie — le
 * NOM des dirigeants, des nombres, des noms d equipes et d installations. Jamais une personne.
 */

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/** @typedef {(cle: string, repli: string, options?: Record<string, unknown>) => string} Traduire */

/**
 * Un nombre du serveur, ou « — » s il est illisible (jamais un 0 invente).
 * @param {unknown} valeur - Le nombre.
 * @returns {string} Le libelle.
 */
export const nombreOuTiret = (valeur) => (Number.isInteger(valeur) ? String(valeur) : '—');

/**
 * Les noms lisibles des dirigeants.
 * @param {unknown} leaders - `[{ name }]` du serveur, ou null.
 * @returns {string[]} Les noms.
 */
const listeDesNoms = (leaders) => (Array.isArray(leaders) ? leaders : [])
  .map((leader) => String(leader?.name || '').trim())
  .filter(Boolean);

/**
 * Les noms des dirigeants, joints : « Karim Benali, Lea Martin » ; '' s il n y en a pas.
 * @param {unknown} leaders - `[{ name }]` du serveur, ou null (le club masque ses membres).
 * @returns {string} Les noms.
 */
export const nomsDesDirigeants = (leaders) => listeDesNoms(leaders).join(', ');

/**
 * « Dirigeant : Karim Benali » (un) ou « Dirigeants : A, B » (plusieurs) ; '' sinon.
 * @param {Traduire} t - La traduction de l ecran.
 * @param {unknown} leaders - `[{ name }]` du serveur.
 * @returns {string} La ligne, ou ''.
 */
export const ligneDirigeants = (t, leaders) => {
  const liste = listeDesNoms(leaders);
  if (liste.length === 0) return '';
  const noms = liste.join(', ');
  return liste.length > 1
    ? t('collectiviteClubs.leaders.many', 'Dirigeants : {{noms}}', { noms, ...SANS_ECHAPPEMENT })
    : t('collectiviteClubs.leaders.one', 'Dirigeant : {{noms}}', { noms, ...SANS_ECHAPPEMENT });
};

/**
 * « Cette semaine : 2 séances · Gymnase des Tilleuls » — compte depuis le planning des
 * installations de la Ville. Illisible : « — » ; aucune : on le dit, sans inventer de lieu.
 * Le lieu suit un point median (jamais « au » : « à la Salle annexe » ne s accorderait pas).
 * @param {Traduire} t - La traduction de l ecran.
 * @param {unknown} sessions - `{ count, facilities }` du serveur, ou null.
 * @returns {string} La ligne.
 */
export const ligneSeancesDeLaSemaine = (t, sessions) => {
  const seances = /** @type {{ count?: unknown, facilities?: unknown } | null} */ (sessions);
  if (!seances || !Number.isInteger(seances.count)) {
    return t('collectiviteClubs.week.unknown', 'Cette semaine : —');
  }
  const nombre = Number(seances.count);
  if (nombre === 0) {
    return t('collectiviteClubs.week.none', 'Cette semaine : aucune séance sur vos installations');
  }
  const lieux = (Array.isArray(seances.facilities) ? seances.facilities : [])
    .filter(Boolean)
    .join(', ');
  if (nombre === 1) {
    return t(
      'collectiviteClubs.week.one',
      'Cette semaine : 1 séance · {{lieux}}',
      { lieux, ...SANS_ECHAPPEMENT },
    );
  }
  return t(
    'collectiviteClubs.week.many',
    'Cette semaine : {{nombre}} séances · {{lieux}}',
    { lieux, nombre, ...SANS_ECHAPPEMENT },
  );
};
