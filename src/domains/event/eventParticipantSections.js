/**
 * PARTWEB (21/09) — QUI VIENT, QUI MANQUE, QUI N A PAS REPONDU : UN SEUL CALCUL
 * POUR LE TELEPHONE ET POUR LE SITE.
 *
 * 📸 LE DEFAUT : sur foundclub.app, la fiche de l entrainement Senior disait
 * « Faire l appel : 15 attendus » ET « Aucun participant confirme » ET
 * « Joueurs attendus : 0 ». Le site ne lisait que `event.participations` ;
 * le telephone, lui, range les gens par equipe dans les listes ci-dessous.
 *
 * 🎯 Ce fichier n invente rien : c est le texte des deux `useMemo` et des aides
 * de `EventDetails.js`, DEPLACE ici pour que `EventDetails.web.js` appelle la
 * meme fonction au lieu d en recopier une seconde — deux juges du meme etat
 * finissent toujours par diverger.
 *
 * 🧭 COACH1 (decision d Adel du 21/09, « 2-A ») : un entraineur qui repond ne
 * compte dans AUCUNE de ces listes (`trainerKeys`) — sa reponse ne pese pas
 * dans l assiduite des joueurs.
 *
 * 🧑‍🏫 ENCADRE (decision d Adel du 22/09, « PARTWEB-1 → B ») : sa reponse se VOIT
 * quand meme, dans `staff` — l Encadrement de la carte de son equipe, a cote
 * des listes des joueurs et jamais dedans.
 *
 * 🎽 ROLES3 (decision d Adel du 28/09, « 2- oui ») : l entraineur QUI JOUE dans
 * l equipe (inscrit a ses deux listes) est un JOUEUR de cette equipe — il compte
 * dans ses presents, il n est plus repete dans son Encadrement. C est la regle
 * du serveur (U02, `isStaffOnlyForTeams`). « Encadrant » ci-dessus veut donc
 * dire : encadrant qui ne joue pas.
 *
 * Temoins : `eventParticipantSections.test.js` (le calcul) et les temoins
 * d ecran S1, AA02, AD06, AE02, P2, P7 (les props remises a `EventParticipants`).
 */
import { withoutDeletedAccounts } from '@/domains/user/deletedAccount';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   firstname?: string;
 *   lastname?: string;
 *   avatar?: { url?: string };
 * }} User
 */
/**
 * @typedef {{
 *   documentId?: string;
 *   updatedAt?: string;
 *   participationStatus?: string;
 *   isActive?: boolean;
 *   sourceTeam?: { documentId?: string; name?: string };
 *   user: User;
 * }} EventParticipation
 */
/** @typedef {(key: string, fallback?: string, options?: object) => string} Translate */

/**
 * La cle d une personne : son `documentId`, sinon son `id`.
 * @param {User | null | undefined} user - La personne.
 * @returns {string | null} - `doc:…`, `id:…`, ou `null` sans identifiant.
 */
export const getUserKey = (user) => {
  if (user?.documentId) return `doc:${user.documentId}`;
  if (user?.id) return `id:${String(user.id)}`;
  return null;
};

/**
 * AA02 — LE POINT DE PASSAGE UNIQUE des listes de personnes de cet ecran.
 *
 * Presents, absents, sans reponse, joueurs d'equipe, participants externes,
 * historique, candidats a la compo : TOUT remonte ici. Le tri des comptes
 * supprimes est donc pose a UN seul endroit, pas recopie huit fois.
 * `withoutDeletedAccounts` ecarte les deux trous possibles — la relation vide
 * (`null`) et le fantome (compte anonymise et bloque par `deleteAccount`).
 * @param {User[]} [users]
 * @returns {User[]}
 */
export const uniqueUsers = (users = []) => {
  const map = new Map();
  withoutDeletedAccounts(users).forEach((user) => {
    const key = getUserKey(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

/**
 * 🕶️ MASQUE (22/09) — combien de personnes d une liste n ont PAS de cle.
 *
 * 📸 LE DEFAUT : identites masquees, le serveur remplace chaque personne par un
 * jeton anonyme sans `id` ni `documentId` (`buildAnonymousUser`,
 * `admin/src/utils/people-in-payload.ts`). `uniqueUsers` ne garde que ce qui a
 * une cle : tout le monde disparaissait, et le telephone disait « Aucun
 * participant » alors que 3 personnes venaient.
 * 🔒 Le serveur garde UN jeton par personne : on relit ce NOMBRE, jamais un nom.
 * @param {User[]} [users] - Une liste recue du serveur.
 * @returns {number} - Ses personnes vivantes sans cle.
 */
export const countAnonymousUsers = (users = []) => withoutDeletedAccounts(users)
  .filter((user) => !getUserKey(user)).length;

/**
 * Les cles des encadrants d UNE equipe.
 * @param {any} team - L equipe telle que le serveur la rend.
 * @returns {Set<string | null>} - Les cles de ses `trainers`.
 */
export const getTrainerKeySet = (team) => new Set(
  (team?.trainers || [])
    .map((/** @type {User} */ trainer) => getUserKey(trainer))
    .filter(Boolean),
);

/**
 * Les joueurs d une equipe — l entraineur qui y joue COMPRIS (ROLES3).
 * @param {any} team - L equipe telle que le serveur la rend.
 * @returns {User[]} - Ses joueurs, dedoublonnes, comptes supprimes ecartes.
 */
export const getEligibleTeamPlayers = (team) => uniqueUsers(
  (team?.players || []).filter((/** @type {User} */ player) => Boolean(getUserKey(player))),
);

/**
 * 🎽 ROLES3 — l encadrement d UNE equipe : ses encadrants QUI N Y JOUENT PAS.
 * Qui est aux deux listes est un joueur (`getEligibleTeamPlayers`).
 * @param {any} team - L equipe telle que le serveur la rend.
 * @returns {User[]} - Ses encadrants hors joueurs, dans l ordre recu.
 */
export const getStaffOnlyTrainers = (team) => {
  const playerKeys = new Set((team?.players || []).map(getUserKey).filter(Boolean));
  return (team?.trainers || []).filter(
    (/** @type {User} */ trainer) => !playerKeys.has(getUserKey(trainer)),
  );
};

/**
 * 🧑‍🏫 ENCADRE — les encadrants d UNE equipe, ranges par reponse.
 *
 * Present d abord, puis absent ; sans l un ni l autre, « sans reponse » (une
 * demande en attente d un encadrant compte ici comme une absence de reponse :
 * elle n a rien a faire dans les demandes des joueurs, que `trainerKeys` lui
 * ferme deja). Les comptes supprimes partent par `uniqueUsers`, comme partout.
 * @param {any} team - L equipe telle que le serveur la rend.
 * @param {Set<string | null>} participatingKeys - Les cles de TOUS les presents.
 * @param {Set<string | null>} missingKeys - Les cles de TOUS les absents.
 * @returns {{ missing: User[]; notAnswered: User[]; participating: User[] }}
 */
const getTeamStaff = (team, participatingKeys, missingKeys) => {
  const staff = {
    missing: /** @type {User[]} */ ([]),
    notAnswered: /** @type {User[]} */ ([]),
    participating: /** @type {User[]} */ ([]),
  };
  uniqueUsers(getStaffOnlyTrainers(team)).forEach((trainer) => {
    const key = getUserKey(trainer);
    if (participatingKeys.has(key)) staff.participating.push(trainer);
    else if (missingKeys.has(key)) staff.missing.push(trainer);
    else staff.notAnswered.push(trainer);
  });
  return staff;
};

/**
 * Une liste de personnes, moins celles dont la cle est exclue.
 * @param {User[]} [users] - La liste brute.
 * @param {Set<string | null>} [excludedKeys] - Les cles a ecarter.
 * @returns {User[]} - La liste filtree et dedoublonnee.
 */
export const filterUsersByExcludedKeys = (users = [], excludedKeys = new Set()) => uniqueUsers(
  users.filter((user) => {
    const key = getUserKey(user);
    return Boolean(key) && !excludedKeys.has(key);
  }),
);

/**
 * Les encadrants de l evenement dont la reponse ne compte PAS chez les joueurs :
 * encadrants d une de ses equipes (organisatrice ou invitee) qui ne jouent dans
 * AUCUNE. 🎽 ROLES3 — l entraineur qui joue dans l une d elles est un joueur :
 * meme regle que le serveur (`isStaffOnlyForTeams`, U02).
 * @param {any} event
 * @returns {Set<string | null>}
 */
export const getEventTrainerKeys = (event) => {
  const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
  const playerKeys = new Set(
    teams.flatMap((team) => team?.players || []).map(getUserKey).filter(Boolean),
  );
  return new Set(
    teams
      .flatMap((team) => team?.trainers || [])
      .map((trainer) => getUserKey(trainer))
      .filter((key) => Boolean(key) && !playerKeys.has(key)),
  );
};

/**
 * Les sections « une par equipe » : presents, absents, demandes, sans reponse,
 * historique, encadrement (`staff`) — plus la section des participants
 * EXTERNES aux equipes.
 * @param {{
 *   canEdit: boolean;
 *   event: any;
 *   inactiveParticipations: EventParticipation[];
 *   pendingParticipations: EventParticipation[];
 *   t: Translate;
 *   trainerKeys: Set<string | null>;
 * }} params - L evenement, les demandes et qui regarde.
 * @returns {{
 *   externalParticipationSection: any;
 *   participantsSummary: {
 *     anonymousCounts?: { missing: number; notAnswered: number; participating: number };
 *     capacity: number;
 *     participatingCount: number;
 *   };
 *   teamParticipationSections: any[];
 * }} - Les sections a afficher et le resume des presents.
 */
export const buildTeamParticipationSections = ({
  canEdit,
  event,
  inactiveParticipations,
  pendingParticipations,
  t,
  trainerKeys,
}) => {
  if (!event) {
    return {
      externalParticipationSection: null,
      participantsSummary: {
        capacity: 0,
        participatingCount: 0,
      },
      teamParticipationSections: [],
    };
  }

  // 🧑‍🏫 ENCADRE — les reponses BRUTES, encadrants compris. Les listes des
  // joueurs plus bas les relisent SANS eux (`trainerKeys`) ; `staff` est le
  // seul endroit qui lit celles-ci. Les compteurs, la relance et « Joueurs
  // attendus » ne lisent que les listes des joueurs : l encadrement n y entre
  // donc pas, sans qu on ait a leur apprendre a l ecarter.
  const everyParticipatingKey = new Set(uniqueUsers(event?.participations || []).map(getUserKey));
  const everyMissingKey = new Set(uniqueUsers(event?.missings || []).map(getUserKey));

  const teamBuckets = [
    event?.team ? {
      isHome: true,
      key: event.team.documentId || 'home-team',
      players: getEligibleTeamPlayers(event.team),
      staff: getTeamStaff(event.team, everyParticipatingKey, everyMissingKey),
      teamName: event.team.name || t('eventDetails.organisingTeam', 'Équipe organisatrice'),
    } : null,
    ...((event?.invitedTeams || []).map((/** @type {any} */ team) => ({
      isHome: false,
      key: team?.documentId || `invited-${team?.name || 'team'}`,
      players: getEligibleTeamPlayers(team),
      staff: getTeamStaff(team, everyParticipatingKey, everyMissingKey),
      teamName: team?.name || t('eventDetails.invitedTeam', 'Équipe invitée'),
    }))),
  ].filter(Boolean);

  const knownTeamPlayerKeys = new Set(
    teamBuckets
      .flatMap((bucket) => bucket.players || [])
      .map((/** @type {User} */ player) => getUserKey(player))
      .filter(Boolean),
  );
  const knownTeamSectionKeys = new Set(teamBuckets.map((bucket) => bucket.key));
  const teamKeyByUserKey = new Map();
  const teamNameByUserKey = new Map();
  teamBuckets.forEach((bucket) => {
    (bucket.players || []).forEach((/** @type {User} */ player) => {
      const userKey = getUserKey(player);
      if (!userKey || teamKeyByUserKey.has(userKey)) return;
      teamKeyByUserKey.set(userKey, bucket.key);
      teamNameByUserKey.set(userKey, bucket.teamName);
    });
  });

  const participatingUsers = filterUsersByExcludedKeys(event?.participations || [], trainerKeys);
  const missingUsers = filterUsersByExcludedKeys(event?.missings || [], trainerKeys);
  const participatingKeys = new Set(
    participatingUsers
      .map((/** @type {User} */ participant) => getUserKey(participant))
      .filter(Boolean),
  );
  const missingKeys = new Set(
    missingUsers.map((/** @type {User} */ missing) => getUserKey(missing)).filter(Boolean),
  );

  const pendingByUserKey = new Map();
  pendingParticipations.forEach((participation) => {
    const key = getUserKey(participation?.user);
    if (!key || trainerKeys.has(key)) return;
    pendingByUserKey.set(key, participation);
  });

  /** @type {Map<string, any>} */
  const historicalByTeam = new Map();
  /**
   * @typedef {{ missing: User[]; participating: User[]; pending: EventParticipation[] }} Historical
   */
  const historicalExternal = /** @type {Historical} */ ({
    missing: [],
    participating: [],
    pending: [],
  });
  inactiveParticipations
    .filter((participation) => participation?.user)
    .forEach((participation) => {
      const userKey = getUserKey(participation?.user);
      if (!userKey || trainerKeys.has(userKey)) return;

      // 🎯 S1 (constat d Adel du 2026-08-25) — UNE REPONSE ACTIVE EFFACE LA
      // TRACE DE CELLE QU ELLE REMPLACE.
      //
      // 📸 LE DEFAUT : un joueur qui passait de « present » a « absent »
      // apparaissait DEUX FOIS — dans les absents, ET dans « Historique
      // equipe retiree », avec son ancien pointage « Arrive » en prime.
      // Le serveur est sain (verifie le 25/08) : `declareMissing` DESACTIVE
      // l ancienne reponse puis cree l absence. C est ICI que les deux
      // etaient rangees cote a cote : la boucle versait TOUTE ligne inactive
      // dans l historique sans jamais regarder s il en existait une active.
      //
      // 🔒 CE QUI CONTINUE DE S AFFICHER, et c est tout le sujet de la
      // section : l historique de qui n a AUCUNE reponse active — une equipe
      // retiree de l evenement (`archiveResponsesBySourceTeams` cote serveur),
      // une inscription archivee jamais reprise. Une histoire, ce n est pas
      // la reponse d il y a trois secondes.
      //
      // ⛔ LA DONNEE NE BOUGE PAS : `includeInactive: true` reste. C est le
      // filtre qui manquait, pas la matiere.
      //
      // 🪢 Pose AVANT le partage `isExternal` : le meme garde couvre donc les
      // deux historiques, celui des equipes et celui des externes.
      const aDejaUneReponseActive = participatingKeys.has(userKey)
        || missingKeys.has(userKey)
        || pendingByUserKey.has(userKey);
      if (aDejaUneReponseActive) return;

      const sourceTeamId = participation?.sourceTeam?.documentId;
      const sourceTeamKnown = Boolean(
        sourceTeamId && knownTeamSectionKeys.has(sourceTeamId),
      );
      const fallbackTeamKey = userKey ? teamKeyByUserKey.get(userKey) : null;
      const resolvedTeamKey = sourceTeamKnown ? sourceTeamId : fallbackTeamKey;
      let resolvedTeamName = null;
      if (sourceTeamKnown) {
        resolvedTeamName = participation?.sourceTeam?.name || null;
      } else if (userKey) {
        resolvedTeamName = teamNameByUserKey.get(userKey) || null;
      }
      const isExternal = !resolvedTeamKey;

      if (isExternal) {
        if (participation.participationStatus === 'missing') {
          historicalExternal.missing.push(participation.user);
        } else if (participation.participationStatus === 'accepted') {
          historicalExternal.participating.push(participation.user);
        } else if (participation.participationStatus === 'pending') {
          historicalExternal.pending.push(participation);
        }
        return;
      }

      const teamKey = resolvedTeamKey;
      const teamName = resolvedTeamName || t('eventDetails.removedTeam', 'Équipe retirée');
      const current = historicalByTeam.get(teamKey) || {
        key: teamKey,
        missing: [],
        participating: [],
        pending: [],
        teamName,
      };
      if (participation.participationStatus === 'missing') {
        current.missing.push(participation.user);
      } else if (participation.participationStatus === 'accepted') {
        current.participating.push(participation.user);
      } else if (participation.participationStatus === 'pending') {
        current.pending.push(participation);
      }
      historicalByTeam.set(teamKey, current);
    });

  const sections = teamBuckets.map((bucket) => {
    const participating = bucket.players.filter(
      (/** @type {User} */ player) => participatingKeys.has(getUserKey(player)),
    );
    const missing = bucket.players.filter(
      (/** @type {User} */ player) => missingKeys.has(getUserKey(player)),
    );
    const pending = bucket.players
      .map((/** @type {User} */ player) => pendingByUserKey.get(getUserKey(player)))
      .filter(Boolean);
    const notAnswered = bucket.players.filter((/** @type {User} */ player) => {
      const key = getUserKey(player);
      return !participatingKeys.has(key) && !missingKeys.has(key) && !pendingByUserKey.has(key);
    });

    const historical = historicalByTeam.get(bucket.key) || {
      missing: [],
      participating: [],
      pending: [],
    };

    return {
      ...bucket,
      allowCoachActions: canEdit,
      historical: {
        missing: uniqueUsers(historical.missing || []),
        participating: uniqueUsers(historical.participating || []),
        pending: historical.pending || [],
      },
      missing: uniqueUsers(missing),
      notAnswered: uniqueUsers(notAnswered),
      participating: uniqueUsers(participating),
      pending,
    };
  });

  const existingSectionKeys = new Set(sections.map((section) => section.key));
  historicalByTeam.forEach((historicalSection, key) => {
    if (existingSectionKeys.has(key)) return;
    sections.push({
      allowCoachActions: false,
      historical: {
        missing: uniqueUsers(historicalSection.missing || []),
        participating: uniqueUsers(historicalSection.participating || []),
        pending: historicalSection.pending || [],
      },
      isHome: false,
      key,
      missing: [],
      notAnswered: [],
      participating: [],
      pending: [],
      players: [],
      teamName: historicalSection.teamName,
    });
  });

  const externalParticipating = uniqueUsers(
    participatingUsers.filter(
      (/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user)),
    ),
  );
  const externalMissing = uniqueUsers(
    missingUsers.filter((/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user))),
  );
  // P1-17 : un encadrant n est pas un participant externe.
  const externalPending = pendingParticipations.filter((participation) => {
    const key = getUserKey(participation?.user);
    return !trainerKeys.has(key) && !knownTeamPlayerKeys.has(key);
  });
  const externalHistorical = {
    missing: uniqueUsers(historicalExternal.missing || []),
    participating: uniqueUsers(historicalExternal.participating || []),
    pending: historicalExternal.pending || [],
  };

  const hasExternalData = externalParticipating.length > 0
    || externalMissing.length > 0
    || externalPending.length > 0
    || externalHistorical.participating.length > 0
    || externalHistorical.missing.length > 0
    || externalHistorical.pending.length > 0;

  const visibleParticipating = uniqueUsers([
    ...sections.flatMap((section) => section.participating || []),
    ...externalParticipating,
  ]);

  // 🕶️ MASQUE (22/09) — IDENTITES MASQUEES : toutes les listes de noms
  // ci-dessus sont VIDES (aucun jeton n a de cle), et c est voulu. Les nombres,
  // eux, sont dans les listes recues : un jeton par personne.
  // ponytail: un encadrant qui repond compte parmi les presents ou les absents —
  // la charge masquee ne le distingue pas d un joueur (COACH1 l ecarte quand
  // les noms sont visibles) — et « sans reponse » se lit par soustraction sur
  // les jetons de joueurs, donc trop bas d autant. Le chiffre exact demande que
  // le serveur envoie ses propres comptes (lot serveur, non demande).
  const anonymousParticipating = countAnonymousUsers(event?.participations);
  const anonymousMissing = countAnonymousUsers(event?.missings);
  const anonymousPlayers = [event?.team, ...(event?.invitedTeams || [])]
    .reduce((total, team) => total + countAnonymousUsers(team?.players), 0);
  const hasAnonymousUsers = anonymousParticipating + anonymousMissing + anonymousPlayers > 0;

  return {
    externalParticipationSection: hasExternalData
      ? {
        allowCoachActions: canEdit,
        historical: externalHistorical,
        isExternal: true,
        key: 'external-participants',
        missing: externalMissing,
        notAnswered: [],
        participating: externalParticipating,
        pending: externalPending,
        players: [],
        teamName: 'Participants externes',
      }
      : null,
    participantsSummary: {
      // 🕶️ MASQUE — absent quand les noms sont visibles : la forme d avant reste.
      anonymousCounts: hasAnonymousUsers
        ? {
          missing: anonymousMissing,
          notAnswered: Math.max(0, anonymousPlayers - anonymousParticipating - anonymousMissing),
          participating: anonymousParticipating,
        }
        : undefined,
      capacity: Number(event?.capacity || 0),
      participatingCount: visibleParticipating.length + anonymousParticipating,
    },
    teamParticipationSections: sections,
  };
};

/**
 * Les trois listes A PLAT (sans equipes). Pour qui n organise pas : les
 * presents seulement, comme sur le telephone.
 * @param {{
 *   canEdit: boolean;
 *   event: any;
 *   pendingParticipations: EventParticipation[];
 *   trainerKeys: Set<string | null>;
 * }} params
 * @returns {{ missing: User[]; notAnswered: User[]; participating: User[] }}
 */
export const buildParticipationsByStatus = ({
  canEdit,
  event,
  pendingParticipations,
  trainerKeys,
}) => {
  if (!canEdit) {
    return {
      missing: [],
      notAnswered: [],
      participating: filterUsersByExcludedKeys(event?.participations || [], trainerKeys),
    };
  }

  const teamPlayers = uniqueUsers([
    ...getEligibleTeamPlayers(event?.team),
    ...((event?.invitedTeams || []).flatMap(
      (/** @type {any} */ team) => getEligibleTeamPlayers(team),
    )),
  ]);
  const participatingPlayers = filterUsersByExcludedKeys(event?.participations || [], trainerKeys);
  const missingPlayers = filterUsersByExcludedKeys(event?.missings || [], trainerKeys);
  const pendingKeys = new Set(
    (pendingParticipations || [])
      .map((participation) => getUserKey(participation?.user))
      .filter((key) => Boolean(key) && !trainerKeys.has(key)),
  );

  const notAnsweredPlayers = teamPlayers.filter((player) => {
    const key = getUserKey(player);
    return !participatingPlayers.some(
      (/** @type {User} */ participant) => getUserKey(participant) === key,
    )
      && !missingPlayers.some((/** @type {User} */ missing) => getUserKey(missing) === key)
      && !pendingKeys.has(key);
  });

  return {
    missing: missingPlayers,
    notAnswered: notAnsweredPlayers,
    participating: participatingPlayers,
  };
};
