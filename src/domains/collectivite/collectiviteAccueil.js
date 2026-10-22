import { formatCollectiviteDay } from '@/domains/collectivite/collectiviteDisplay';

import { RouteNames } from '@/navigation/routeNames';

import { getPlanningItemWindow } from '@/utils/planning/planningSlots';

/**
 * 🏛️ COLL-ACCUEIL (01/10/2026, design validé HY521H1 v29) — ce que l'accueil de la Ville
 * calcule, en fonctions PURES : aucun appel réseau, aucun client HTTP importé
 * (mémoire piege-env-absent-worktree-import-service : n'importe quel écran ou le site les
 * importe sans doublure de test).
 *
 * L'accueil part de la FONCTION d'une collectivité (planche « Ce que fait une
 * collectivité », SPEC §2 A-H) : ce qui l'attend, ses actions, la vision de sa semaine
 * et de ses clubs (en NOMBRES, jamais une personne de club), ses actualités.
 */

/**
 * Les actions de l'accueil, dans l'ordre de la planche. Une action sans `route` n'est
 * PAS affichée : son écran n'existe pas encore. Le lot qui construit l'écran pose sa
 * route ici, et l'action apparaît, à sa place, sans autre changement.
 * ⛔ Ne jamais poser une route qui n'existe pas : un bouton qui ne mène nulle part est
 * pire qu'un bouton absent.
 * @type {ReadonlyArray<{ icon: string, key: string, lot: string, route: string | null }>}
 */
export const COLLECTIVITE_HOME_ACTIONS = Object.freeze([
  // Le cœur du produit : le créneau de saison (lots C2a serveur, C2b écran). COLL-ACCUEIL-BIS
  // (03/10) : la liste des installations, chacune ouvre ses créneaux ; avec une seule
  // installation, ses créneaux directement (`homeActionTarget`).
  {
    icon: 'calendar', key: 'assignSlot', lot: 'C2a + C2b', route: 'CollectiviteInstallations',
  },
  // Les actualités de la Ville (lot C4a, 02/10 : le formulaire « Nouvelle actualité »).
  {
    icon: 'send', key: 'publishNews', lot: 'C4a', route: 'CollectiviteActualiteForm',
  },
  // Fermer une installation, bloquer un créneau (lot C4b, 02/10 : le formulaire de la fermeture).
  {
    icon: 'close',
    key: 'closeInstallation',
    lot: 'C4b',
    params: { mode: 'fermer' },
    route: 'CollectiviteFermeture',
  },
  {
    icon: 'flag',
    key: 'blockSlot',
    lot: 'C4b',
    params: { mode: 'bloquer' },
    route: 'CollectiviteFermeture',
  },
  // Inviter un club absent de FoundClub (lot C-CLUBS : le lien de la Ville, « Par FoundClub »).
  {
    icon: 'users', key: 'inviteClub', lot: 'C-CLUBS', route: 'CollectiviteInviteClub',
  },
  // Existe depuis COLL1C : le formulaire d'installation de la collectivité.
  {
    icon: 'stadium', key: 'addInstallation', lot: 'COLL1C', route: 'CollectiviteInstallationForm',
  },
  // R17-EVT-1 (20/10, REC17-005, planche P11-evenement-ou-ca-vit) : « Ajouter un événement »,
  // en 7e.
  {
    icon: 'plus', key: 'addEvent', lot: 'R17-EVT-1', route: 'CollectiviteEvenement',
  },
]);

/**
 * Les actions dont l'écran existe.
 * @param {ReadonlyArray<{ route: string | null }>} [actions] - Le registre.
 * @returns {Array<any>} Les actions affichables.
 */
export const availableHomeActions = (actions = COLLECTIVITE_HOME_ACTIONS) => (
  actions.filter((action) => Boolean(action.route))
);

/**
 * COLL-ACCUEIL-BIS (03/10) — où mène une action. « Attribuer un créneau » se fait dans
 * l'onglet « Créneaux » d'UNE installation (C2b) : avec une seule installation, on y va tout
 * droit ; sinon, la liste des installations, où chacune ouvre ses créneaux.
 * @param {{ params?: Record<string, any>, route: string | null }} action - Une action affichable.
 * @param {unknown} installations - Les installations de la Ville (documentId).
 * @returns {{ params: Record<string, any>, route: string }} L'écran et ses paramètres.
 */
export const homeActionTarget = (action, installations) => {
  const liste = (Array.isArray(installations) ? installations : [])
    .filter((installation) => installation?.documentId);
  if (/** @type {any} */ (action)?.key === 'assignSlot' && liste.length === 1) {
    return {
      params: { facilityId: liste[0].documentId },
      route: RouteNames.CollectiviteInstallation,
    };
  }
  return { params: action?.params || {}, route: String(action?.route) };
};

const horodatage = (/** @type {unknown} */ valeur) => {
  const date = typeof valeur === 'string' || valeur instanceof Date ? new Date(valeur) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.POSITIVE_INFINITY;
};

/**
 * La demande qui attend depuis le plus longtemps : c'est elle que l'accueil montre en tête.
 * @param {unknown} demandes - Les demandes EN ATTENTE (`/collectivites/:id/requests`).
 * @returns {any | null} La plus ancienne, ou null.
 */
export const oldestPendingRequest = (demandes) => {
  if (!Array.isArray(demandes) || demandes.length === 0) return null;
  return [...demandes].sort((a, b) => horodatage(a?.createdAt) - horodatage(b?.createdAt))[0];
};

/**
 * Le conflit d'une demande, mis en nombres pour la carte « Ce qui vous attend » :
 * places prises, capacité, et ce que l'acceptation donnerait.
 * @param {any} conflit - `conflict` d'une demande en attente (describeConflict, lot 1c).
 * @returns {{ full: boolean, maxSlots: number, remaining: number, taken: number,
 *   teamsIfAccepted: number } | null} Le résumé, ou null s'il est illisible.
 */
export const summarizeConflict = (conflit) => {
  const maxSlots = Number(conflit?.maxSlots);
  const remaining = Number(conflit?.remaining);
  if (!Number.isInteger(maxSlots) || maxSlots < 1 || !Number.isFinite(remaining)) return null;
  const libres = Math.max(0, Math.min(maxSlots, remaining));
  const taken = maxSlots - libres;
  return {
    full: libres === 0,
    maxSlots,
    remaining: libres,
    taken,
    // Accepter ajoute une équipe aux occupants du moment.
    teamsIfAccepted: Math.max(taken, maxSlots - remaining) + 1,
  };
};

/**
 * Les clubs rattachés en NOMBRES (SPEC §2 G, H) : clubs, équipes, membres. Un compteur de
 * membres illisible rend `members: null` (l'écran écrit « — », jamais un 0 inventé).
 * @param {unknown} clubs - `/collectivites/:id/clubs`.
 * @returns {{ clubs: number, members: number | null, teams: number }} Les totaux.
 */
export const clubTotals = (clubs) => {
  const liste = Array.isArray(clubs) ? clubs : [];
  let members = /** @type {number | null} */ (0);
  let teams = 0;
  liste.forEach((club) => {
    teams += Number.isInteger(club?.teamsCount) ? club.teamsCount : 0;
    if (members !== null) {
      members = Number.isInteger(club?.membersCount) ? members + club.membersCount : null;
    }
  });
  return { clubs: liste.length, members, teams };
};

/**
 * Les initiales d'un club pour son écusson : « AS Montrivage » ⇒ « AM ».
 * @param {unknown} nom - Le nom du club.
 * @returns {string} Une ou deux lettres majuscules, ou « ? ».
 */
export const clubInitials = (nom) => {
  const mots = String(nom || '').trim().split(/[\s\-']+/u).filter((mot) => /\p{L}/u.test(mot));
  if (mots.length === 0) return '?';
  const premiere = (/** @type {string} */ mot) => (mot.match(/\p{L}/u) || [''])[0].toUpperCase();
  if (mots.length === 1) return premiere(mots[0]);
  return `${premiere(mots[0])}${premiere(mots[mots.length - 1])}`;
};

/**
 * Le premier moment de la semaine où l'installation est PLEINE (autant d'équipes que de
 * places), d'après les blocs de son planning. Même règle de recouvrement que
 * `getPlanningPeakOccupancy` (une fin libère avant qu'un début n'occupe).
 * @param {unknown} blocs - `data` de `/facilities/:id/planning`.
 * @param {unknown} maxSlots - La capacité de l'installation.
 * @returns {Date | null} Le début du premier moment complet, ou null.
 */
export const firstFullMoment = (blocs, maxSlots) => {
  const capacite = Number(maxSlots);
  if (!Array.isArray(blocs) || !Number.isInteger(capacite) || capacite < 1) return null;
  /** @type {Array<{ delta: number, time: number }>} */
  const reperes = [];
  blocs.forEach((bloc) => {
    const fenetre = getPlanningItemWindow(bloc);
    if (!fenetre?.startAt || !fenetre?.endAt) return;
    reperes.push({ delta: 1, time: fenetre.startAt.getTime() });
    reperes.push({ delta: -1, time: fenetre.endAt.getTime() });
  });
  reperes.sort((a, b) => (a.time === b.time ? a.delta - b.delta : a.time - b.time));
  let courant = 0;
  const premier = reperes.find((repere) => {
    courant += repere.delta;
    return repere.delta > 0 && courant >= capacite;
  });
  return premier ? new Date(premier.time) : null;
};

/**
 * Le moment complet, en mots courts : « jeu. 18:00 » (même jour abrégé que formatSlot ;
 * FINITIONS15 point 8 : planche P3v2-accueil, « complet jeu. 18:00 »).
 * @param {Date | null} date - Le moment.
 * @returns {string} Le libellé, ou '' si la date est illisible.
 */
export const formatWeekMoment = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const [jour] = formatCollectiviteDay(date).split(' ');
  const deux = (/** @type {number} */ valeur) => String(valeur).padStart(2, '0');
  return `${jour} ${deux(date.getHours())}:${deux(date.getMinutes())}`;
};

/**
 * D69 (décision d'Adel « conflit A », 01/10) — la demande vient-elle du club de CE compte ?
 * Un gestionnaire qui dirige aussi un club tranche les demandes de son propre club ; la carte
 * le dit (« Demande de votre club »).
 * @param {any} demande - Une demande (son club : club.documentId).
 * @param {any} userData - Le compte connecté (club, clubs).
 * @returns {boolean} Vrai si le club demandeur est l'un des clubs du compte.
 */
export const isOwnClubRequest = (demande, userData) => {
  const clubDemandeur = demande?.club?.documentId;
  if (!clubDemandeur) return false;
  const siens = [userData?.club, ...(Array.isArray(userData?.clubs) ? userData.clubs : [])]
    .map((club) => club?.documentId)
    .filter(Boolean);
  return siens.includes(clubDemandeur);
};

/**
 * Un compte « Ville seule » : il gère (ou demande à gérer) une collectivité et n'a AUCUN
 * rôle sportif (rôle « Authenticated », clef `new`). Lui arrive sur l'espace de la Ville ;
 * un compte mixte (dirigeant, joueur, entraîneur, parent qui gère aussi une Ville) garde
 * son accueil (décision d'Adel « accueil A », 01/10).
 * @param {{ roleKey: string, managedCount: number, hasManagerRequest: boolean }} compte
 * @returns {boolean} Vrai pour un compte Ville seule.
 */
export const isVilleOnlyAccount = ({ hasManagerRequest, managedCount, roleKey }) => (
  roleKey === 'new' && (managedCount > 0 || hasManagerRequest === true)
);

/**
 * FINITIONS16 · POINT 11 (T15) — un compte sans rôle sportif (clef `new`) qui ne gère ni ne
 * demande à gérer de Ville CHOISIT SON STATUT : c'est la première étape de son tunnel. Le
 * téléphone l'y mène (PrivateNavigator) ; l'accueil du site, qui ne renvoyait qu'aux étapes
 * d'âge, le laissait sur l'accueil « Joueur » après « Changer de compte ». Un compte « Ville
 * seule » ne l'est jamais ; un compte qui a déjà un rôle non plus.
 * @param {{ roleKey: string, managedCount: number, hasManagerRequest: boolean }} compte
 * @returns {boolean} Vrai quand le compte doit d'abord choisir son statut.
 */
export const doitChoisirSonStatut = ({ hasManagerRequest, managedCount, roleKey }) => (
  roleKey === 'new' && !isVilleOnlyAccount({ hasManagerRequest, managedCount, roleKey })
);

/**
 * Les quatre onglets de l'espace de la Ville, dans l'ordre de la planche (« Accueil ·
 * Demandes · Planning · Messages », décision d'Adel du 01/10 : la messagerie reste, les
 * clubs et les installations passent par l'accueil). Chaque onglet monte un écran qui
 * EXISTE déjà : l'accueil (COLL-ACCUEIL), « Demandes de la Ville » et les installations
 * (lot 1c, chacune ouvre son planning), la messagerie.
 *
 * ponytail: « Planning » ouvre la liste des installations (chaque carte ouvre SON
 * planning). La vue de toutes les installations d'un coup d'œil est au lot C2b : elle
 * remplacera l'écran de cet onglet, sans changer la barre.
 * @param {{ Images: Record<string, any>, pendingCount: number,
 *   t: (cle: string, repli: string, options?: object) => string, unreadCount: number }} args
 * @returns {Array<{ a11y: string, badge: number, icon: any, label: string, name: string }>}
 *   Les onglets.
 */
export const collectiviteTabs = ({
  Images, pendingCount, t, unreadCount,
}) => {
  const demandes = t('collectiviteAccueil.dock.demandes', 'Demandes');
  return [
    {
      a11y: t('collectiviteAccueil.dock.accueil', 'Accueil'),
      badge: 0,
      icon: Images.home,
      label: t('collectiviteAccueil.dock.accueil', 'Accueil'),
      name: RouteNames.CollectiviteHome,
    },
    {
      a11y: pendingCount > 0
        ? t('collectiviteAccueil.dock.demandesA11y', 'Demandes, {{nombre}} en attente', {
          nombre: pendingCount,
        })
        : demandes,
      badge: pendingCount,
      // ICONES (01/10, « Icone ok ») : l'icône dessinée pour l'onglet « Demandes ».
      icon: Images.inboxArrowDown,
      label: demandes,
      name: RouteNames.CollectiviteRequests,
    },
    {
      a11y: t('collectiviteAccueil.dock.planning', 'Planning'),
      badge: 0,
      icon: Images.calendar,
      label: t('collectiviteAccueil.dock.planning', 'Planning'),
      name: RouteNames.CollectiviteInstallations,
    },
    {
      a11y: t('collectiviteAccueil.dock.messages', 'Messages'),
      badge: unreadCount,
      icon: Images.envelope,
      label: t('collectiviteAccueil.dock.messages', 'Messages'),
      name: RouteNames.Chat,
    },
  ];
};

// ─── L'INSCRIPTION « JE REPRÉSENTE UNE COLLECTIVITÉ » (planche P1-inscription) ─────────────

// Même règle que le serveur (collectivite-manager-request, EMAIL_PATTERN) : la vérification
// réelle est HUMAINE (l'équipe appelle la mairie).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Les fautes du formulaire « Vous » : une clef par champ fautif (chacune a son message sous
 * son champ). Vide = prêt à partir. Le serveur reste le juge (400).
 * @param {{ firstname?: string, jobTitle?: string, lastname?: string,
 *   professionalEmail?: string }} champs - Les champs saisis.
 * @returns {Record<string, 'required' | 'email'>} Les fautes.
 */
export const signupContactErrors = (champs) => {
  const lire = (/** @type {unknown} */ valeur) => String(valeur || '').trim();
  /** @type {Record<string, 'required' | 'email'>} */
  const fautes = {};
  if (!lire(champs?.firstname)) fautes.firstname = 'required';
  if (!lire(champs?.lastname)) fautes.lastname = 'required';
  if (lire(champs?.jobTitle).length < 2) fautes.jobTitle = 'required';
  const email = lire(champs?.professionalEmail);
  if (!email) fautes.professionalEmail = 'required';
  else if (!EMAIL_PATTERN.test(email)) fautes.professionalEmail = 'email';
  return fautes;
};

/**
 * Le corps de la demande : une collectivité EXISTANTE (son identifiant) ou « à créer » (son
 * nom tel que saisi et son type ; l'équipe pose le nom officiel, D59, en acceptant).
 * @param {{ codeInsee?: string | null, documentId?: string | null, name: string,
 *   type: string }} collectivite - Le choix.
 * @param {{ jobTitle?: string, professionalEmail?: string }} contact - « Vous ».
 * @returns {Record<string, string>} Le corps.
 */
export const managerRequestPayload = (collectivite, contact) => ({
  ...(collectivite?.documentId
    ? { collectiviteDocumentId: collectivite.documentId }
    : {
      // COLL-CONSOLE-BIS (03/10) — une commune trouvee dans le referentiel porte son code INSEE :
      // la console n aura pas a le chercher pour ouvrir son espace.
      ...(collectivite?.codeInsee ? { codeInsee: String(collectivite.codeInsee) } : {}),
      collectiviteName: String(collectivite?.name || '').trim(),
      collectiviteType: String(collectivite?.type || ''),
    }),
  jobTitle: String(contact?.jobTitle || '').trim(),
  professionalEmail: String(contact?.professionalEmail || '').trim().toLowerCase(),
});

/**
 * La demande la plus récente (le serveur les rend déjà dans cet ordre ; on ne s'y fie pas).
 * @param {unknown} demandes - `/collectivite-manager-requests/mine`.
 * @returns {any | null} La plus récente, ou null.
 */
export const latestManagerRequest = (demandes) => {
  if (!Array.isArray(demandes) || demandes.length === 0) return null;
  return [...demandes].sort((a, b) => horodatage(b?.createdAt) - horodatage(a?.createdAt))[0];
};

/**
 * VINSC2 (07/10/2026, tournée T18) — mes demandes EN ATTENTE, la plus récente d'abord. Aucune ne
 * doit disparaître derrière un autre état de l'écran (un espace déjà ouvert, un refus).
 * @param {unknown} demandes - `/collectivite-manager-requests/mine`.
 * @returns {any[]} Les demandes en attente.
 */
export const pendingManagerRequests = (demandes) => (Array.isArray(demandes) ? demandes : [])
  .filter((demande) => demande?.status === 'pending')
  .sort((a, b) => horodatage(b?.createdAt) - horodatage(a?.createdAt));

// VINSC2 — au-delà, un refus ne se montre plus à côté d'un espace déjà ouvert.
const REFUS_RECENT_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * VINSC2 (07/10/2026) — ma demande la plus récente, si c'est un refus de moins de 30 jours : un
 * gestionnaire qui demandait une AUTRE collectivité doit lire ce refus à côté de son espace.
 * @param {unknown} demandes - `/collectivite-manager-requests/mine`.
 * @param {number} [maintenant] - L'instant de référence (ms).
 * @returns {any | null} Le refus récent, ou null.
 */
export const recentRefusedManagerRequest = (demandes, maintenant = Date.now()) => {
  const derniere = latestManagerRequest(demandes);
  if (derniere?.status !== 'refused') return null;
  const decidee = horodatage(derniere?.decidedAt);
  return Number.isFinite(decidee) && maintenant - decidee <= REFUS_RECENT_MS ? derniere : null;
};

// ─── LES PREMIERS PAS D'UNE VILLE TOUTE NEUVE (planche P1v3-premiers-pas) ─────────────────

/**
 * FINITIONS18 · POINT 10 (T16) — LA cle de ce que l'accueil de la Ville retient sur l'appareil,
 * pour CE compte et CETTE Ville (mot d'accueil lu, liste des clubs ouverte, guide masque). Une
 * seule fabrique : l'accueil la lit, l'ecran des clubs l'ecrit (« Verifiez vos clubs »).
 * @param {string} nom - Ce qui est retenu (« clubs-vus », « bienvenue-vue », « guide-masque »).
 * @param {string | null | undefined} userDocumentId - Le compte.
 * @param {string | null | undefined} collectiviteId - La Ville.
 * @returns {string} La cle de stockage.
 */
export const clePremierPas = (nom, userDocumentId, collectiviteId) => (
  `coll-accueil:${nom}:${userDocumentId || 'anonyme'}:${collectiviteId || ''}`
);

/**
 * Les étapes des premiers pas, dans l'ordre où elles se débloquent. Une étape sans écran
 * (`route: null`) est MASQUÉE. « Présentez-vous aux clubs » mène, depuis le lot C4a (02/10), au
 * formulaire « Nouvelle actualité » ; « Attribuez les créneaux de la saison », depuis
 * COLL-ACCUEIL-BIS (03/10), aux installations (C2b : chacune ouvre ses créneaux).
 * @type {ReadonlyArray<{ key: string, lot: string, route: string | null }>}
 */
export const PREMIERS_PAS = Object.freeze([
  { key: 'installations', lot: 'COLL1C', route: 'CollectiviteInstallationForm' },
  { key: 'clubs', lot: 'COLL1C', route: 'CollectiviteClubs' },
  { key: 'creneaux', lot: 'C2a + C2b', route: 'CollectiviteInstallations' },
  { key: 'actualite', lot: 'C4a', route: 'CollectiviteActualiteForm' },
]);

/**
 * COLL-ACCUEIL-BIS (03/10) — les créneaux de saison que l'accueil VOIT dans le planning de la
 * semaine qu'il lit déjà (contrat C2A §7 : chaque bloc venu d'un créneau porte `slot`). Un
 * créneau revient chaque semaine : il est compté UNE fois. Aucune lecture en plus.
 * ponytail: un créneau qui ne tombe pas dans la semaine (saison pas commencée) n'est pas vu ;
 * voie de sortie : un compteur des créneaux actifs dans `/collectivites/:id`.
 * @param {unknown} semaine - `useCollectiviteWeek` : [{ installation, query }].
 * @returns {number} Le nombre de créneaux distincts vus.
 */
export const seasonSlotsSeen = (semaine) => {
  const vus = new Set();
  (Array.isArray(semaine) ? semaine : []).forEach((ligne) => {
    const blocs = Array.isArray(ligne?.query?.data?.data) ? ligne.query.data.data : [];
    blocs.forEach((/** @type {any} */ bloc) => {
      if (bloc?.slot?.documentId) vus.add(bloc.slot.documentId);
    });
  });
  return vus.size;
};

/**
 * Où en sont les premiers pas. Les étapes se cochent d'elles-mêmes : des installations
 * existent ; la liste des clubs rattachés a été ouverte ; un créneau de saison est attribué
 * (COLL-ACCUEIL-BIS) ; une actualité est en ligne (C4a). UNE seule étape porte un bouton à la
 * fois (la première qui n'est pas faite) : on ne se demande jamais par où commencer. Les
 * créneaux ATTENDENT les installations (planche : « Après l'étape 1 », grisée).
 * @param {{ actualitesCount?: number, clubsVus: boolean, creneauxCount?: number,
 *   installationsCount: number }} etat - Ce qui est lu et retenu.
 * @param {ReadonlyArray<{ key: string, route: string | null }>} [etapes] - Le registre.
 * @returns {{ etapes: Array<{ attend: boolean, fait: boolean, key: string, route: string,
 *   suivante: boolean }>, faits: number, total: number, tousFaits: boolean }} L'état du guide.
 */
export const premiersPas = (
  {
    actualitesCount = 0, clubsVus, creneauxCount = 0, installationsCount,
  },
  etapes = PREMIERS_PAS,
) => {
  const faitPour = {
    actualite: Number(actualitesCount) > 0,
    clubs: clubsVus === true,
    creneaux: Number(creneauxCount) > 0,
    installations: Number(installationsCount) > 0,
  };
  const visibles = etapes.filter((etape) => Boolean(etape.route));
  const estFaite = (/** @type {string} */ cle) => Boolean(faitPour[/** @type {'clubs'} */ (cle)]);
  const indexSuivante = visibles.findIndex((etape) => !estFaite(etape.key));
  const liste = visibles.map((etape, index) => ({
    attend: etape.key === 'creneaux' && !faitPour.installations,
    fait: Boolean(faitPour[/** @type {'clubs'} */ (etape.key)]),
    key: etape.key,
    route: String(etape.route),
    suivante: index === indexSuivante,
  }));
  const faits = liste.filter((etape) => etape.fait).length;
  return {
    etapes: liste, faits, total: liste.length, tousFaits: faits === liste.length,
  };
};
