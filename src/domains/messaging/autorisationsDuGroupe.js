import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * MSG1BA (§3.15, §3.16) — LES AUTORISATIONS D'UN GROUPE (contrat MESSAGERIE-1B §5).
 *
 * Quatre clefs « Les membres peuvent… », valeurs par defaut = le comportement d'avant 1B (et
 * celles du pack) : nom non, photo non, messages oui, ajout non. Les admins ont toujours tous
 * les droits. Le serveur pose `groupPermissions` (les quatre clefs, defauts resolus) sur le
 * detail d'un groupe : son ABSENCE dit un serveur d'avant 1B, qui n'en sait rien.
 */

/**
 * @typedef {'membersCanAddMembers' | 'membersCanEditName' | 'membersCanEditPhoto'
 *   | 'membersCanSendMessages'} CleDAutorisation
 */

/** Les valeurs par defaut du serveur (contrat 1B §5.1). */
export const AUTORISATIONS_PAR_DEFAUT = Object.freeze({
  membersCanAddMembers: false,
  membersCanEditName: false,
  membersCanEditPhoto: false,
  membersCanSendMessages: true,
});

/** L'ordre du pack (« Modifier le nom », « la photo », « Envoyer des messages », « Ajouter »). */
export const CLES_DES_AUTORISATIONS = /** @type {CleDAutorisation[]} */ ([
  'membersCanEditName',
  'membersCanEditPhoto',
  'membersCanSendMessages',
  'membersCanAddMembers',
]);

/**
 * Les autorisations d'un groupe telles que le serveur les rend, ou `null` pour un serveur
 * d'avant 1B (pas de clef) : l'ecran cache alors tout ce qui en depend.
 * @param {any} chat - Le detail du fil.
 * @returns {Record<CleDAutorisation, boolean> | null}
 */
export const autorisationsDuGroupe = (chat) => {
  const brutes = chat?.groupPermissions;
  if (!brutes || typeof brutes !== 'object') return null;
  /** @type {Record<string, boolean>} */
  const valeurs = { ...AUTORISATIONS_PAR_DEFAUT };
  CLES_DES_AUTORISATIONS.forEach((cle) => {
    if (typeof brutes[cle] === 'boolean') valeurs[cle] = brutes[cle];
  });
  return /** @type {Record<CleDAutorisation, boolean>} */ (valeurs);
};

/**
 * Ce qui differe des valeurs par defaut, a envoyer a la creation (`data.permissions`,
 * partiel). Rien de change : `undefined`, et la requete garde sa forme d'avant 1B.
 * @param {Record<string, boolean>} valeurs
 * @returns {Partial<Record<CleDAutorisation, boolean>> | undefined}
 */
export const autorisationsModifiees = (valeurs) => {
  /** @type {Record<string, boolean>} */
  const changees = {};
  CLES_DES_AUTORISATIONS.forEach((cle) => {
    if (typeof valeurs?.[cle] === 'boolean' && valeurs[cle] !== AUTORISATIONS_PAR_DEFAUT[cle]) {
      changees[cle] = valeurs[cle];
    }
  });
  return Object.keys(changees).length ? changees : undefined;
};

/**
 * Un geste de groupe est-il permis ? Admin : toujours. Membre : si l'autorisation est ouverte.
 * Serveur d'avant 1B (`autorisations` nul) : seuls les admins, comme avant.
 * @param {{ estAdmin: boolean, autorisations: Record<string, boolean> | null }} lecteur
 * @param {CleDAutorisation} cle
 * @returns {boolean}
 */
export const peutDansLeGroupe = ({ autorisations, estAdmin }, cle) => (
  Boolean(estAdmin) || Boolean(autorisations?.[cle])
);

/**
 * Le lecteur (non admin) ne peut pas ecrire : « Seuls les admins peuvent envoyer des
 * messages » remplace la saisie (pack §3.16). Serveur d'avant 1B : jamais.
 * @param {{ estAdmin: boolean, autorisations: Record<string, boolean> | null }} lecteur
 * @returns {boolean}
 */
export const envoiReserveAuxAdmins = ({ autorisations, estAdmin }) => (
  !estAdmin && autorisations?.membersCanSendMessages === false
);

/**
 * La ligne sous « Autorisations du groupe » (pack, `permSummary`) : « Les membres peuvent
 * écrire, renommer », ou « Seuls les admins peuvent agir ».
 * @param {Record<string, boolean>} valeurs
 * @param {(cle: string, repli: any) => string} t
 * @returns {string}
 */
export const resumeDesAutorisations = (valeurs, t) => {
  const permis = [
    valeurs?.membersCanSendMessages
      ? t('conversation.groupPermissions.summaryWrite', 'écrire')
      : '',
    valeurs?.membersCanEditName ? t('conversation.groupPermissions.summaryRename', 'renommer') : '',
    valeurs?.membersCanEditPhoto
      ? t('conversation.groupPermissions.summaryPhoto', 'changer la photo')
      : '',
    valeurs?.membersCanAddMembers
      ? t('conversation.groupPermissions.summaryAdd', 'ajouter des membres')
      : '',
  ].filter(Boolean);
  if (!permis.length) {
    return t('conversation.groupPermissions.summaryAdminsOnly', 'Seuls les admins peuvent agir');
  }
  return t('conversation.groupPermissions.summary', {
    actions: permis.join(', '),
    defaultValue: 'Les membres peuvent {{actions}}',
    ...SANS_ECHAPPEMENT,
  });
};
