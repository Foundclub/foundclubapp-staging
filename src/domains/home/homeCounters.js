// D72 — LES COMPTEURS DE L'ACCUEIL (pack accueil, tache 4).
//
// ⚠️ L'ETAT DECRIT ICI LE 2026-08-11 (« l'endpoint n'existe pas ») EST PERIME.
// Corrige le 2026-08-12 par le lot D78, apres mesure : le lot serveur D76 a
// livre `GET /app/home-summary`, et l'accueil le lit desormais.
//
// 🔎 ETAT MESURE LE 2026-08-12 :
//   · `admin` : `src/api/app-home-summary/` — route, controleur, service ;
//   · `app`   : `src/services/home/homeSummaryService.js`, lu par `useHomeSummary`
//               et cable UNE SEULE FOIS, dans `HomeHub.js` (au focus de l'ecran).
//
// ⛔ CE QUI RESTE A 0, ET CE N'EST PAS UN OUBLI DE BRANCHEMENT : `reservations`.
//   Aucune table ne porte cette file — decision assumee de D76. Le pack l'autorise
//   explicitement : « une valeur a zero fait simplement disparaitre la pastille et
//   la ligne de bandeau. »
// ⚠️ `prochaineSeance.team` et `.opponent` arrivent en CHAINE VIDE : D76 a refuse
//   une jointure de plus par ouverture d'accueil. Le bandeau entraineur s'affiche
//   donc sans nom d'equipe ni adversaire tant qu'un lot ne les alimente pas.
//
// ⚠️ ECART AVEC LE PACK, A ARBITRER : la forme de reponse donnee par le pack
//    (tache 4) ne contient AUCUN des quatre compteurs du bandeau super admin
//    (signalements, revendications, a la une, clubs a onboarder) alors que la
//    capture 04 les affiche. Ils sont ajoutes ici sous `moderation`, a 0.

/**
 * @typedef {object} HomeCounters
 * @property {number} demandes
 * @property {number} invitationsEquipe
 * @property {{ amount: number, count: number }} impayes
 * @property {number} candidatures
 * @property {number} reservations
 * @property {number} propositionsMatch
 * @property {number} maCotisationDue
 * @property {number} mesReponses - MES candidatures qui attendent encore le club.
 * @property {number} mesReponsesNonVues - MES-CANDIDATURES (A13) : les reponses d'un club
 *   que je n'ai pas encore vues (notifications de reponse non lues, cote serveur).
 * @property {{ aLaUne: number, clubsAOnboarder: number, revendications: number,
 *   signalements: number }} moderation
 * @property {null | { id: string, label: string, rsvpEnabled?: boolean,
 *   startsAt: string }} prochainEvenement - `rsvpEnabled` (FINITIONS4) : « Les participants
 *   repondent ».
 * @property {null | { convoques: number, id: string, opponent: string, sansReponse: number,
 *   startsAt: string, team: string }} prochaineSeance
 */

/** @type {HomeCounters} */
export const EMPTY_HOME_COUNTERS = {
  candidatures: 0,
  demandes: 0,
  impayes: { amount: 0, count: 0 },
  invitationsEquipe: 0,
  maCotisationDue: 0,
  mesReponses: 0,
  mesReponsesNonVues: 0,
  moderation: {
    aLaUne: 0, clubsAOnboarder: 0, revendications: 0, signalements: 0,
  },
  prochaineSeance: null,
  prochainEvenement: null,
  propositionsMatch: 0,
  reservations: 0,
};

/**
 * Un entier positif, ou 0. Protege des `null`, `undefined` et chaines du serveur.
 * @param {any} value
 * @returns {number}
 */
const toCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

/**
 * Remet une reponse serveur dans la forme attendue, quoi qu'elle contienne.
 * Toute clef absente retombe a 0 : c'est ce qui rend le lot serveur INCREMENTAL
 * — il peut livrer les compteurs un par un sans casser l'ecran.
 * @param {any} payload - La reponse de `GET /app/home-summary`, ou null.
 * @returns {HomeCounters}
 */
export const normalizeHomeCounters = (payload) => {
  if (!payload || typeof payload !== 'object') return EMPTY_HOME_COUNTERS;
  const moderation = payload.moderation || {};
  return {
    candidatures: toCount(payload.candidatures),
    demandes: toCount(payload.demandes),
    impayes: {
      amount: toCount(payload.impayes?.amount),
      count: toCount(payload.impayes?.count),
    },
    invitationsEquipe: toCount(payload.invitationsEquipe),
    maCotisationDue: toCount(payload.maCotisationDue),
    mesReponses: toCount(payload.mesReponses),
    mesReponsesNonVues: toCount(payload.mesReponsesNonVues),
    moderation: {
      aLaUne: toCount(moderation.aLaUne),
      clubsAOnboarder: toCount(moderation.clubsAOnboarder),
      revendications: toCount(moderation.revendications),
      signalements: toCount(moderation.signalements),
    },
    prochaineSeance: payload.prochaineSeance || null,
    prochainEvenement: payload.prochainEvenement || null,
    propositionsMatch: toCount(payload.propositionsMatch),
    reservations: toCount(payload.reservations),
  };
};

// Les deux formats de date que le pack montre, et qu'aucun helper existant ne
// rend : `formatDateWithDayPrefix` (utils/date.js) sort « sam 15/08/2026 ».
//   · titre de la variante « evenement » : « Samedi 15 · 15:00 » (captures 02/03)
//   · valeur d'une ligne de liste        : « sam. 14:00 »        (capture 01)
const WEEKDAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const WEEKDAYS_SHORT_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/**
 * @param {any} value
 * @returns {Date | null}
 */
const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * @param {Date} date
 * @returns {string}
 */
const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * « Samedi 15 · 15:00 ». Chaine vide si la date est absente ou illisible.
 * @param {any} startsAt
 * @returns {string}
 */
export const formatBannerTitle = (startsAt) => {
  const date = toDate(startsAt);
  if (!date) return '';
  return `${WEEKDAYS_FR[date.getDay()]} ${date.getDate()} · ${hhmm(date)}`;
};

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Minuit, en heure locale, du jour d'une date.
 * @param {Date} date - La date.
 * @returns {number} - L'horodatage de ce minuit.
 */
const debutDuJour = (date) => (
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
);

/**
 * 📅 FINITIONS (recette émulateur du 2026-09-28) — SOUS QUEL JOUR RANGER UN ÉVÉNEMENT.
 *
 * 🧨 Le bandeau du dirigeant posait « Aujourd'hui » au-dessus du PROCHAIN événement,
 * quel que soit son jour : un match du mercredi s'y lisait « aujourd'hui » un lundi.
 * Ce n'était ni un fuseau ni une date comparée en texte — il n'y avait aucune règle.
 *
 * Les jours se comptent en jours de CALENDRIER, en heure locale (comme l'heure que le
 * bandeau affiche), jamais en tranches de 24 h : un match demain à 8 h est « demain »
 * même s'il reste moins de 24 h. La semaine va du lundi au dimanche, à la française.
 * @param {any} startsAt - Le début de l'événement.
 * @param {any} [now] - Maintenant (injectable pour les témoins).
 * @returns {'today' | 'tomorrow' | 'thisWeek' | 'later' | null} `null` si illisible.
 */
export const selectBannerDay = (startsAt, now = new Date()) => {
  const date = toDate(startsAt);
  const maintenant = toDate(now);
  if (!date || !maintenant) return null;
  // Math.round : un jour de changement d'heure dure 23 ou 25 heures.
  const ecart = Math.round((debutDuJour(date) - debutDuJour(maintenant)) / UN_JOUR_MS);
  // Commencé plus tôt et pas fini : il se passe aujourd'hui.
  if (ecart <= 0) return 'today';
  if (ecart === 1) return 'tomorrow';
  const joursJusquADimanche = 6 - ((maintenant.getDay() + 6) % 7);
  return ecart <= joursJusquADimanche ? 'thisWeek' : 'later';
};

/**
 * « sam. 14:00 ». Chaine vide si la date est absente ou illisible.
 * FINITIONS — avec `now`, un evenement au-dela de la semaine porte aussi sa date
 * (« lun. 05/10 18:00 ») : « lun. » seul ne dit plus QUEL lundi.
 * @param {any} startsAt
 * @param {any} [now] - Maintenant ; sans lui, le format court d'origine.
 * @returns {string}
 */
export const formatBannerShortTime = (startsAt, now) => {
  const date = toDate(startsAt);
  if (!date) return '';
  const jour = WEEKDAYS_SHORT_FR[date.getDay()];
  if (!now || selectBannerDay(date, now) !== 'later') return `${jour} ${hhmm(date)}`;
  const jj = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour} ${jj}/${mm} ${hhmm(date)}`;
};

// Correspondance carte → compteur, telle que le pack la donne (tache 4).
// ⛔ Les clefs ABSENTES de cette table ne portent JAMAIS de pastille : conteneurs
// (« Gerer mon club », « Mon abonnement », « FoundClub League »), actions de
// creation (« Ajouter un evenement », « Recruter »), reglages et section Compte.
// La table EST la regle : elle rend impossible de pastiller une carte interdite.
const ALERT_SOURCES = {
  'manage-licenses': (/** @type {HomeCounters} */ c) => c.impayes.count,
  'manage-my-ads': (/** @type {HomeCounters} */ c) => c.candidatures,
  // 🎟️ S10-C / D2 — LES INVITATIONS D EQUIPE ENTRENT DANS LA PASTILLE
  // « Demandes », parce que c est la carte qui ouvre l ecran ou elles se
  // trouvent. Les deux compteurs s ADDITIONNENT : le contrat S10-A (section 5)
  // livre `invitationsEquipe` comme un champ A PART, jamais fondu dans
  // `demandes`.
  // 🔒 CE QUI EMPECHE LA PASTILLE FANTOME : l app n applique AUCUN filtre a ce
  // nombre. Le serveur pose la meme question au compteur et a la liste
  // (`GET /event-team-audiences/mine`) — un temoin serveur compare les deux
  // requetes. Un tri ajoute ici les ferait diverger sur-le-champ (piege Q1).
  // ⚠️ Un champ absent vaut 0 : la pastille ne bouge donc pas d un pouce tant
  // que le serveur ne l envoie pas.
  'manage-requests': (/** @type {HomeCounters} */ c) => c.demandes + c.invitationsEquipe,
  'profile-license': (/** @type {HomeCounters} */ c) => c.maCotisationDue,
  'search-amicaux': (/** @type {HomeCounters} */ c) => c.propositionsMatch,
  // 🔴 MES-CANDIDATURES (audit V1, A13) : cette pastille suivait `mesReponses`, le
  // nombre de MES candidatures EN ATTENTE — elle ne s'eteignait donc qu'une fois le
  // club decide, jamais parce que J'AVAIS regarde. Or le rouge veut dire « a toi
  // d'agir ». Elle suit desormais les reponses NON VUES ; l'attente, elle, s'ecrit
  // en gris sous le titre de la case (`selectMyApplicationsStatus`).
  'search-my-activities': (/** @type {HomeCounters} */ c) => c.mesReponsesNonVues,
  'search-reservations': (/** @type {HomeCounters} */ c) => c.reservations,
};

/**
 * Les cartes qui portent une pastille, par clef de carte.
 * @param {HomeCounters} counters
 * @returns {Record<string, boolean>}
 */
export const selectHomeAlerts = (counters) => Object.entries(ALERT_SOURCES).reduce(
  (acc, [cardKey, read]) => ({ ...acc, [cardKey]: read(counters) > 0 }),
  /** @type {Record<string, boolean>} */ ({}),
);

/**
 * MES-CANDIDATURES (audit V1, A13) — ce que la case « Mes candidatures » ECRIT sous
 * son titre, en gris : d'abord les reponses non vues (« 1 nouvelle reponse »), puis
 * l'attente (« 1 en attente »). Un compteur a zero ne dit rien ; rien du tout, et la
 * case garde son sous-titre d'origine. Les mots restent a l'ecran (`t`).
 * @param {HomeCounters} counters
 * @returns {{ count: number, key: 'pending' | 'unseen' }[]}
 */
export const selectMyApplicationsStatus = (counters) => (
  /** @type {{ count: number, key: 'pending' | 'unseen' }[]} */ ([
    { count: counters.mesReponsesNonVues, key: 'unseen' },
    { count: counters.mesReponses, key: 'pending' },
  ]).filter((part) => part.count > 0)
);

/**
 * Total de la file de moderation — le chiffre de la pilule « A traiter ».
 * @param {HomeCounters} counters
 * @returns {number}
 */
export const selectModerationTotal = (counters) => {
  const { moderation } = counters;
  return moderation.aLaUne
    + moderation.clubsAOnboarder
    + moderation.revendications
    + moderation.signalements;
};

// Aucun bandeau ne depasse 4 lignes (pack, regles de contenu).
const MAX_BANNER_LINES = 4;

/**
 * Les lignes du bandeau, en DESCRIPTEURS : une clef, une valeur, un retard.
 * Les libelles, glyphes et destinations restent a l'ecran — ce module ne connait
 * ni `t` ni la navigation, c'est ce qui le rend testable seul.
 *
 * Une ligne dont le compteur vaut 0 DISPARAIT. Si toutes disparaissent, le
 * tableau est vide et le bandeau ne se rend pas du tout.
 * COLL-CONSOLE-BIS (03/10/2026), planche 12 — le SuperAdmin voit aussi deux lignes
 * « Collectivités », dans l'ordre de la maquette, après « À la une » : « Mairies à activer » et
 * « Demandes de gestionnaire ». Leurs nombres viennent des lectures de la console
 * (useAdminCollectivitesATraiter) ; le plafond de 4 lignes du pack reste.
 * @param {HomeCounters} counters
 * @param {string} roleKey - `president`, `coach`, `superAdmin`, ou autre (joueur).
 * @param {{ demandesGestionnaire?: number, mairiesAActiver?: number }} [collectivites] - Les
 *   nombres de la console des collectivités (SuperAdmin seul).
 * @returns {{ hasAlert: boolean, key: string, value: number }[]}
 */
export const selectBannerLines = (counters, roleKey, collectivites = {}) => {
  /** @type {{ hasAlert: boolean, key: string, value: number }[]} */
  let lines = [];

  if (roleKey === 'superAdmin') {
    const { moderation } = counters;
    lines = [
      { hasAlert: true, key: 'signalements', value: moderation.signalements },
      { hasAlert: true, key: 'revendications', value: moderation.revendications },
      { hasAlert: false, key: 'aLaUne', value: moderation.aLaUne },
      {
        hasAlert: true,
        key: 'mairiesAActiver',
        value: Number(collectivites?.mairiesAActiver) || 0,
      },
      {
        hasAlert: true,
        key: 'demandesGestionnaire',
        value: Number(collectivites?.demandesGestionnaire) || 0,
      },
      { hasAlert: false, key: 'clubsAOnboarder', value: moderation.clubsAOnboarder },
    ];
  } else if (roleKey === 'president') {
    lines = [
      { hasAlert: true, key: 'demandes', value: counters.demandes },
      // La ligne « prochain evenement » n'est pas un compteur : elle existe des
      // que l'evenement existe.
      { hasAlert: false, key: 'prochainEvenement', value: counters.prochainEvenement ? 1 : 0 },
      { hasAlert: true, key: 'impayes', value: counters.impayes.count },
    ];
  }

  return lines.filter((line) => line.value > 0).slice(0, MAX_BANNER_LINES);
};
