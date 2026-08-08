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
 * @param {any} ad L offre de recrutement.
 * @returns {string} Le titre affiche.
 */
export const buildRecruitmentAdTitle = (ad) => {
  const isCoachAd = String(ad?.audienceType || '').trim().toLowerCase() === 'coach';
  const role = isCoachAd
    ? (ad?.coachRoleOther || ad?.coachRole || 'Rôle entraîneur')
    : (ad?.position || 'Poste non spécifié');
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
  return {
    ad,
    countLabel: pluralize(count, 'candidature'),
    isOnline: Boolean(ad?.isActive),
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
    AWAY: 'Se déplace',
    BOTH: 'Reçoit ou se déplace',
    HOST: 'Reçoit',
  }[String(ad?.hostingPreference || '').toUpperCase()] || '';

  return {
    ad,
    countLabel: pluralize(count, 'proposition'),
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
    title: nameOf(ad?.team) || 'Match amical',
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
      title: `Recrutement · ${pluralize(recruitmentAds.length, 'offre')}`,
      type: 'section',
    });
    recruitmentAds.forEach((ad) => items.push(toRecruitmentPublication(ad)));
  }

  if (friendlyAds.length > 0) {
    items.push({
      key: 'section-amicaux',
      title: `Matchs amicaux · ${pluralize(friendlyAds.length, 'match proposé', 'matchs proposés')}`,
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
        title: joinMeta([applicant?.firstName, applicant?.lastName]).replace(' · ', ' ')
          || nameOf(applicant) || 'Candidat',
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
        meta: `sur ${nameOf(ad?.team) || 'ton match proposé'}`,
        title: `${nameOf(application?.team) || 'Une équipe'} propose un match`,
        type: 'response',
      });
    });
  });

  /** @type {any[]} */
  const items = [];
  if (candidatures.length > 0) {
    items.push({
      key: 'section-candidatures',
      title: `Candidatures reçues · ${candidatures.length}`,
      type: 'section',
    });
    items.push(...candidatures);
  }
  if (propositions.length > 0) {
    items.push({
      key: 'section-propositions',
      title: `Propositions reçues · ${propositions.length}`,
      type: 'section',
    });
    items.push(...propositions);
  }

  return items;
};

const SENT_STATUS_LABELS = {
  accepted: 'Acceptée',
  declined: 'Refusée',
  pending: 'En attente',
  rejected: 'Refusée',
  withdrawn: 'Retirée',
};

/**
 * Le meme onglet, cote joueur : « Mes reponses » — ce que J AI envoye.
 * @param {{ sentApplications?: any[], sentFriendlyApplications?: any[] }} sources Les listes brutes.
 * @returns {any[]} Les lignes, sections comprises.
 */
export const buildMyActivitiesSentResponses = ({
  sentApplications = [],
  sentFriendlyApplications = [],
} = {}) => {
  /** @type {any[]} */
  const items = [];

  if (sentApplications.length > 0) {
    items.push({
      key: 'section-mes-candidatures',
      title: `Candidatures envoyées · ${sentApplications.length}`,
      type: 'section',
    });
    sentApplications.forEach((ad) => {
      const status = String(ad?.applicationStatus || ad?.myApplication?.status || PENDING_STATUS)
        .toLowerCase();
      items.push({
        ad,
        isNew: false,
        key: `ma-candidature-${documentKey(ad)}`,
        market: 'recruitment',
        meta: joinMeta([nameOf(ad?.team?.club) || nameOf(ad?.team), SENT_STATUS_LABELS[status] || 'En attente']),
        title: buildRecruitmentAdTitle(ad),
        type: 'response',
      });
    });
  }

  if (sentFriendlyApplications.length > 0) {
    items.push({
      key: 'section-mes-propositions',
      title: `Propositions envoyées · ${sentFriendlyApplications.length}`,
      type: 'section',
    });
    sentFriendlyApplications.forEach((ad) => {
      const status = String(ad?.applicationStatus || PENDING_STATUS).toLowerCase();
      items.push({
        ad,
        isNew: false,
        key: `ma-proposition-${documentKey(ad)}`,
        market: 'amicaux',
        meta: SENT_STATUS_LABELS[status] || 'En attente',
        title: `${nameOf(ad?.team) || 'Match amical'}`,
        type: 'response',
      });
    });
  }

  return items;
};
