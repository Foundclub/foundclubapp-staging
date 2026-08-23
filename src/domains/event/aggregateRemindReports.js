/**
 * N4 (D3) — LE COMPTE RENDU D UNE RELANCE QUI A TOUCHE PLUSIEURS EQUIPES.
 *
 * 🧨 LE FAIT SERVEUR QUI COMMANDE TOUT : `/remind-unanswered-players` n accepte
 * qu UN SEUL `teamId` par appel. Relancer deux equipes, c est donc deux POST —
 * et deux comptes rendus. L ecran, lui, doit rendre UNE phrase.
 *
 * La reunion se fait dans une fonction PURE, en dehors de l ecran et du hook :
 *   · elle se met sous temoin sans monter un rendu ;
 *   · elle garantit que le chiffre affiche est la SOMME DES REPONSES RECUES,
 *     jamais le nombre de personnes que l app avait compte avant d envoyer
 *     (l anti-spam de 48 h en ecarte une partie, et lui seul sait combien).
 *
 * ⛔ Elle ne remplace pas `buildRemindMessage` : elle produit un compte rendu
 * de MEME FORME que celui d une equipe seule, que `buildRemindMessage` sait
 * deja traduire. Une seule phrase de reference, pour un et pour plusieurs.
 */

/**
 * @typedef {import('./remindReport').RemindReport} RemindReport
 */

/**
 * @typedef {object} RemindEntry
 * @property {string} teamId - L equipe visee par cet appel.
 * @property {string} [teamName] - Son nom, pour la ventilation.
 * @property {boolean} [echec] - Vrai si CET appel-la n a pas abouti.
 * @property {RemindReport | null | undefined} report - Ce que le serveur a rendu.
 */

/**
 * @typedef {object} RemindTeamLine
 * @property {number} blockedCount - Personnes ecartees par l anti-spam, pour cette equipe.
 * @property {boolean} echec - Vrai si l appel de cette equipe-la n a pas abouti.
 * @property {number} remindedCount - Personnes reellement relancees, pour cette equipe.
 * @property {string} teamId - L equipe.
 * @property {string} teamName - Son nom.
 * @property {number} unansweredCount - Personnes sans reponse au moment de l appel.
 */

/**
 * @typedef {object} AggregatedRemindReport
 * @property {number} blockedCount - Somme des personnes ecartees par l anti-spam.
 * @property {number} echecCount - Nombre d equipes dont l appel n a pas abouti.
 * @property {string | null} lastRemindedAt - La PLUS RECENTE des dernieres relances.
 * @property {string | null} nextReminderAt - La PLUS TARDIVE des prochaines relances.
 * @property {RemindTeamLine[]} parEquipe - Le detail, une ligne par equipe appelee.
 * @property {any[]} recipients - Toutes les personnes relancees, bout a bout.
 * @property {number} remindedCount - Somme des personnes reellement relancees.
 * @property {number} unansweredCount - Somme des personnes sans reponse.
 */

/**
 * Un nombre sur lequel on peut compter, meme quand le serveur se tait.
 * @param {any} valeur - Ce que le serveur a mis dans le champ.
 * @returns {number} - Le nombre, ou 0.
 */
const nombre = (valeur) => (Number.isFinite(Number(valeur)) ? Number(valeur) : 0);

/**
 * Garde la plus TARDIVE de deux dates ISO. Une date illisible ne gagne jamais.
 *
 * 🔒 Pourquoi la plus tardive pour `nextReminderAt` : c est la seule reponse
 * honnete a « quand pourrai-je relancer ? ». Si une equipe rouvre a 10 h et
 * l autre a 12 h, annoncer 10 h promet une relance complete qui n aura pas
 * lieu. Le lecteur doit lire le moment ou TOUT redevient possible.
 * @param {string | null} actuelle - La date retenue jusqu ici.
 * @param {any} candidate - La date proposee.
 * @returns {string | null} - La plus tardive des deux.
 */
const plusTardive = (actuelle, candidate) => {
  const msCandidate = Date.parse(candidate || '');
  if (!Number.isFinite(msCandidate)) return actuelle;
  const msActuelle = Date.parse(actuelle || '');
  if (!Number.isFinite(msActuelle)) return String(candidate);

  return msCandidate > msActuelle ? String(candidate) : actuelle;
};

/**
 * Reunit les comptes rendus de N relances en un seul, de la meme forme.
 *
 * ⚠️ Une entree dont le serveur n a rien rendu compte quand meme dans
 * `parEquipe`, a zero : « cette equipe n a rien recu » est une information,
 * et la faire disparaitre de la ventilation la transformerait en oubli.
 *
 * 🚨 ET L ECHEC PARTIEL SE DIT. Deux equipes, deux POST : le second peut
 * tomber alors que le premier est parti. Les deux replis evidents mentent :
 *   · tout jeter -> « la relance n a pas pu partir », alors qu une equipe A
 *     BIEN ete prevenue ;
 *   · l ignorer  -> « equipe B : 0 relance », qui se lit « personne n en avait
 *     besoin ».
 * La ligne porte donc `echec`, et le total `echecCount`. C est la meme regle
 * que celle qui a fonde AC07 : on ne dit jamais « c est envoye » quand rien
 * n est parti — ni l inverse.
 * @param {RemindEntry[] | null | undefined} entrees - Un appel par equipe.
 * @returns {AggregatedRemindReport} - Le compte rendu reuni.
 */
export const aggregateRemindReports = (entrees) => {
  const liste = Array.isArray(entrees) ? entrees : [];

  return liste.reduce((cumul, entree) => {
    // Le typedef partage de `remindReport` ne declare pas `recipients` (il
    // decrit ce que `buildRemindMessage` LIT, pas toute la reponse serveur).
    // On lit donc la charge telle qu'elle arrive, sans lui mentir sur sa forme.
    const rapport = /** @type {any} */ (entree?.report || null);
    const echec = Boolean(entree?.echec);
    const remindedCount = nombre(rapport?.remindedCount);
    const blockedCount = nombre(rapport?.blockedCount);
    const unansweredCount = nombre(rapport?.unansweredCount);
    const recipients = Array.isArray(rapport?.recipients) ? rapport.recipients : [];

    cumul.parEquipe.push({
      blockedCount,
      echec,
      remindedCount,
      teamId: String(entree?.teamId || ''),
      teamName: String(entree?.teamName || ''),
      unansweredCount,
    });

    return {
      blockedCount: cumul.blockedCount + blockedCount,
      echecCount: cumul.echecCount + (echec ? 1 : 0),
      lastRemindedAt: plusTardive(cumul.lastRemindedAt, rapport?.lastRemindedAt),
      nextReminderAt: plusTardive(cumul.nextReminderAt, rapport?.nextReminderAt),
      parEquipe: cumul.parEquipe,
      recipients: cumul.recipients.concat(recipients),
      remindedCount: cumul.remindedCount + remindedCount,
      unansweredCount: cumul.unansweredCount + unansweredCount,
    };
  }, {
    blockedCount: 0,
    echecCount: 0,
    lastRemindedAt: /** @type {string | null} */ (null),
    nextReminderAt: /** @type {string | null} */ (null),
    parEquipe: /** @type {RemindTeamLine[]} */ ([]),
    recipients: /** @type {any[]} */ ([]),
    remindedCount: 0,
    unansweredCount: 0,
  });
};

export default aggregateRemindReports;
