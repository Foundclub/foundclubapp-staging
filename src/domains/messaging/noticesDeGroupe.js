import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * MSG1BA (§3.17) — LES NOTICES DE GROUPE, ECRITES POUR LE LECTEUR (« Vous ») — contrat
 * MESSAGERIE-1B §6.
 *
 * Le serveur poste chaque notice avec deux formes : `message`, la phrase francaise a la 3e
 * personne (« Adel Ferchichi a renomme le groupe… », ce que lit une app d'avant), et
 * `systemNotice` `{ version, kind, actor, targets, groupName?, permission? }`, ce que l'app
 * neuve RECRIT : « Vous » quand l'auteur est le lecteur, « vous » quand il est vise.
 * ⛔ Une sorte inconnue, ou une notice INCOMPLETE (sans l'auteur, le nom du groupe, les
 * personnes visees ou l'autorisation qu'exige sa sorte) : on garde la phrase du serveur, telle
 * quelle — jamais de trou ni de « Un membre » invente dans le fil.
 * Les phrases suivent celles du serveur (`group-notices.js`, `buildGroupNoticeText`).
 */

/**
 * @typedef {object} Phrase
 * @property {string} cle - Sous `conversation.notice`.
 * @property {string} vous - Le lecteur en est l'auteur.
 * @property {string} autre - Quelqu'un d'autre l'est.
 * @property {string} [moi] - Le lecteur est la SEULE personne visee.
 */

/**
 * Les phrases de chaque sorte (replis francais ; les traductions vivent dans fr.js / en.js).
 * @type {Record<string, Phrase>}
 */
const PHRASES = {
  admin_added: {
    autre: '{{name}} a nommé {{targets}} admin du groupe.',
    cle: 'adminAdded',
    moi: '{{name}} vous a nommé admin du groupe.',
    vous: 'Vous avez nommé {{targets}} admin du groupe.',
  },
  admin_removed: {
    autre: '{{name}} a retiré le rôle d’admin à {{targets}}.',
    cle: 'adminRemoved',
    moi: '{{name}} vous a retiré le rôle d’admin.',
    vous: 'Vous avez retiré le rôle d’admin à {{targets}}.',
  },
  admins_added: {
    autre: '{{name}} a nommé {{targets}} admins du groupe.',
    cle: 'adminsAdded',
    vous: 'Vous avez nommé {{targets}} admins du groupe.',
  },
  group_created: {
    autre: '{{name}} a créé le groupe « {{group}} ».',
    cle: 'created',
    vous: 'Vous avez créé le groupe « {{group}} ».',
  },
  group_photo_changed: {
    autre: '{{name}} a changé la photo du groupe.',
    cle: 'photoChanged',
    vous: 'Vous avez changé la photo du groupe.',
  },
  group_photo_removed: {
    autre: '{{name}} a supprimé la photo du groupe.',
    cle: 'photoRemoved',
    vous: 'Vous avez supprimé la photo du groupe.',
  },
  group_renamed: {
    autre: '{{name}} a renommé le groupe en « {{group}} ».',
    cle: 'renamed',
    vous: 'Vous avez renommé le groupe en « {{group}} ».',
  },
  member_added: {
    autre: '{{name}} a ajouté {{targets}}.',
    cle: 'added',
    moi: '{{name}} vous a ajouté.',
    vous: 'Vous avez ajouté {{targets}}.',
  },
  member_left: {
    autre: '{{name}} a quitté le groupe.',
    cle: 'left',
    vous: 'Vous avez quitté le groupe.',
  },
  member_removed: {
    autre: '{{name}} a retiré {{targets}}.',
    cle: 'removed',
    moi: '{{name}} vous a retiré.',
    vous: 'Vous avez retiré {{targets}}.',
  },
};

/** Les autorisations changees : [suffixe de clef, repli francais], par « clef.valeur ». */
const AUTORISATIONS = /** @type {Record<string, [string, string]>} */ ({
  'membersCanAddMembers.off': ['addMembersOff', 'réservé aux admins l’ajout de membres'],
  'membersCanAddMembers.on': ['addMembersOn', 'autorisé les membres à ajouter des membres'],
  'membersCanEditName.off': [
    'editNameOff', 'réservé aux admins la modification du nom du groupe',
  ],
  'membersCanEditName.on': ['editNameOn', 'autorisé les membres à modifier le nom du groupe'],
  'membersCanEditPhoto.off': [
    'editPhotoOff', 'réservé aux admins la modification de la photo du groupe',
  ],
  'membersCanEditPhoto.on': [
    'editPhotoOn', 'autorisé les membres à modifier la photo du groupe',
  ],
  'membersCanSendMessages.off': ['sendMessagesOff', 'réservé l’envoi de messages aux admins'],
  'membersCanSendMessages.on': [
    'sendMessagesOn', 'autorisé tous les membres à envoyer des messages',
  ],
});

/**
 * Ce que chaque sorte exige pour etre recrite (contrat 1B §6.2).
 * @type {Record<string, { auteur?: boolean, autorisation?: boolean, cibles?: boolean,
 *   groupe?: boolean }>}
 */
const EXIGENCES = {
  admin_added: { auteur: true, cibles: true },
  admin_inherited: { cibles: true },
  admin_removed: { auteur: true, cibles: true },
  group_created: { auteur: true, groupe: true },
  group_photo_changed: { auteur: true },
  group_photo_removed: { auteur: true },
  group_renamed: { auteur: true, groupe: true },
  member_added: { auteur: true, cibles: true },
  member_left: { auteur: true },
  member_removed: { auteur: true, cibles: true },
  permission_changed: { auteur: true, autorisation: true },
};

/**
 * La notice porte-t-elle tout ce que sa sorte exige ?
 * @param {any} notice
 * @returns {boolean}
 */
const estComplete = (notice) => {
  const exige = EXIGENCES[String(notice?.kind || '')];
  if (!exige) return false;
  if (exige.auteur && !String(notice?.actor?.documentId || '')) return false;
  if (exige.groupe && !String(notice?.groupName || '').trim()) return false;
  if (exige.cibles && !(Array.isArray(notice?.targets) && notice.targets.length)) return false;
  if (exige.autorisation && !String(notice?.permission?.key || '')) return false;
  return true;
};

/**
 * Le nom d'une personne nommee par une notice.
 * @param {any} personne - `{ documentId, firstname, lastname }`.
 * @param {(cle: string, repli: any) => string} t
 * @returns {string}
 */
const nomDe = (personne, t) => `${personne?.firstname || ''} ${personne?.lastname || ''}`.trim()
  || t('conversation.notice.someone', 'Un membre');

/**
 * Les cibles d'une notice, le lecteur ecrit « vous » : « B », « B et vous », « B, C et vous ».
 * @param {any[]} cibles
 * @param {string} meId
 * @param {(cle: string, repli: any) => string} t
 * @returns {string}
 */
const listeDesCibles = (cibles, meId, t) => {
  const noms = cibles.map((cible) => (Boolean(meId) && String(cible?.documentId || '') === meId
    ? t('conversation.notice.youLower', 'vous')
    : nomDe(cible, t)));
  if (noms.length <= 1) return noms[0] || t('conversation.notice.someoneLower', 'un membre');
  return t('conversation.notice.list', {
    debut: noms.slice(0, -1).join(', '),
    defaultValue: '{{debut}} et {{dernier}}',
    dernier: noms[noms.length - 1],
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * MSG1BA (§3.17) — la phrase d'une notice de groupe pour CE lecteur.
 * @param {any} notice - `systemNotice` du message.
 * @param {string} meId - Le lecteur.
 * @param {(cle: string, repli: any) => string} t
 * @param {string} [repli] - La phrase du serveur (`message`), pour une sorte inconnue.
 * @returns {string}
 */
export const texteDeLaNotice = (notice, meId, t, repli = '') => {
  const phraseDuServeur = String(repli || '');
  if (!notice || typeof notice !== 'object' || !estComplete(notice)) return phraseDuServeur;
  const moi = String(meId || '');
  const cEstMoi = Boolean(moi) && String(notice.actor?.documentId || '') === moi;
  const cibles = Array.isArray(notice.targets) ? notice.targets : [];
  const seulementMoi = Boolean(moi) && cibles.length === 1 && String(cibles[0]?.documentId || '') === moi;
  const valeurs = {
    group: String(notice.groupName || ''),
    name: nomDe(notice.actor, t),
    targets: listeDesCibles(cibles, moi, t),
    ...SANS_ECHAPPEMENT,
  };

  if (notice.kind === 'admin_inherited') {
    return seulementMoi
      ? t('conversation.notice.adminInherited.me', 'Vous devenez admin du groupe.')
      : t('conversation.notice.adminInherited.other', {
        defaultValue: '{{targets}} devient admin du groupe.',
        ...valeurs,
      });
  }

  if (notice.kind === 'permission_changed') {
    const etat = notice.permission?.value ? 'on' : 'off';
    const cle = `${String(notice.permission?.key || '')}.${etat}`;
    const [suffixe, action] = AUTORISATIONS[cle] || [
      'permissions', 'changé les autorisations du groupe',
    ];
    const verbe = t(`conversation.notice.permission.${suffixe}`, action);
    return cEstMoi
      ? t('conversation.notice.youDid', {
        action: verbe,
        defaultValue: 'Vous avez {{action}}.',
        ...SANS_ECHAPPEMENT,
      })
      : t('conversation.notice.someoneDid', {
        action: verbe,
        defaultValue: '{{name}} a {{action}}.',
        ...valeurs,
      });
  }

  const sorte = notice.kind === 'admin_added' && cibles.length > 1 ? 'admins_added' : notice.kind;
  const phrase = PHRASES[sorte];
  if (!phrase) return phraseDuServeur;
  if (phrase.moi && seulementMoi && !cEstMoi) {
    return t(`conversation.notice.${phrase.cle}.me`, { defaultValue: phrase.moi, ...valeurs });
  }
  return cEstMoi
    ? t(`conversation.notice.${phrase.cle}.you`, { defaultValue: phrase.vous, ...valeurs })
    : t(`conversation.notice.${phrase.cle}.other`, { defaultValue: phrase.autre, ...valeurs });
};

export default texteDeLaNotice;
