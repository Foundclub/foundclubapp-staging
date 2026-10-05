/**
 * « Mes activites » — la lecture des donnees, sans une ligne de rendu.
 *
 * Captures 06 et 07 du pack Rechercher. On publie depuis Rechercher, on GERE
 * ici : d un cote ce que j ai publie, de l autre ce qu on m a repondu.
 *
 * Tout ce que le pack demande existe deja cote serveur — mesure avant d ecrire :
 *   · recruitmentService.normalizeRecruitmentAd pose `applicationsCount` ;
 *   · friendlyMatchService.normalizeFriendlyMatchAd pose `applicationsCount`
 *     ET `pendingApplicationsCount` ;
 *   · `isActive` (offre) et `status` (match) portent le point vert.
 *
 * ⚠️ SEULE EXCEPTION : le badge « Nouveau » du pack suppose un « lu / non lu »
 * par reponse. Rien ne le stocke, ni dans l app ni dans le serveur. On lit donc
 * « Nouveau » = « jamais repondu » (`status === 'pending'`), ce qui est vrai au
 * premier regard et devient faux si on laisse une candidature en attente sans
 * la traiter. Un vrai « non lu » est un lot serveur.
 */

import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getRecruitmentAdExpiry } from '@/utils/recruitmentAdRenewal';
import { getRecruitmentAdPlayerTitle } from '@/utils/recruitmentAdTitle';

import { getCoachRoleLabel } from '@/constants/coachRoles';

const PENDING_STATUS = 'pending';

/**
 * Accord singulier / pluriel, sans bibliotheque.
 * @param {number} count Le nombre.
 * @param {string} singular Le mot au singulier.
 * @param {string} [plural] Le mot au pluriel, si different de `${singular}s`.
 * @returns {string} Le nombre suivi du mot accorde.
 */
export const pluralize = (count, singular, plural) => {
  const word = count > 1 ? (plural || `${singular}s`) : singular;
  return `${count} ${word}`;
};

const documentKey = (/** @type {any} */ item) => String(item?.documentId || item?.id || '');

const joinMeta = (/** @type {any[]} */ parts) => parts
  .map((part) => String(part || '').trim())
  .filter(Boolean)
  .join(' · ');

const nameOf = (/** @type {any} */ value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.name || value.label || '');
};

/**
 * Le titre d une offre, dans les mots du pack : « Ailier fort — Seniors A ».
 * Sans poste (sport sans postes) : « Arts martiaux — U13 — Seniors A ».
 * @param {any} ad L offre de recrutement.
 * @returns {string} Le titre affiche.
 */
export const buildRecruitmentAdTitle = (ad) => {
  const isCoachAd = String(ad?.audienceType || '').trim().toLowerCase() === 'coach';
  // RECRUTER-TUNNEL (audit V1, H3) — « entraineur_adjoint » s'affichait brut ici :
  // le role se lit par la table du tunnel, jamais par sa valeur technique.
  const role = isCoachAd
    ? (getCoachRoleLabel(ad?.coachRole, ad?.coachRoleOther) || i18next.t(
      'myActivitiesFeed.coachRole',
      'Rôle entraîneur',
    ))
    : getRecruitmentAdPlayerTitle(ad);
  const teamName = nameOf(ad?.team);
  return teamName ? `${role} — ${teamName}` : String(role);
};

/**
 * Une offre publiee, prete a etre posee dans une carte.
 * @param {any} ad L offre de recrutement.
 * @returns {any} La ligne de publication.
 */
const toRecruitmentPublication = (ad) => {
  const count = Number(ad?.applicationsCount || 0);
  // ANNONCE-RENOUVELER (6) : une annonce active dont l'echeance est passee est EXPIREE, pas
  // « En ligne » — aucun serveur ne passe `isActive` a false a l'echeance (meme borne que la
  // fiche, utils/recruitmentAdRenewal.js). Test : MyActivitiesScreen.annonceExpiree.test.js.
  const isExpired = Boolean(ad?.isActive) && Boolean(getRecruitmentAdExpiry(ad)?.isExpired);
  return {
    ad,
    countLabel: i18next.t('myActivitiesFeed.applicationCount', {
      count,
      defaultValue_one: '{{count}} candidature',
      defaultValue_other: '{{count}} candidatures',
    }),
    isExpired,
    isOnline: Boolean(ad?.isActive) && !isExpired,
    key: `offre-${documentKey(ad)}`,
    market: 'recruitment',
    meta: joinMeta([
      nameOf(ad?.sport) || nameOf(ad?.team?.sport),
      nameOf(ad?.category),
      nameOf(ad?.section),
    ]),
    responsesCount: count,
    title: buildRecruitmentAdTitle(ad),
    type: 'publication',
  };
};

/**
 * Un match propose, pret a etre pose dans une carte.
 * @param {any} ad L annonce de match amical.
 * @returns {any} La ligne de publication.
 */
const toFriendlyPublication = (ad) => {
  const count = Number(ad?.applicationsCount || 0);
  const hostingLabel = {
    AWAY: i18next.t('myActivitiesFeed.hosting.away', 'Se déplace'),
    BOTH: i18next.t('myActivitiesFeed.hosting.both', 'Reçoit ou se déplace'),
    HOST: i18next.t('myActivitiesFeed.hosting.host', 'Reçoit'),
  }[String(ad?.hostingPreference || '').toUpperCase()] || '';

  return {
    ad,
    countLabel: i18next.t('myActivitiesFeed.proposalCount', {
      count,
      defaultValue_one: '{{count}} proposition',
      defaultValue_other: '{{count}} propositions',
    }),
    // `status` vaut 'open' quand l annonce cherche encore un adversaire. Toute
    // autre valeur (close, matched, expired) eteint le point vert.
    isOnline: String(ad?.status || '').toLowerCase() === 'open',
    key: `match-${documentKey(ad)}`,
    market: 'amicaux',
    meta: joinMeta([
      nameOf(ad?.sport) || nameOf(ad?.team?.sport),
      hostingLabel,
      nameOf(ad?.city) || nameOf(ad?.team?.club?.city),
    ]),
    responsesCount: count,
    title: nameOf(ad?.team) || i18next.t('myActivitiesFeed.friendlyMatch', 'Match amical'),
    type: 'publication',
  };
};

/**
 * L onglet « Publications » : ce que j ai publie, groupe par marche.
 *
 * Un groupe VIDE ne s affiche pas — le pack interdit « 0 candidature » en
 * vitrine, et un titre de section sans carte en dessous est le meme mensonge.
 * @param {{ recruitmentAds?: any[], friendlyAds?: any[] }} sources Les listes brutes.
 * @returns {any[]} Les lignes, sections comprises, dans l ordre d affichage.
 */
export const buildMyActivitiesPublications = ({ recruitmentAds = [], friendlyAds = [] } = {}) => {
  /** @type {any[]} */
  const items = [];

  if (recruitmentAds.length > 0) {
    items.push({
      key: 'section-recrutement',
      title: i18next.t('myActivitiesFeed.sections.recruitment', {
        count: recruitmentAds.length,
        defaultValue_one: 'Recrutement · {{count}} offre',
        defaultValue_other: 'Recrutement · {{count}} offres',
      }),
      type: 'section',
    });
    recruitmentAds.forEach((ad) => items.push(toRecruitmentPublication(ad)));
  }

  if (friendlyAds.length > 0) {
    items.push({
      key: 'section-amicaux',
      title: i18next.t('myActivitiesFeed.sections.friendly', {
        count: friendlyAds.length,
        defaultValue_one: 'Matchs amicaux · {{count}} match proposé',
        defaultValue_other: 'Matchs amicaux · {{count}} matchs proposés',
      }),
      type: 'section',
    });
    friendlyAds.forEach((ad) => items.push(toFriendlyPublication(ad)));
  }

  return items;
};

/**
 * L onglet « Reponses recues » (staff) : qui a repondu a ce que j ai publie.
 *
 * Les candidatures voyagent DANS l annonce (`ad.applications`) : c est la seule
 * facon de les lire — cote amicaux, le serveur n expose pas de route « mes
 * candidatures », friendlyMatchService le dit noir sur blanc.
 * @param {{ recruitmentAds?: any[], friendlyAds?: any[] }} sources Les listes brutes.
 * @returns {any[]} Les lignes, sections comprises.
 */
export const buildMyActivitiesReceivedResponses = ({
  recruitmentAds = [],
  friendlyAds = [],
} = {}) => {
  /** @type {any[]} */
  const candidatures = [];
  recruitmentAds.forEach((ad) => {
    (ad?.applications || []).forEach((/** @type {any} */ application) => {
      const applicant = application?.applicant;
      candidatures.push({
        ad,
        application,
        isNew: String(application?.status || '').toLowerCase() === PENDING_STATUS,
        key: `candidature-${documentKey(ad)}-${documentKey(application)}`,
        market: 'recruitment',
        meta: buildRecruitmentAdTitle(ad),
        // FINITIONS8 (point 2) : le serveur rend `firstname` / `lastname` (toReviewerPayload).
        title: joinMeta([
          applicant?.firstname || applicant?.firstName,
          applicant?.lastname || applicant?.lastName,
        ]).replace(' · ', ' ')
          || nameOf(applicant) || i18next.t('myActivitiesFeed.applicant', 'Candidat'),
        type: 'response',
      });
    });
  });

  /** @type {any[]} */
  const propositions = [];
  friendlyAds.forEach((ad) => {
    (ad?.applications || []).forEach((/** @type {any} */ application) => {
      propositions.push({
        ad,
        application,
        isNew: String(application?.status || '').toLowerCase() === PENDING_STATUS,
        key: `proposition-${documentKey(ad)}-${documentKey(application)}`,
        market: 'amicaux',
        meta: i18next.t('myActivitiesFeed.proposal.on', 'sur {{target}}', {
          ...SANS_ECHAPPEMENT,
          target: nameOf(ad?.team) || i18next.t(
            'myActivitiesFeed.proposal.yourMatch',
            'ton match proposé',
          ),
        }),
        title: i18next.t('myActivitiesFeed.proposal.title', '{{team}} propose un match', {
          ...SANS_ECHAPPEMENT,
          team: nameOf(application?.team) || i18next.t(
            'myActivitiesFeed.proposal.aTeam',
            'Une équipe',
          ),
        }),
        type: 'response',
      });
    });
  });

  /** @type {any[]} */
  const items = [];
  if (candidatures.length > 0) {
    items.push({
      key: 'section-candidatures',
      title: i18next.t(
        'myActivitiesFeed.sections.receivedApplications',
        'Candidatures reçues · {{total}}',
        { total: candidatures.length },
      ),
      type: 'section',
    });
    items.push(...candidatures);
  }
  if (propositions.length > 0) {
    items.push({
      key: 'section-propositions',
      title: i18next.t(
        'myActivitiesFeed.sections.receivedProposals',
        'Propositions reçues · {{total}}',
        { total: propositions.length },
      ),
      type: 'section',
    });
    items.push(...propositions);
  }

  return items;
};

// I18N-4 : une fonction, lue a chaque appel -- une table calculee au chargement du module
// resterait dans la langue du demarrage.
// MES-CANDIDATURES (audit V1, A12) : chaque etat dit aussi DANS QUEL GROUPE il se range
// et de quel ton se dit sa pastille. « En attente » devient « En attente du club » :
// c'est le club qui doit agir, pas moi (meme raison que la pastille grise de A13).
// Une annonce FERMEE (`cancelled`) est une reponse du club ; une candidature RETIREE
// (`withdrawn`) est MON geste, pas une reponse : elle a son groupe a elle.
const sentStatuses = () => ({
  accepted: {
    group: 'answered',
    label: i18next.t('myActivitiesFeed.sentStatus.accepted', 'Acceptée'),
    tone: 'accepted',
  },
  cancelled: {
    group: 'answered',
    label: i18next.t('myActivitiesFeed.sentStatus.cancelled', 'Annonce close'),
    tone: 'closed',
  },
  declined: {
    group: 'answered',
    label: i18next.t('myActivitiesFeed.sentStatus.declined', 'Refusée'),
    tone: 'declined',
  },
  pending: {
    group: 'pending',
    label: i18next.t('myActivitiesFeed.sentStatus.pendingClub', 'En attente du club'),
    tone: 'pending',
  },
  rejected: {
    group: 'answered',
    label: i18next.t('myActivitiesFeed.sentStatus.rejected', 'Refusée'),
    tone: 'declined',
  },
  withdrawn: {
    group: 'withdrawn',
    label: i18next.t('myActivitiesFeed.sentStatus.withdrawn', 'Retirée'),
    tone: 'closed',
  },
});

/**
 * « 12/09 » — et « 12/09/2025 » quand ce n'est pas l'annee en cours : « 12/09 »
 * seul ne dit plus de quelle annee on parle (A14 : une candidature d'avant).
 * @param {any} value La date lue sur la candidature.
 * @param {Date} now Maintenant.
 * @returns {string} La date courte, ou '' si elle est absente ou illisible.
 */
const jourMois = (value, now) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const annee = date.getFullYear();
  return annee === now.getFullYear() ? `${jour}/${mois}` : `${jour}/${mois}/${annee}`;
};

// La date que chaque groupe raconte : l'envoi pour ce qui attend, la reponse pour
// ce qui a ete tranche, le retrait pour ce que j'ai retire.
const dateOfGroup = {
  answered: (/** @type {any} */ application) => application?.reviewedAt || application?.updatedAt,
  pending: (/** @type {any} */ application) => application?.createdAt,
  withdrawn: (/** @type {any} */ application) => application?.updatedAt,
};

/**
 * « envoyée le 12/09 », « réponse le 28/09 », « retirée le 14/09 ».
 * @param {string} group Le groupe de la ligne.
 * @param {string} date La date courte.
 * @returns {string} Le libelle.
 */
const sentDateLabel = (group, date) => {
  const options = { ...SANS_ECHAPPEMENT, date };
  if (group === 'answered') {
    return i18next.t('myActivitiesFeed.sentDate.answered', 'réponse le {{date}}', options);
  }
  if (group === 'withdrawn') {
    return i18next.t('myActivitiesFeed.sentDate.withdrawn', 'retirée le {{date}}', options);
  }
  return i18next.t('myActivitiesFeed.sentDate.pending', 'envoyée le {{date}}', options);
};

/**
 * Le titre d'un groupe, avec son compte.
 * @param {string} group Le groupe.
 * @param {number} total Le nombre de lignes du groupe.
 * @returns {string} Le titre.
 */
const sentGroupTitle = (group, total) => {
  if (group === 'answered') {
    return i18next.t('myActivitiesFeed.sections.answered', 'Réponses reçues · {{total}}', {
      total,
    });
  }
  if (group === 'withdrawn') {
    return i18next.t('myActivitiesFeed.sections.withdrawn', 'Retirées · {{total}}', { total });
  }
  return i18next.t('myActivitiesFeed.sections.pending', 'En attente · {{total}}', { total });
};

const SENT_GROUPS = [
  { group: 'pending', key: 'section-en-attente' },
  { group: 'answered', key: 'section-reponses' },
  { group: 'withdrawn', key: 'section-retirees' },
];

/**
 * Une ligne de « Mes candidatures » : ce que j'ai envoye, quand, et ou ca en est.
 * @param {any} ad L'annonce, portant `myApplication` (ma candidature ou ma proposition).
 * @param {'recruitment' | 'amicaux'} market Le marche.
 * @param {Date} now Maintenant.
 * @returns {any} La ligne.
 */
const toSentLine = (ad, market, now) => {
  const application = ad?.myApplication || {};
  const statuses = sentStatuses();
  const statusKey = String(ad?.applicationStatus || application?.status || PENDING_STATUS)
    .toLowerCase();
  const status = statuses[/** @type {keyof typeof statuses} */ (statusKey)]
    || statuses[PENDING_STATUS];
  const groupKey = /** @type {keyof typeof dateOfGroup} */ (status.group);
  const date = jourMois(dateOfGroup[groupKey](application), now);
  const dateLabel = date ? sentDateLabel(groupKey, date) : '';
  const isRecruitment = market === 'recruitment';

  return {
    ad,
    answeredAt: new Date(dateOfGroup.answered(application) || 0).getTime() || 0,
    // Le medaillon de la ligne (maquette APRES de A12) : le club qui recrute, ou le
    // club de l'equipe qui a publie le match.
    club: ad?.team?.club || null,
    group: status.group,
    isNew: false,
    key: `${isRecruitment ? 'ma-candidature' : 'ma-proposition'}-${documentKey(ad)}`,
    market,
    meta: joinMeta([
      isRecruitment ? (nameOf(ad?.team?.club) || nameOf(ad?.team)) : '',
      dateLabel,
    ]),
    statusLabel: status.label,
    statusTone: status.tone,
    title: isRecruitment
      ? buildRecruitmentAdTitle(ad)
      : nameOf(ad?.team) || i18next.t('myActivitiesFeed.friendlyMatch', 'Match amical'),
    type: 'response',
  };
};

/**
 * « Mes candidatures » (le JOUEUR, A12) — ce que J AI envoye, candidatures et
 * propositions de match confondues, range par ou ca en est : « En attente »,
 * puis « Reponses recues » (la plus recente en tete), puis « Retirees ».
 * Un groupe vide ne se titre pas.
 * @param {{ sentApplications?: any[], sentFriendlyApplications?: any[], now?: Date }} sources
 *   Les listes brutes ; `now` est injectable pour les temoins.
 * @returns {any[]} Les lignes, sections comprises.
 */
export const buildMyActivitiesSentResponses = ({
  now = new Date(),
  sentApplications = [],
  sentFriendlyApplications = [],
} = {}) => {
  const lines = [
    ...sentApplications.map((ad) => toSentLine(ad, 'recruitment', now)),
    ...sentFriendlyApplications.map((ad) => toSentLine(ad, 'amicaux', now)),
  ];

  /** @type {any[]} */
  const items = [];
  SENT_GROUPS.forEach(({ group, key }) => {
    const groupLines = lines.filter((line) => line.group === group);
    if (groupLines.length === 0) return;
    if (group === 'answered') groupLines.sort((a, b) => b.answeredAt - a.answeredAt);
    items.push({ key, title: sentGroupTitle(group, groupLines.length), type: 'section' });
    items.push(...groupLines);
  });

  return items;
};
