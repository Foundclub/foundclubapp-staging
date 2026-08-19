import { sanitizeUser } from '@/domains/auth/authSanitizer';
import { storage } from '@/store/appContext';
import {
  dispatchAuthRuntimeAction,
  getAuthRuntimeSnapshot,
} from '@/store/authRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { isBirthdateUnderParentalAge } from '@/constants/parentalDeclaration';
import { positionsBelongToSport, sportHasPositions } from '@/constants/positions';

export const USER_ROLES = /** @type {const} */({
  coach: 'Entraineur',
  new: 'Authenticated',
  player: 'Joueur',
  president: 'Dirigeant',
  superAdmin: 'SuperAdmin',
});

const normalizeRoleName = (roleName) => String(roleName || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const getUserRoleKey = (roleName) => {
  const normalized = normalizeRoleName(roleName);

  if (!normalized || normalized === 'authenticated') return 'new';
  if (normalized.includes('super')) return 'superAdmin';
  if (
    normalized.includes('dirigeant')
    || normalized.includes('president')
    || normalized.includes('clubadmin')
  ) {
    return 'president';
  }
  if (normalized.includes('entra') || normalized.includes('coach')) return 'coach';
  if (normalized.includes('joueur') || normalized === 'player') return 'player';
  return 'new';
};

export const getManagedMultisportSectionIds = (/** @type {any} */ userData) => new Set(
  (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
    .flatMap((multisportClub) => (
      Array.isArray(multisportClub?.sections) ? multisportClub.sections : []
    ))
    .map((section) => String(section?.documentId || '').trim())
    .filter(Boolean),
);

export const getManagedMultisportIds = (/** @type {any} */ userData) => new Set(
  (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
    .map((multisportClub) => String(multisportClub?.documentId || multisportClub?.id || '').trim())
    .filter(Boolean),
);

export const getActiveClubId = (/** @type {any} */ userData) => (
  String(
    userData?.club?.documentId
    || userData?.club?.id
    || userData?.clubs?.[0]?.documentId
    || userData?.clubs?.[0]?.id
    || userData?.clubAffiliations?.[0]?.club?.documentId
    || userData?.clubAffiliations?.[0]?.club?.id
    || '',
  ).trim() || null
);

/**
 * MON CLUB, Y COMPRIS QUAND L'ADHÉSION N'EST ENCORE QU'UNE DEMANDE — V02.
 *
 * `getActiveClubId` ci-dessus répond « quel club m'a déjà accepté ». Ça ne
 * suffit pas au tout début : un entraîneur qui vient de CRÉER son club n'est
 * pas encore affilié, son rattachement est une `club-membership-request` à
 * l'état `pending` (voir `ClubWizardRecap`, qui enchaîne dessus). Pendant ce
 * laps de temps, l'app doit quand même savoir de quel club on parle.
 *
 * Deux écrans voisins ne répondaient PAS la même chose à cette question :
 * `UserTrainedTeams` lisait trois sources, `TeamWizardName` une seule — donc le
 * même entraîneur voyait les équipes de son club sur un écran, et « il te faut
 * d'abord un club » sur l'écran suivant (constat d'Adel du 2026-08-18). La
 * réponse vit ici, une fois, pour les deux.
 *
 * ⚠️ Une demande `pending` est un rattachement PRÉSUMÉ, pas un droit : cette
 * fonction sert à AFFICHER et à AIGUILLER, jamais à autoriser. Pour les droits,
 * `hasClubAccess` / `isClubMember` restent les seuls juges.
 * @param {any} userData - Le profil, tel que `sanitizeUser` le rend.
 * @returns {string | null} L'identifiant du club, ou `null`.
 */
export const resolveMyClubDocumentId = (/** @type {any} */ userData) => (
  getActiveClubId(userData)
  || String(
    (Array.isArray(userData?.clubMembershipRequests) ? userData.clubMembershipRequests : [])
      .find((/** @type {any} */ request) => request?.state === 'pending')?.club?.documentId
      || '',
  ).trim()
  || null
);

/**
 * LES CLUBS DE RATTACHEMENT ADMINISTRATIF — a ne pas confondre avec
 * `getMemberClubIds` ci-dessous, et la confusion coute cher.
 *
 * ⛔ C3 (2026-08-13) : ne PAS y ajouter `myTeams[].club`. Trois de ses lecteurs
 * demandent de l'AUTORITE, pas de l'appartenance, et deux cassent dans des sens
 * opposes :
 *   · `canUserEditClub` (l.121) et `ClubDetails.js:1329/1334/1342` — un dirigeant
 *     qui joue dans l'equipe d'un autre club pourrait EDITER ce club ;
 *   · `useAuth.js:761` `canSendMessageToUser` — des que deux comptes
 *     « partagent un club », la fonction renvoie `role === president` et ne
 *     teste plus jamais les equipes communes. En production `user.club` est vide
 *     pour les joueurs (ils entrent par l'equipe, `team-membership-request.accept`
 *     n'ecrit jamais `user.club`) : l'elargir ferait perdre a deux joueurs de la
 *     MEME equipe le droit de s'ecrire.
 * Pour « ce club fait-il partie des miens ? », utiliser `isClubMember`.
 * @param {any} userData - Le profil, tel que `sanitizeUser` le rend.
 * @returns {string[]} Les identifiants des clubs de rattachement.
 */
export const getClubIds = (/** @type {any} */ userData) => {
  const clubIds = new Set();
  const addId = (value) => {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue) {
      clubIds.add(normalizedValue);
    }
  };

  addId(userData?.club?.documentId || userData?.club?.id);
  (Array.isArray(userData?.clubs) ? userData.clubs : []).forEach((club) => {
    addId(club?.documentId || club?.id);
  });
  (Array.isArray(userData?.clubAffiliations) ? userData.clubAffiliations : []).forEach((affiliation) => {
    addId(affiliation?.club?.documentId || affiliation?.club?.id);
  });

  return [...clubIds];
};

export const hasClubAccess = (/** @type {any} */ userData, /** @type {string} */ clubId) => {
  const normalizedClubId = String(clubId || '').trim();
  if (!normalizedClubId) return false;

  if (getClubIds(userData).includes(normalizedClubId)) {
    return true;
  }

  return getManagedMultisportSectionIds(userData).has(normalizedClubId);
};

/**
 * LES CLUBS D'UN UTILISATEUR, EQUIPES COMPRISES — la reponse a la question
 * d'Adel du 2026-08-13 : « est-ce que ca marche d'avoir deux equipes dans
 * 2 clubs differents ? »
 *
 * Le modele dit oui (`team.players` est `manyToMany`), le serveur dit oui
 * (`accept` fait `connect`, jamais `set`), et il envoie deja le club de chaque
 * equipe (`myTeams.club` est dans les trois `populate` de
 * `firebase-auth/constants.ts`, et `authSanitizer.js:122` le conserve). Seule
 * l'app ne regardait pas : le 2e club existait en base sans jamais s'afficher.
 *
 * La verite se DEDUIT donc des equipes — aucune ecriture en base, rien a
 * migrer, et surtout rien qui depende de `club_affiliations`, table mesuree
 * VIDE en production le 2026-08-13 (elle existe au schema, l'app la lit, et
 * `team-membership-request.accept` n'en cree aucune).
 * @param {any} userData - Le profil, tel que `sanitizeUser` le rend.
 * @returns {string[]} Le rattachement administratif PLUS les clubs des equipes.
 */
export const getMemberClubIds = (/** @type {any} */ userData) => {
  const clubIds = new Set(getClubIds(userData));

  [
    ...(Array.isArray(userData?.myTeams) ? userData.myTeams : []),
    ...(Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    ...(Array.isArray(userData?.teams) ? userData.teams : []),
  ].forEach((team) => {
    const teamClubId = String(team?.club?.documentId || team?.club?.id || '').trim();
    if (teamClubId) {
      clubIds.add(teamClubId);
    }
  });

  return [...clubIds];
};

/**
 * CE CLUB FAIT-IL PARTIE DES MIENS ? — la question d'APPARTENANCE, celle qui
 * n'accorde aucun droit.
 *
 * Elle repond vrai partout ou `hasClubAccess` repond vrai : le lot C3 ne peut
 * donc retirer un club a personne, c'est vrai par construction et non par
 * relecture. Ce qu'elle ajoute, ce sont les clubs atteints par une equipe.
 * @param {any} userData - Le profil, tel que `sanitizeUser` le rend.
 * @param {string} clubId - Le club regarde.
 * @returns {boolean} Vrai si l'utilisateur appartient a ce club.
 */
export const isClubMember = (/** @type {any} */ userData, /** @type {string} */ clubId) => {
  const normalizedClubId = String(clubId || '').trim();
  if (!normalizedClubId) return false;

  if (hasClubAccess(userData, normalizedClubId)) return true;

  return getMemberClubIds(userData).includes(normalizedClubId);
};

export const canUserEditClub = (/** @type {any} */ userData, /** @type {string} */ clubId) => {
  const normalizedClubId = String(clubId || '').trim();
  if (!normalizedClubId || getUserRoleKey(userData?.role?.name) !== 'president') {
    return false;
  }

  return hasClubAccess(userData, normalizedClubId);
};

export const findRoleByKey = (roles, roleNameOrKey) => {
  const expectedRoleKey = getUserRoleKey(roleNameOrKey);
  return roles?.find((role) => getUserRoleKey(role?.type || role?.name) === expectedRoleKey);
};

export const getRoleDocumentIdByKey = (roles, roleNameOrKey) => (
  findRoleByKey(roles, roleNameOrKey)?.documentId || ''
);

export const getAuthTokens = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    if (runtimeSnapshot.isAddingAccount) {
      return null;
    }
    return runtimeSnapshot.auth || null;
  }

  const storageAuthRaw = storage.getString('auth');
  let auth = null;
  try {
    auth = storageAuthRaw ? JSON.parse(storageAuthRaw) : null;
  } catch (e) {
    auth = null;
  }
  return auth;
};

const normalizeDocumentId = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getSessionDocumentId = (session) => normalizeDocumentId(session?.user?.documentId);

const orderSessionsByActive = (sessions, activeSessionDocumentId) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const normalizedActiveDocumentId = normalizeDocumentId(activeSessionDocumentId);
  if (!normalizedActiveDocumentId) {
    return [...safeSessions];
  }

  const matchingSession = safeSessions.find(
    (session) => getSessionDocumentId(session) === normalizedActiveDocumentId,
  );

  if (!matchingSession) {
    return [...safeSessions];
  }

  return [
    matchingSession,
    ...safeSessions.filter((session) => getSessionDocumentId(session) !== normalizedActiveDocumentId),
  ];
};

const safeJsonParse = (rawValue, fallbackValue) => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch (_error) {
    return fallbackValue;
  }
};

export const getStoredAuthSessions = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    return Array.isArray(runtimeSnapshot.authSessions) ? runtimeSnapshot.authSessions : [];
  }

  const storedAuth = safeJsonParse(storage.getString('auth'), null);
  const storedSessions = safeJsonParse(storage.getString('authSessions'), []);
  const orderedSessions = Array.isArray(storedSessions) ? [...storedSessions] : [];
  const storedAuthDocumentId = getSessionDocumentId(storedAuth);

  if (
    storedAuthDocumentId
    && !orderedSessions.some((session) => getSessionDocumentId(session) === storedAuthDocumentId)
  ) {
    orderedSessions.push(storedAuth);
  }

  return orderedSessions.filter(Boolean);
};

export const findAuthSessionByDocumentId = (documentId) => {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!normalizedDocumentId) return null;

  return getStoredAuthSessions().find(
    (session) => getSessionDocumentId(session) === normalizedDocumentId,
  ) || null;
};

export const getActiveSessionDocumentId = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    return normalizeDocumentId(runtimeSnapshot.activeSessionDocumentId)
      || getSessionDocumentId(runtimeSnapshot.auth);
  }

  return normalizeDocumentId(storage.getString('activeSessionDocumentId'))
    || getSessionDocumentId(safeJsonParse(storage.getString('auth'), null));
};

export const activateSessionByDocumentId = (documentId) => {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!normalizedDocumentId) {
    return { activated: false, reason: 'missing_document_id' };
  }

  const session = findAuthSessionByDocumentId(normalizedDocumentId);
  if (!session?.token) {
    return { activated: false, reason: 'session_not_found' };
  }

  const currentDocumentId = getActiveSessionDocumentId();
  if (currentDocumentId === normalizedDocumentId) {
    return {
      activated: true,
      session,
      switched: false,
    };
  }

  const didDispatch = dispatchAuthRuntimeAction({
    payload: normalizedDocumentId,
    type: 'SET_ACTIVE_SESSION',
  });

  if (!didDispatch) {
    const orderedSessions = orderSessionsByActive(getStoredAuthSessions(), normalizedDocumentId);
    storage.set('activeSessionDocumentId', normalizedDocumentId);
    storage.set('auth', JSON.stringify(session));
    storage.set('authSessions', JSON.stringify(orderedSessions));
  }

  return {
    activated: true,
    session,
    switched: true,
  };
};

export const activateSessionForNotificationPayload = (payload) => {
  const normalizedDocumentId = normalizeDocumentId(payload?.targetUserDocumentId);
  if (!normalizedDocumentId) {
    return { activated: false, reason: 'no_target_user' };
  }

  return activateSessionByDocumentId(normalizedDocumentId);
};

/**
 * Roles dont le parcours d'inscription ne demande PAS la date de naissance.
 * Le dirigeant n'a qu'une seule etape obligatoire (nom + prenom) ; le
 * superadmin n'est pas un compte de terrain.
 */
const ROLES_SANS_DATE_DE_NAISSANCE = ['president', 'superAdmin'];

/**
 * L'ecran « Qui es-tu ? » demande-t-il la date de naissance a ce role ?
 *
 * Depuis D15, prenom + nom + date de naissance tiennent sur UN seul ecran
 * (`RouteNames.UserName`). Cette fonction est la SEULE source de verite du
 * « ce role a-t-il une date de naissance a saisir » : `getOnboardingViews`
 * ci-dessous l'encode dans ses parcours, l'ecran la lit pour afficher ou non
 * les trois champs. Un test lie les deux, pour qu'elles ne divergent pas.
 * @param {Role} role - Le role de l'utilisateur.
 * @returns {boolean} Vrai si l'ecran fusionne doit afficher la date de naissance.
 */
export const onboardingCollectsBirthdate = (role) => !ROLES_SANS_DATE_DE_NAISSANCE
  .includes(getUserRoleKey(role?.name || role?.type));

/**
 * Get the onboarding view to show based on user type and existing user data
 * @param {User} params - The user data parameters
 * @returns {{totalViews: number, views: {index: number, route: string, canShow: boolean}[]}}
 */
export const getOnboardingViews = ({
  address, avatar, bestLevel, birthdate, category, club, clubAffiliations,
  clubs, documentId, firstname, height, lastname, multisportClubs, myTeams, parentalDeclarationAccepted, position, preferredSport, role,
  section, sportsHistory, trainedTeams, weight,
}) => {
  // Check if user has already completed onboarding once
  const hasCompletedOnboarding = (() => {
    try {
      if (documentId) {
        return storage.getBoolean(`hasCompletedOnboarding_${documentId}`);
      }
      return false;
    } catch (e) { return false; }
  })();

  // If onboarding was already completed once, skip all onboarding
  if (hasCompletedOnboarding) {
    return {
      totalViews: 0,
      views: [],
    };
  }

  const roleName = role?.name || USER_ROLES.new;
  const roleKey = getUserRoleKey(roleName);
  const hasClubAffiliation = !!(club?.documentId || club?.id)
    || ((Array.isArray(clubs) ? clubs.length : 0) > 0)
    || ((Array.isArray(clubAffiliations) ? clubAffiliations.length : 0) > 0)
    || ((Array.isArray(multisportClubs) ? multisportClubs.length : 0) > 0);
  const hasTeamAffiliation = (Array.isArray(myTeams) ? myTeams.length : 0)
    + (Array.isArray(trainedTeams) ? trainedTeams.length : 0) > 0;
  const shouldShowAffiliationGuide = (() => {
    if (roleKey === 'coach' || roleKey === 'president') {
      return !hasClubAffiliation;
    }
    if (roleKey === 'player') {
      return !hasTeamAffiliation;
    }
    return false;
  })();
  const needsParentalDeclaration = Boolean(
    birthdate
    && isBirthdateUnderParentalAge(birthdate)
    && parentalDeclarationAccepted !== true,
  );

  const baseViews = (() => {
    switch (roleKey) {
      case 'coach':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 2, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 3 : 2, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 4 : 3, route: RouteNames.UserAvatar },
          {
            canShow: shouldShowAffiliationGuide,
            index: needsParentalDeclaration ? 5 : 4,
            route: RouteNames.UserAffiliationGuide,
          },
          // D16 - la branche staff se dedouble ICI : l'entraineur declare les
          // equipes qu'il entraine, le dirigeant s'arrete au club (il le
          // couvre en entier). `Welcome` n'est plus une etape comptee.
          {
            canShow: !hasTeamAffiliation,
            index: needsParentalDeclaration ? 6 : 5,
            route: RouteNames.UserTrainedTeams,
          },
        ];
      case 'player':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 2, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 3 : 2, route: RouteNames.UserSection },
          { canShow: true, index: needsParentalDeclaration ? 4 : 3, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 5 : 4, route: RouteNames.UserAvatar },
          // Optional steps for players
          { canShow: true, index: needsParentalDeclaration ? 6 : 5, route: RouteNames.UserSport },
          { canShow: true, index: needsParentalDeclaration ? 7 : 6, route: RouteNames.UserPosition },
          { canShow: true, index: needsParentalDeclaration ? 8 : 7, route: RouteNames.UserPhysique },
          { canShow: true, index: needsParentalDeclaration ? 9 : 8, route: RouteNames.UserLevel },
          { canShow: true, index: needsParentalDeclaration ? 10 : 9, route: RouteNames.UserCategory },
          { canShow: true, index: needsParentalDeclaration ? 11 : 10, route: RouteNames.UserSportHistory },
          { canShow: true, index: needsParentalDeclaration ? 12 : 11, route: RouteNames.UserClubSearch },
          {
            canShow: shouldShowAffiliationGuide,
            index: needsParentalDeclaration ? 13 : 12,
            route: RouteNames.UserAffiliationGuide,
          },
          // D16 - « Equipe (demande envoyee au coach) ». Elle suit le club :
          // on ne peut pas choisir une equipe avant le club qui la contient.
          // `Welcome` n'est plus une etape comptee.
          {
            canShow: !hasTeamAffiliation,
            index: needsParentalDeclaration ? 14 : 13,
            route: RouteNames.UserTeamAffiliation,
          },
        ];
      case 'president':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          // D16 - « Ville ». Elle alimente les suggestions de club
          // (« PRES DE CHEZ TOI ») : elle doit donc arriver AVANT l'etape
          // club, sinon son ajout n'a aucun interet. `Welcome` n'est plus
          // une etape comptee.
          { canShow: true, index: 2, route: RouteNames.UserAddress },
          { canShow: true, index: 3, route: RouteNames.UserAvatar },
          { canShow: shouldShowAffiliationGuide, index: 4, route: RouteNames.UserAffiliationGuide },
        ];
      case 'superAdmin':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserAvatar },
          { canShow: true, index: 3, route: RouteNames.Welcome },
        ];
      default:
        return [
          { canShow: true, index: 1, route: RouteNames.UserRole },
          { canShow: true, index: 2, route: RouteNames.UserName },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 3, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 4 : 3, route: RouteNames.UserSection },
          { canShow: true, index: needsParentalDeclaration ? 5 : 4, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 6 : 5, route: RouteNames.UserAvatar },
          // Optional steps (will apply if user selects player role)
          { canShow: true, index: needsParentalDeclaration ? 7 : 6, route: RouteNames.UserSport },
          { canShow: true, index: needsParentalDeclaration ? 8 : 7, route: RouteNames.UserPosition },
          { canShow: true, index: needsParentalDeclaration ? 9 : 8, route: RouteNames.UserPhysique },
          { canShow: true, index: needsParentalDeclaration ? 10 : 9, route: RouteNames.UserLevel },
          { canShow: true, index: needsParentalDeclaration ? 11 : 10, route: RouteNames.UserCategory },
          { canShow: true, index: needsParentalDeclaration ? 12 : 11, route: RouteNames.UserSportHistory },
          { canShow: true, index: needsParentalDeclaration ? 13 : 12, route: RouteNames.UserClubSearch },
          { canShow: true, index: needsParentalDeclaration ? 14 : 13, route: RouteNames.Welcome },
        ];
    }
  })();
  // D15 : `UserName` porte desormais prenom + nom + date de naissance. L'ecran
  // ne peut donc etre saute que si les TROIS sont deja connus - sinon on
  // renverrait l'utilisateur a l'etape suivante sans jamais lui demander sa
  // date, et la declaration parentale ne se declencherait jamais.
  const collectsBirthdate = !ROLES_SANS_DATE_DE_NAISSANCE.includes(roleKey);
  const totalViews = baseViews.length;
  const filteredViews = baseViews.map((view) => {
    if (
      view.route === RouteNames.UserName
      && firstname
      && lastname
      && (!collectsBirthdate || birthdate)
    ) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserSection && section) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserParentalDeclaration && !needsParentalDeclaration) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserAddress && address) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserAvatar && avatar) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserRole && roleName !== USER_ROLES.new) {
      return Object.assign(view, { canShow: false });
    }
    // Optional steps - skip if already filled
    if (view.route === RouteNames.UserSport && preferredSport) {
      return Object.assign(view, { canShow: false });
    }
    // Skip position if sport does not expose dedicated positions in the app.
    if (view.route === RouteNames.UserPosition) {
      // D23 (a) - un poste deja enregistre ne se redemande pas, SAUF s'il ne
      // peut pas appartenir au sport choisi : un « Avant-centre » garde apres
      // un passage au rugby sautait l'etape et figeait un profil incoherent,
      // sans aucun moyen de le corriger dans le tunnel.
      if (position && positionsBelongToSport(position, preferredSport)) {
        return Object.assign(view, { canShow: false });
      }
      // D23 (b) - LA CAUSE DU DEFAUT « Rugby saute l'etape Poste ».
      // Cette porte disait « pas de sport ⇒ pas de postes ». Mais tant que
      // l'utilisateur est SUR l'etape Sport, son profil n'a pas encore de
      // sport : l'etape Poste sortait du programme, `PrivateNavigator` ne la
      // montait donc PAS, et l'ecran Sport ne pouvait plus y aller (il
      // retombait sur « Physique »). C'etait vrai pour les 5 sports a postes,
      // pas seulement le rugby.
      // On ne peut pas trancher avant que le sport soit repondu : on garde
      // l'etape au programme, et c'est l'ecran Poste qui se retire a
      // l'arrivee s'il n'a pas de sport a montrer - il sait deja le faire.
      // If sport is set but doesn't have positions, skip this step
      if (preferredSport && !sportHasPositions(preferredSport)) {
        return Object.assign(view, { canShow: false });
      }
    }
    if (view.route === RouteNames.UserPhysique && (height || weight)) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserLevel && bestLevel) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserCategory && category) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserSportHistory && sportsHistory) {
      return Object.assign(view, { canShow: false });
    }
    return view;
  });

  const views = filteredViews?.filter((view) => view.canShow)?.length > 0 ? filteredViews
    : [];
  return {
    totalViews,
    views,
  };
};

/**
 * L'ÉTAPE SUIVANTE — le cœur de `useAuth.getNextOnboardingRoute`.
 *
 * D33 : extrait tel quel du hook (même recherche, même ordre, mêmes sorties),
 * pour la même raison que D23 avait extrait `resolveOnboardingExitRoute` : la
 * décision vivait dans un `useCallback`, donc hors de portée d'un test. Le
 * trajet complet du tunnel — club → équipe → sas — se mesure maintenant sans
 * monter un seul écran.
 * @param {object} params - Les entrées de la décision.
 * @param {string} params.currentRoute - L'étape d'où l'on part.
 * @param {{ canShow: boolean, index: number, route: string }[]} [params.views] - Le parcours.
 * @returns {string | undefined} L'étape suivante affichable, ou `undefined` s'il n'y en a plus.
 */
export const resolveNextOnboardingRoute = ({ currentRoute, views }) => {
  const currentIndex = views?.find((view) => view.route === currentRoute)?.index || 0;
  return views?.find((view) => view.canShow && view.index > currentIndex)?.route;
};

/**
 * Les étapes du tunnel qui envoient vers un écran EXTÉRIEUR au tunnel
 * (fiche de club, fiche d'équipe, tunnel de création de club) et attendent
 * qu'on leur rende la main. Sert de liste blanche à
 * `resolveAffiliationOriginRoute` — voir sa documentation.
 */
const AFFILIATION_ORIGIN_ROUTES = [
  RouteNames.UserAffiliationGuide,
  RouteNames.UserTeamAffiliation,
];

/**
 * DE QUELLE ÉTAPE VIENT-ON ? — la question que D33 a corrigée.
 *
 * Une affiliation s'envoie depuis un écran qui n'est PAS dans le tunnel (la
 * fiche d'équipe, la fiche de club). Pour reprendre le tunnel au bon endroit,
 * cet écran doit savoir de quelle étape il a été ouvert. Avant D33 il le
 * SUPPOSAIT : `UserAffiliationGuide`, l'étape club, écrite en dur. C'était vrai
 * avant D16, quand un seul écran portait les deux phases ; depuis que l'équipe
 * est une étape comptée à part, la suite de l'étape club EST l'étape équipe —
 * donc envoyer sa demande d'équipe reposait le joueur sur « Trouve ton équipe »
 * (recette d'Adel du 2026-08-07, capture « étape 13/13 »).
 *
 * Le repli sur l'étape club n'est pas une précaution : c'est le comportement
 * EXACT d'avant D33, que `ClubDetails` et `ClubWizardRecap` gardent sans rien
 * passer — l'étape club est bien la leur.
 *
 * La liste blanche, elle, garde une frontière de confiance : ce paramètre
 * arrive par la navigation. Une valeur inconnue donnerait `currentIndex = 0` à
 * `resolveNextOnboardingRoute`, qui rendrait alors la PREMIÈRE étape du
 * parcours — le tunnel entier recommencerait au lieu de se terminer.
 * @param {{ onboardingOriginRoute?: string } | undefined} routeParams - Les paramètres de navigation.
 * @returns {string} L'étape d'où reprendre le tunnel.
 */
export const resolveAffiliationOriginRoute = (routeParams) => {
  const originRoute = routeParams?.onboardingOriginRoute;
  return AFFILIATION_ORIGIN_ROUTES.includes(originRoute)
    ? originRoute
    : RouteNames.UserAffiliationGuide;
};

/**
 * Les rôles À QUI l'offre d'abonnement s'adresse, en fin d'inscription.
 *
 * D89 — la règle n'est pas inventée ici, elle est RELEVÉE : `SubscriptionOffers`
 * (l. 164) et `Welcome` (l. 46) portent déjà la même, mot pour mot. L'écran
 * d'offres rend `null` pour tout autre rôle ⇒ y envoyer un joueur en fin
 * d'inscription lui afficherait une PAGE BLANCHE, c'est-à-dire exactement le
 * cul-de-sac que ce lot doit éviter.
 * @type {string[]}
 */
const ONBOARDING_SUBSCRIPTION_OFFER_ROLES = ['coach', 'president'];

// Le seul niveau d'accès à qui l'on a quelque chose à vendre. Tout le reste —
// `TEAM`, `CLUB`, `CLUB_UNVERIFIED` — a déjà payé (`getSubscriptionAccessLevel`,
// subscriptionDecision.js:18).
const ONBOARDING_SUBSCRIPTION_FREE_LEVEL = 'FREE';

/**
 * L'OFFRE EST-ELLE POUR CETTE PERSONNE ? — la décision du sas D89.
 *
 * Un niveau d'abonnement ABSENT ou inconnu répond NON, et c'est délibéré : dans
 * le doute on ne vend pas. C'est aussi ce qui garde le contrat de D23 intact —
 * `authUseCases.welcome.test.js` appelle la sortie de tunnel sans rien dire de
 * l'abonnement et attend `Welcome`.
 * @param {object} params - Les entrées de la décision.
 * @param {string} [params.roleKey] - Le rôle, tel que rendu par `getUserRoleKey`.
 * @param {string} [params.subscriptionAccessLevel] - Le niveau d'accès (`getSubscriptionAccessLevel`).
 * @returns {boolean} `true` si l'offre doit être proposée avant la bienvenue.
 */
export const canShowOnboardingSubscriptionOffer = ({ roleKey, subscriptionAccessLevel }) => {
  if (!ONBOARDING_SUBSCRIPTION_OFFER_ROLES.includes(String(roleKey || ''))) return false;

  return String(subscriptionAccessLevel || '').trim().toUpperCase()
    === ONBOARDING_SUBSCRIPTION_FREE_LEVEL;
};

/**
 * LE SAS D'ARRIVÉE — quelle route après la dernière étape comptée ?
 *
 * D16 : `Welcome` n'est plus une étape numérotée des parcours joueur,
 * entraîneur et dirigeant (décision Adel du 2026-08-06 : « Bienvenue sort du
 * COMPTEUR mais n'est PAS supprimé »). Il reste l'écran qui lance le tour
 * guidé et montre les trois offres, et il se rejoint ICI, en sortie de tunnel.
 *
 * D23 : cette décision vivait à l'intérieur de `useAuth`, donc hors de portée
 * d'un test. Elle est extraite telle quelle — même ordre, mêmes sorties — pour
 * que « Welcome est bien ATTEINT en fin de parcours » soit une chose qu'on
 * mesure, et non qu'on suppose.
 *
 * D89 : le sas compte désormais DEUX marches — l'offre, puis la bienvenue
 * (demande d'Adel du 2026-08-12 : « à la fin de l'onboarding, AVANT l'écran de
 * bienvenue »). L'offre n'est PAS une étape : aucun compteur ne bouge, aucune
 * étape existante n'est déplacée. C'est la même grammaire que `Welcome` — une
 * marche du sas, qui se saute quand elle n'a rien à dire.
 * `SubscriptionOffers` rend la main à `Welcome` lui-même : les deux sorties de
 * cet écran (passer, acheter) y mènent, il n'y a donc pas d'impasse possible.
 * @param {object} params - Les entrées de la décision.
 * @param {boolean} params.hasSeenWelcome - L'écran a déjà été vu par cet utilisateur.
 * @param {string} [params.roleKey] - Le rôle, tel que rendu par `getUserRoleKey`.
 * @param {string} [params.subscriptionAccessLevel] - Le niveau d'accès (`getSubscriptionAccessLevel`).
 * @param {string} [params.userDocumentId] - L'identifiant de l'utilisateur.
 * @param {{ canShow: boolean, index: number, route: string }[]} [params.views] - Le parcours.
 * @returns {string | undefined} La route du sas, ou `undefined` s'il n'y a pas de sas.
 */
export const resolveOnboardingExitRoute = ({
  hasSeenWelcome,
  roleKey,
  subscriptionAccessLevel,
  userDocumentId,
  views,
}) => {
  // Tunnel déjà fini (`views` vide) : on ne repousse personne vers l'accueil
  // des inscrits. Un utilisateur qui revient n'a rien à y faire.
  if (!Array.isArray(views) || views.length === 0) return undefined;
  // `superAdmin` et le parcours `new` gardent `Welcome` comme étape numérotée :
  // ils y sont déjà passés par la voie normale.
  if (views.some((view) => view.route === RouteNames.Welcome)) return undefined;
  if (!userDocumentId) return undefined;
  if (hasSeenWelcome) return undefined;

  if (canShowOnboardingSubscriptionOffer({ roleKey, subscriptionAccessLevel })) {
    return RouteNames.SubscriptionOffers;
  }

  return RouteNames.Welcome;
};

/**
 * Mark onboarding as completed for a user
 * This should be called when the user finishes or skips the last onboarding step
 * @param {string} documentId - The user's document ID
 */
export const markOnboardingComplete = (documentId) => {
  if (documentId) {
    storage.set(`hasCompletedOnboarding_${documentId}`, true);
  }
};

/**
 * Get the fields to display in the profile based on user role
 * @param {Role} role - The user role
 * @returns {string[]} Array of field names to display
 */
export const profileFieldToDisplay = (role) => {
  switch (getUserRoleKey(role?.name)) {
    // D39 — le contrat de role du pack « Profils joueur & entraineur » :
    // « aucun bloc joueur atteignable sur un profil coach ». Le NUMERO DE
    // MAILLOT en etait un (le pack le range explicitement dans les heritages
    // joueur a supprimer) ; le SPORT DE PREFERENCE, lui, manquait alors que la
    // vue publique coach l'affiche. Aucune donnee n'est effacee : le champ
    // cesse d'etre montre, sa valeur reste en base.
    // ⚠️ `ProfileEdit` reste ouvert au maillot depuis la carte de collection
    // (`CARD_EXTRA_FIELDS`) : ce chemin-la n'est pas touche.
    case 'coach':
      return [
        'firstname',
        'lastname',
        'birthdate',
        'address',
        'avatar',
        'nationality',
        'preferredSport',
      ];
    case 'player':
      return [
        'firstname',
        'lastname',
        'birthdate',
        'address',
        'avatar',
        'section',
        'height',
        'weight',
        'position',
        'bestLevel',
        'category',
        'preferredSport',
        'nationality',
        'jerseyNumber',
      ];
    case 'president':
      return [
        'firstname',
        'lastname',
        'avatar',
      ];
    default:
      return [
        'firstname',
        'lastname',
        'section',
        'birthdate',
        'address',
        'avatar',
        'bestLevel',
        'category',
        'preferredSport',
      ];
  }
};

/**
 * Format date string from YYYY-MM-DD to DD/MM/YYYY pattern
 * @param {string} value - The input value to format (expected in YYYY-MM-DD format)
 * @returns {string} - The formatted date string in DD/MM/YYYY format
 */
export const formatBirthdateToDisplay = (value) => {
  if (!value || typeof value !== 'string') return '';

  // Check if the value is in YYYY-MM-DD format
  const datePattern = /^(\d{4})-(\d{2})-(\d{2}).*$/;
  const match = value.match(datePattern);

  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // If not in expected format, try to handle as in the original function
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

/**
 * Format date string from DD/MM/YYYY to YYYY-MM-DD
 * @param {string} value - The input value to format
 * @returns {string} - The formatted date string
 */
export const formatBirthdateToSend = (value) => {
  if (!value || typeof value !== 'string') return '';

  // First, extract just the digits
  const digits = value.replace(/\D/g, '');

  // Check if we have a complete date (at least 8 digits)
  if (digits.length < 8) return '';

  // Extract day, month, year
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  // Return in ISO format
  return `${year}-${month}-${day}`;
};

export const NOTIFICATION_TYPES = {
  // Users
  ADD_TO_TEAM: 'addToTeam',

  // Clubs
  AFFILIATION_HELP_REQUEST: 'affiliationHelpRequest',
  AFFILIATION_HELP_STATUS: 'affiliationHelpStatus',
  CLUB_MEMBERSHIP_REQUEST: 'clubMembershipRequest',
  CLUB_REQUEST: 'clubRequest',

  // Teams
  NEW_TEAM: 'newTeam',
  TEAM_EXTERNAL_SOURCE_UPDATED: 'teamExternalSourceUpdated',
  TEAM_MEMBERSHIP_REQUEST: 'teamMembershipRequest',
  TEAM_REQUEST: 'teamRequest',
  TOURNAMENT_CAPTAIN_TRANSFER: 'tournamentCaptainTransfer',
  TOURNAMENT_CLOSED: 'tournamentClosed',
  TOURNAMENT_TEAM_INVITATION: 'tournamentTeamInvitation',
  TOURNAMENT_TEAM_INVITATION_STATUS: 'tournamentTeamInvitationStatus',
  TOURNAMENT_TEAM_JOIN_REQUEST: 'tournamentTeamJoinRequest',
  TOURNAMENT_TEAM_JOIN_REQUEST_STATUS: 'tournamentTeamJoinRequestStatus',
  TOURNAMENT_TEAM_ROSTER_WARNING: 'tournamentTeamRosterWarning',
  TOURNAMENT_TEAM_STATUS: 'tournamentTeamStatus',

  // Events
  CELEBRATION: 'celebration',
  COACH_REPORT_PUBLISHED: 'coachReportPublished',
  EVENT_ABSENCE_FINAL: 'eventAbsenceFinal',
  EVENT_CANCELLATION: 'eventCancellation',
  EVENT_CONVOCATION_PUBLISHED: 'eventConvocationPublished',
  EVENT_CREATED: 'eventCreated',
  EVENT_LINEUP_PUBLISH_REMINDER: 'eventLineupPublishReminder',
  EVENT_PARTICIPANT_REMINDER: 'eventParticipantReminder',
  EVENT_PUBLISHED: 'eventPublished',
  EVENT_REMINDER: 'eventReminder',
  EVENT_RSVP_STATUS_CHANGED: 'eventRsvpStatusChanged',
  EVENT_TEAM_INVITED: 'eventTeamInvited',
  EVENT_UPDATED: 'eventUpdated',
  FEATURED_APPROVED: 'featuredApproved',
  FEATURED_REJECTED: 'featuredRejected',
  FEATURED_REQUEST: 'featuredRequest',
  NEW_PARTICIPATION: 'newParticipation',
  OVERBOOKING_REQUEST: 'overbookingRequest',
  PARTICIPATION_REQUEST: 'participationRequest',
  RESERVATION_COMPLETE: 'reservationComplete',
  RESERVATION_PLAYER_JOINED: 'reservationPlayerJoined',
  RESERVATION_SOS_ALERT: 'reservationSosAlert',
  SEARCH_ALERT_MATCH: 'searchAlertMatch',
  TEAM_FIRST_EVENT_CREATED: 'teamFirstEventCreated',

  // Licences
  LICENSE_CAMPAIGN_CLOSED: 'licenseCampaignClosed',
  LICENSE_CAMPAIGN_PAUSED: 'licenseCampaignPaused',
  LICENSE_CAMPAIGN_PUBLISHED: 'licenseCampaignPublished',
  LICENSE_DOCUMENT_REPLACEMENT_REQUIRED: 'licenseDocumentReplacementRequired',
  LICENSE_DOCUMENT_SUBMITTED: 'licenseDocumentSubmitted',
  LICENSE_INSTALLMENT_OVERDUE: 'licenseInstallmentOverdue',
  LICENSE_PAYMENT_CONFIRMED: 'licensePaymentConfirmed',
  LICENSE_PAYMENT_DUE: 'licensePaymentDue',
  LICENSE_PAYMENT_REJECTED: 'licensePaymentRejected',
  LICENSE_PAYMENT_REMINDER: 'licensePaymentReminder',
  LICENSE_PAYMENT_SUBMITTED: 'licensePaymentSubmitted',

  // Messages
  NEW_GROUP_MESSAGE: 'newGroupMessage',
  NEW_LEAGUE_MATCH_MESSAGE: 'newLeagueMatchMessage',
  NEW_TEAM_MESSAGE: 'newTeamMessage',
  NEW_TEAM_PLAYER_MESSAGE: 'newTeamPlayerMessage',
  NEW_WHISPER: 'newWhisper',

  // Matchmaking
  LEAGUE_AUTOMATION: 'LEAGUE_AUTOMATION',
  LEAGUE_COUNTER_PROPOSAL_RECEIVED: 'leagueCounterProposalReceived',
  LEAGUE_MATCH_CANCELLED_NEGOTIATION_TIMEOUT: 'leagueMatchCancelledNegotiationTimeout',
  LEAGUE_MATCH_DISPUTED: 'leagueMatchDisputed',
  LEAGUE_MATCH_FINALIZED: 'leagueMatchFinalized',
  LEAGUE_MATCH_FOUND: 'leagueMatchFound',
  LEAGUE_MATCH_VALIDATED: 'leagueMatchValidated',
  LEAGUE_POST_SLOT_CANCELLED: 'leaguePostSlotCancelled',
  LEAGUE_POST_SLOT_CHECK: 'leaguePostSlotCheck',
  LEAGUE_POST_SLOT_CONFIRMATION: 'leaguePostSlotConfirmation',
  LEAGUE_POST_SLOT_RESCHEDULED: 'leaguePostSlotRescheduled',
  LEAGUE_PROPOSAL_ACCEPTED: 'leagueProposalAccepted',
  LEAGUE_PROPOSAL_DECLINED: 'leagueProposalDeclined',
  LEAGUE_PROPOSAL_RECEIVED: 'leagueProposalReceived',
  LEAGUE_QUORUM_REACHED: 'leagueQuorumReached',
  LEAGUE_QUORUM_REMINDER: 'leagueQuorumReminder',
  LEAGUE_SCORE_ADMIN_ESCALATED: 'leagueScoreAdminEscalated',
  LEAGUE_SCORE_DEADLINE_WARNING: 'leagueScoreDeadlineWarning',
  LEAGUE_SCORE_DISPUTED_BY_OPPONENT: 'leagueScoreDisputedByOpponent',
  LEAGUE_SCORE_DUE: 'leagueScoreDue',
  LEAGUE_SCORE_END_DUE: 'leagueScoreEndDue',
  LEAGUE_SCORE_REMINDER_2H: 'leagueScoreReminder2h',
  LEAGUE_SCORE_START_INFO: 'leagueScoreStartInfo',
  LEAGUE_SCORE_SUBMITTED_BY_OPPONENT: 'leagueScoreSubmittedByOpponent',
  LEAGUE_SCORE_VALIDATION_REQUIRED: 'leagueScoreValidationRequired',
  LEAGUE_SEARCH_RELAUNCH_PROMPT: 'leagueSearchRelaunchPrompt',
  LEAGUE_SEARCH_STARTED: 'leagueSearchStarted',
  LEAGUE_SEARCH_STILL_RUNNING: 'leagueSearchStillRunning',
  LEAGUE_SQUAD_INVITATION: 'leagueSquadInvitation',
  LEAGUE_SQUAD_JOIN_REQUEST: 'leagueSquadJoinRequest',
  LEAGUE_SQUAD_JOIN_REQUEST_STATUS: 'leagueSquadJoinRequestStatus',
  LEAGUE_VENUE_BOOKED: 'leagueVenueBooked',
  RECRUITMENT_APPLICATION: 'recruitment_application',
  RECRUITMENT_APPLICATION_AUTO: 'recruitment_application_auto',
  RECRUITMENT_APPLICATION_STATUS: 'recruitment_application_status',
  // Matchs amicaux (lot L6). Les chaines doivent etre IDENTIQUES a celles du
  // serveur (admin/src/api/user-fcm-token/types/index.ts) : c'est ce champ qui
  // decide de l'ecran a ouvrir, une faute de frappe renvoie a l'accueil sans
  // la moindre erreur.
  FRIENDLY_MATCH_AD_EXPIRED: 'friendly_match_ad_expired',
  FRIENDLY_MATCH_APPLICATION: 'friendly_match_application',
  FRIENDLY_MATCH_APPLICATION_STATUS: 'friendly_match_application_status',
  FRIENDLY_MATCH_TERMS_UPDATED: 'friendly_match_terms_updated',
  REMATCH_REQUEST: 'REMATCH_REQUEST',
  RSVP_ALERT: 'RSVP_ALERT',
  // Legacy alias kept for backward compatibility
  MATCH_FOUND: 'MATCH_FOUND',
};

export { sanitizeUser };
