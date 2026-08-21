import { formatDateTimeWithDayPrefix } from '@/utils/date';

/**
 * AC07 — CE QUE L ECRAN DIT APRES UNE RELANCE, et pourquoi c est ici.
 *
 * Avant ce lot, l ecran disait « Ta relance a bien ete envoyee » dans TOUS les
 * cas de reussite HTTP. Or le serveur repond 200 dans trois situations qui
 * n ont rien a voir :
 *   1. des notifications sont vraiment parties ;
 *   2. l anti-spam de 48 h a tout ecarte — personne n a rien recu ;
 *   3. plus personne n avait de reponse en attente.
 * Un coach qui appuyait deux fois lisait donc deux fois « c est parti », et
 * croyait avoir relance.
 *
 * La phrase se decide dans une fonction PURE, en dehors de l ecran : c est ce
 * qui permet de la mettre sous temoin sans monter un rendu.
 */

/**
 * AC07 : la clef partagee entre la relance et le bouton qui la declenche.
 * Elle vit ici, dans le module pur, et non dans le hook : c est ce qui permet a
 * `EventParticipants` de se griser sans tirer tout `useEventMutations` — ni
 * ajouter une prop a faire descendre depuis `EventDetails`.
 * @type {string[]}
 */
export const REMIND_EVENT_MUTATION_KEY = ['event', 'remindUnansweredPlayers'];

/**
 * @typedef {object} RemindReport
 * @property {number} [blockedCount] - Personnes ecartees par l anti-spam de 48 h.
 * @property {string | null} [lastRemindedAt] - Date de la derniere relance recue.
 * @property {string | null} [nextReminderAt] - Date de la prochaine relance possible.
 * @property {number} [remindedCount] - Personnes reellement relancees.
 * @property {number} [unansweredCount] - Personnes sans reponse au moment de l appel.
 */

/**
 * @typedef {object} RemindMessage
 * @property {'sent' | 'blocked' | 'nobody'} outcome - Ce qui s est reellement passe.
 * @property {string} title - Le titre de la modale.
 * @property {string} description - Le corps de la modale.
 */

/**
 * Traduit le compte rendu du serveur en la phrase que l ecran doit afficher.
 * @param {RemindReport | null | undefined} report - Le compte rendu du serveur.
 * @returns {RemindMessage} - Le titre et le corps a afficher, et ce qui s est passe.
 */
export const buildRemindMessage = (report) => {
  const remindedCount = Number(report?.remindedCount) || 0;
  const blockedCount = Number(report?.blockedCount) || 0;

  if (remindedCount > 0) {
    const people = remindedCount > 1 ? 'personnes relancees' : 'personne relancee';
    let description = 'Elles vont recevoir une notification pour leur rappeler de repondre.';
    if (blockedCount === 1) {
      description = 'Une autre personne a deja ete relancee il y a moins de 48 h :'
        + ' elle ne recevra rien de plus.';
    }
    if (blockedCount > 1) {
      description = `${blockedCount} autres personnes ont deja ete relancees`
        + ' il y a moins de 48 h : elles ne recevront rien de plus.';
    }

    return {
      description,
      outcome: 'sent',
      title: `${remindedCount} ${people}`,
    };
  }

  // 🚨 Le coeur du lot : ici, RIEN n est parti. On ne dit jamais « c est envoye ».
  if (blockedCount > 0) {
    const lastRemindedAt = formatDateTimeWithDayPrefix(report?.lastRemindedAt);
    const nextReminderAt = formatDateTimeWithDayPrefix(report?.nextReminderAt);

    const already = lastRemindedAt
      ? `Deja relance le ${lastRemindedAt}.`
      : 'Deja relance il y a moins de 48 h.';
    const next = nextReminderAt
      ? ` Tu pourras relancer a partir du ${nextReminderAt}.`
      : ' Il faut attendre 48 h entre deux relances.';

    return {
      description: `${already}${next}`,
      outcome: 'blocked',
      title: 'Personne n a ete relance',
    };
  }

  return {
    description: 'Tout le monde a deja repondu : il n y avait personne a relancer.',
    outcome: 'nobody',
    title: 'Personne n a ete relance',
  };
};

export default buildRemindMessage;
