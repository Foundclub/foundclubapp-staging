/**
 * MARQUE-MAIRIE (14/10/2026, COL-003, décision d'Adel « D3- B » du 12/10 puis « 3- ok go » du
 * 14/10) — LES MOTS D'UNE SÉANCE EN ATTENTE, partout où elle apparaît : la grille du planning
 * (COLL-R-A4), la carte de « Mes événements », la vue mois du planning, le bandeau de l'accueil.
 * Le serveur dit
 * QUI décide (`pendingDecider`, la règle de la fiche) ; une seule règle dit les mots, ceux de la
 * fiche (`EventDetails`, FINITIONS13-COLL). Rien pour une séance qui n'attend pas, ni pour une
 * valeur inconnue (un serveur d'avant, ou d'après).
 * @param {unknown} decideur - `pendingDecider` : `mairie`, `dirigeant` ou `proprietaire`.
 * @param {(...args: any[]) => any} t - La traduction.
 * @returns {string | null} « En attente de la mairie », « … de ton dirigeant », « … du
 *   gestionnaire de l’installation », ou rien.
 */
export const pendingDeciderLabel = (decideur, t) => {
  switch (String(decideur || '')) {
    case 'dirigeant':
      return t('collectiviteDemandes.club.enAttenteDuDirigeant', 'En attente de ton dirigeant');
    case 'mairie':
      return t('collectiviteDemandes.club.enAttenteDeLaMairie', 'En attente de la mairie');
    case 'proprietaire':
      return t(
        'collectiviteDemandes.club.enAttenteDuProprietaire',
        'En attente du gestionnaire de l’installation',
      );
    default:
      return null;
  }
};

export default pendingDeciderLabel;
