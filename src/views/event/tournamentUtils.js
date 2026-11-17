import i18next from 'i18next';

import { computeAge } from '@/domains/playerCard/cardModel';

export const normalizeTournamentText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const TOURNAMENT_ACTIVE_MEMBER_STATUSES = ['pending', 'present', 'absent'];
export const TOURNAMENT_PENDING_MEMBER_STATUSES = ['invited', 'requested'];

export const isTournamentActiveMemberStatus = (status) => (
  TOURNAMENT_ACTIVE_MEMBER_STATUSES.includes(normalizeTournamentText(status))
);

export const isTournamentPendingMembershipStatus = (status) => (
  TOURNAMENT_PENDING_MEMBER_STATUSES.includes(normalizeTournamentText(status))
);

export const getTournamentMemberBuckets = (members = []) => {
  const safeMembers = Array.isArray(members) ? members : [];

  return safeMembers.reduce((summary, member) => {
    const status = normalizeTournamentText(member?.responseStatus);
    if (status === 'removed') return summary;
    if (status === 'invited') {
      return { ...summary, invitedMembers: [...summary.invitedMembers, member] };
    }
    if (status === 'requested') {
      return { ...summary, requestedMembers: [...summary.requestedMembers, member] };
    }
    if (status === 'declined') {
      return { ...summary, declinedMembers: [...summary.declinedMembers, member] };
    }
    if (TOURNAMENT_ACTIVE_MEMBER_STATUSES.includes(status)) {
      return { ...summary, activeMembers: [...summary.activeMembers, member] };
    }
    return summary;
  }, {
    activeMembers: [],
    declinedMembers: [],
    invitedMembers: [],
    requestedMembers: [],
  });
};

export const getTournamentRosterMembers = (members = []) => (
  getTournamentMemberBuckets(members).activeMembers
);

// T-JOUEURS (17/11/2026, Adel « joueurs- B ») — LE RÉSUMÉ DES JOUEURS RENDU PAR LE SERVEUR
// (`membersSummary`, admin tournament-payment.js `membersSummaries`) :
// `{ count, paidCount, pendingCount, list: [{ firstName, lastInitial, paid }] }`.
// Personne d'autre que le SuperAdmin ne lit les membres d'une équipe : `members` arrive vide et
// la carte disait « 0 joueur ». Absent (serveur plus ancien) : `null`, l'affichage d'avant reste.
// Témoin : tournamentMembersSummary.test.js.

/**
 * Le résumé des joueurs d'une équipe, lu et borné.
 * @param {any} team - L'équipe telle que la fiche la reçoit.
 * @returns {any} Le résumé, ou `null` sans résumé.
 */
export const getTournamentMembersSummary = (team) => {
  const summary = team?.membersSummary;
  if (!summary || typeof summary !== 'object') return null;
  if (!Number.isFinite(Number(summary.count))) return null;
  const list = Array.isArray(summary.list) ? summary.list : [];
  return {
    count: Number(summary.count),
    list: list.map((/** @type {any} */ item) => ({
      firstName: String(item?.firstName || '').trim(),
      lastInitial: String(item?.lastInitial || '').trim(),
      paid: item?.paid === true,
    })),
    paidCount: Number(summary.paidCount) || 0,
    pendingCount: Number(summary.pendingCount) || 0,
  };
};

/**
 * Le tournoi est-il payant ?
 * @param {any} tournamentConfig - Le réglage du tournoi.
 * @returns {boolean} Vrai si la place est payante.
 */
const isPaidTournament = (tournamentConfig) => Number(tournamentConfig?.entryFeeCents) > 0;

/**
 * « 3 joueurs · 1 payé · 2 en attente » (tournoi payant) ou « 3 joueurs ».
 * @param {any} membersSummary - Le résumé lu (`getTournamentMembersSummary`).
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {string | null} La ligne de la carte, `null` sans résumé.
 */
export const getTournamentMembersSummaryLine = (membersSummary, tournamentConfig = {}) => {
  if (!membersSummary) return null;
  const parts = [i18next.t('tournamentManagement.rosterTotal', '{{count}} joueurs', {
    count: membersSummary.count,
  })];
  if (isPaidTournament(tournamentConfig)) {
    parts.push(
      i18next.t('tournamentManagement.rosterPaid', '{{count}} payés', {
        count: membersSummary.paidCount,
      }),
      i18next.t('tournamentManagement.rosterPending', '{{count}} en attente', {
        count: membersSummary.pendingCount,
      }),
    );
  }
  return parts.join(' · ');
};

/**
 * « Samir B. · payé » / « Lina D. · en attente » (payant), « Samir B. » sinon ; masqué : « Joueur »
 * @param {any} item - Un joueur du résumé.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {string} La ligne du joueur.
 */
export const formatTournamentPlayerShortLine = (item, tournamentConfig = {}) => {
  const initial = item?.lastInitial ? `${item.lastInitial}.` : '';
  const name = [item?.firstName, initial].filter(Boolean).join(' ')
    || i18next.t('tournamentManagement.playerAnonymous', 'Joueur');
  if (!isPaidTournament(tournamentConfig)) return name;
  const state = item?.paid === true
    ? i18next.t('tournamentManagement.playerPaid', 'payé')
    : i18next.t('eventDetails.pendingLower', 'en attente');
  return `${name} · ${state}`;
};

/**
 * Les lignes courtes de tous les joueurs du résumé, une par ligne (cartes de l'app et du site).
 * @param {any} membersSummary - Le résumé lu.
 * @param {any} [tournamentConfig] - Le réglage du tournoi.
 * @returns {string} Le texte de la liste ('' sans joueur).
 */
export const formatTournamentPlayersShortList = (membersSummary, tournamentConfig = {}) => (
  (membersSummary?.list || [])
    .map((/** @type {any} */ player) => formatTournamentPlayerShortLine(player, tournamentConfig))
    .join('\n')
);

export const getTournamentRosterSummary = (team, tournamentConfig = {}) => {
  const buckets = getTournamentMemberBuckets(team?.members || []);
  const membersSummary = getTournamentMembersSummary(team);
  const rosterMembers = buckets.activeMembers;
  const presentCount = rosterMembers.filter((member) => normalizeTournamentText(member?.responseStatus) === 'present').length;
  const absentCount = rosterMembers.filter((member) => normalizeTournamentText(member?.responseStatus) === 'absent').length;
  const pendingCount = rosterMembers.filter((member) => normalizeTournamentText(member?.responseStatus) === 'pending').length;
  const minRosterSize = Number.isFinite(Number(tournamentConfig?.minRosterSize))
    ? Number(tournamentConfig.minRosterSize)
    : null;
  const maxRosterSize = Number.isFinite(Number(tournamentConfig?.maxRosterSize))
    ? Number(tournamentConfig.maxRosterSize)
    : null;
  // T-JOUEURS : le nombre de la carte vient du résumé du serveur quand il est là.
  const totalCount = membersSummary ? membersSummary.count : rosterMembers.length;
  const shouldApplyMinRoster = normalizeTournamentText(team?.sourceType) !== 'club_team';
  const meetsMinRoster = !shouldApplyMinRoster || !minRosterSize || totalCount >= minRosterSize;
  const meetsMaxRoster = !maxRosterSize || totalCount <= maxRosterSize;

  return {
    absentCount,
    hasWarning: !meetsMinRoster || !meetsMaxRoster,
    invitedCount: buckets.invitedMembers.length,
    maxRosterSize,
    meetsMaxRoster,
    meetsMinRoster,
    membersSummary,
    minRosterSize,
    pendingCount,
    presentCount,
    requestedCount: buckets.requestedMembers.length,
    totalCount,
  };
};

export const isTournamentTeamNonCompliant = (team, tournamentConfig = {}) => {
  const summary = getTournamentRosterSummary(team, tournamentConfig);
  return summary.hasWarning;
};

export const getTournamentTeamStatusMeta = (status, colors) => {
  const normalized = normalizeTournamentText(status);
  if (normalized === 'accepted') {
    return { label: i18next.t('tournamentUtils.approved', 'Validée'), tone: colors.success500 };
  }
  if (normalized === 'declined') {
    return { label: i18next.t('tournamentUtils.declined', 'Refusée'), tone: colors.error500 };
  }
  if (normalized === 'archived') {
    return { label: i18next.t('tournamentUtils.archived', 'Archivée'), tone: colors.neutral300 };
  }
  return { label: i18next.t('tournamentUtils.pending', 'En attente'), tone: colors.warning500 };
};

export const getTournamentStatusCounters = (teams = [], tournamentConfig = {}) => teams.reduce((summary, team) => {
  const status = normalizeTournamentText(team?.status);
  const nextSummary = { ...summary };

  if (status === 'accepted') nextSummary.accepted += 1;
  else if (status === 'declined') nextSummary.declined += 1;
  else if (status === 'archived') nextSummary.archived += 1;
  else nextSummary.pending += 1;

  if (isTournamentTeamNonCompliant(team, tournamentConfig)) {
    nextSummary.warning += 1;
  }

  return nextSummary;
}, {
  accepted: 0,
  archived: 0,
  declined: 0,
  pending: 0,
  warning: 0,
});

/**
 * T-PARCOURS-2 (17/11, point 3) — LA LIGNE DU LECTEUR dans une équipe de tournoi. Personne n'a
 * `tournament-team-member.find` : le serveur retire `members` de la fiche et rend, par équipe, le
 * statut du lecteur seul (`viewerMembership`). Sans elle, la fiche proposait « Créer une équipe »
 * à qui en avait déjà une. Une charge qui porte encore `members` reste lue comme avant.
 * @param {any} team - L'équipe du tournoi.
 * @param {string} [userDocumentId] - Le compte connecté.
 * @param {(status: any) => boolean} [matchesStatus] - Le statut attendu (tous, par défaut).
 * @returns {any} Sa ligne (`responseStatus`), ou null.
 */
export const getTournamentViewerMember = (
  team,
  userDocumentId = '',
  matchesStatus = () => true,
) => {
  if (!userDocumentId) return null;
  const members = Array.isArray(team?.members) ? team.members : [];
  const row = members.find((/** @type {any} */ member) => (
    member?.user?.documentId === userDocumentId && matchesStatus(member?.responseStatus)
  ));
  if (row) return row;
  const viewer = team?.viewerMembership;
  return viewer?.responseStatus && matchesStatus(viewer.responseStatus) ? viewer : null;
};

export const getTournamentPendingMembershipForUser = (teams = [], userDocumentId = '') => {
  if (!userDocumentId) return null;

  return (Array.isArray(teams) ? teams : []).find((team) => (
    getTournamentViewerMember(team, userDocumentId, isTournamentPendingMembershipStatus)
  )) || null;
};

export const getTournamentFormatLabel = (formatMode) => {
  const normalized = normalizeTournamentText(formatMode);
  if (normalized === 'groups_to_knockout') {
    return i18next.t(
      'tournamentUtils.groupsFinal',
      'Poules + finale',
    );
  }
  if (normalized === 'knockout_only') {
    return i18next.t(
      'tournamentUtils.straightKnockout',
      'Phase finale directe',
    );
  }
  if (normalized === 'round_robin') return i18next.t('tournamentUtils.league', 'Championnat');
  return i18next.t('tournamentUtils.groupsOnly', 'Poules uniquement');
};

export const getTournamentCompetitionStateLabel = (competitionState) => {
  const normalized = normalizeTournamentText(competitionState);
  if (normalized === 'published') {
    return i18next.t(
      'tournamentUtils.competitionPublished',
      'Compétition publiée',
    );
  }
  return i18next.t('tournamentUtils.competitionInDraft', 'Compétition en brouillon');
};

export const getTournamentMatchStatusMeta = (status, colors) => {
  const normalized = normalizeTournamentText(status);
  if (normalized === 'validated') {
    return {
      label: i18next.t(
        'tournamentUtils.validated',
        'Valide',
      ),
      tone: colors.success500,
    };
  }
  if (normalized === 'forfeit') {
    return {
      label: i18next.t(
        'tournamentUtils.forfeit',
        'Forfait',
      ),
      tone: colors.warning500,
    };
  }
  if (normalized === 'played_pending_validation') return { label: i18next.t('tournamentUtils.scoreToApprove', 'Score à valider'), tone: colors.warning500 };
  if (normalized === 'scheduled') {
    return {
      label: i18next.t(
        'tournamentUtils.scheduled',
        'Programme',
      ),
      tone: colors.primary500,
    };
  }
  if (normalized === 'ready') {
    return {
      label: i18next.t(
        'tournamentUtils.readyToPlay',
        'Prêt à jouer',
      ),
      tone: colors.primary500,
    };
  }
  if (normalized === 'cancelled') {
    return {
      label: i18next.t(
        'tournamentUtils.cancelled',
        'Annule',
      ),
      tone: colors.error500,
    };
  }
  return { label: i18next.t('tournamentUtils.draft', 'Brouillon'), tone: colors.neutral300 };
};

export const getTournamentCompetitionActions = (dashboard) => {
  const overview = dashboard?.overview || {};
  const config = dashboard?.config || {};
  const competitionState = normalizeTournamentText(config?.competitionState);
  const groupCount = Number(overview?.groups || 0);
  const totalMatches = Number(overview?.totalMatches || 0);
  const hasBracket = Array.isArray(dashboard?.bracket) && dashboard.bracket.length > 0;
  const usesGroups = ['groups_only', 'groups_to_knockout', 'round_robin'].includes(normalizeTournamentText(config?.formatMode));
  const usesKnockout = ['groups_to_knockout', 'knockout_only'].includes(normalizeTournamentText(config?.formatMode));

  return {
    canDrawGroups: competitionState !== 'published' && usesGroups,
    // T-LIGUE-2 : publiee au tirage, la ligue garde une fois sa phase finale (le serveur fait foi).
    canGenerateKnockout: usesKnockout && (competitionState !== 'published'
      || (normalizeTournamentText(config?.formatMode) === 'groups_to_knockout' && !hasBracket)),
    canGenerateMatches: competitionState !== 'published' && (
      (usesGroups && groupCount > 0)
      || normalizeTournamentText(config?.formatMode) === 'knockout_only'
    ),
    canPublish: competitionState !== 'published' && (
      totalMatches > 0 || hasBracket
    ),
    hasBracket,
    usesGroups,
    usesKnockout,
  };
};

// REPRISE-TEXTES (point 24) : le serveur écrivait « Journee » dans `roundLabel` jusqu'au 01/11.
// ponytail: les matchs déjà créés gardent ce texte en base, on le répare à l'affichage. Sortie :
// une reprise des données (recette puis production), puis retirer ce remplacement.
export const formatTournamentRoundLabel = (
  /** @type {string | null | undefined} */ label,
) => String(label || '').replace(/\bJournee\b/g, 'Journée');

export const formatTournamentScore = (match) => {
  const hasScoreA = match?.scoreA !== null
    && match?.scoreA !== undefined
    && match?.scoreA !== ''
    && Number.isFinite(Number(match?.scoreA));
  const hasScoreB = match?.scoreB !== null
    && match?.scoreB !== undefined
    && match?.scoreB !== ''
    && Number.isFinite(Number(match?.scoreB));
  if (!hasScoreA || !hasScoreB) return '--';
  return `${Number(match.scoreA)} - ${Number(match.scoreB)}`;
};

/**
 * CORR-EVENEMENTS 131 — un tournoi clôturé (`sessionStatus` « closed », posé par
 * `closeTournament`) se lit, il ne se pilote plus. Le serveur n'écrit pas de date de clôture :
 * celle de l'archivage des équipes, la plus récente, en tient lieu. Le pilotage et les deux
 * fiches (site et téléphone) lisent CETTE règle.
 * FIN-EVENEMENTS (NOTE-132) : `sessionStatus` « closed » veut AUSSI dire « Privé », choisi à la
 * création. Sans équipe archivée, rien ne prouve une clôture : la fiche d'un tournoi privé neuf
 * ne dit pas « clôturé » et garde son menu, donc « Annuler ».
 * ponytail: un tournoi clôturé sans aucune équipe se lit comme privé (le serveur refuse quand
 * même ses gestes). Sortie : une date de clôture écrite par le serveur (NOTE-132, option B).
 * @param {any} event - L'événement tournoi, avec `sessionStatus` et `tournamentTeams`.
 * @returns {{ closedAt: number | undefined, isClosed: boolean }} - L'état et sa date.
 */
export const getTournamentClosure = (event) => {
  const closedAt = (Array.isArray(event?.tournamentTeams) ? event.tournamentTeams : [])
    .map((/** @type {any} */ team) => Date.parse(team?.archivedAt || ''))
    .filter(Number.isFinite)
    .sort((/** @type {number} */ gauche, /** @type {number} */ droite) => droite - gauche)[0];
  // T3-TOURNOI-PRIVE : le serveur date la clôture. Sans date, un ancien tournoi clôturé a archivé
  // TOUTES ses équipes ; une seule équipe archivée par l'organisateur ne clôt rien.
  const dateDuServeur = Date.parse(event?.tournamentConfig?.closedAt || '');
  if (Number.isFinite(dateDuServeur)) return { closedAt: dateDuServeur, isClosed: true };
  const estFerme = String(event?.sessionStatus || '').toLowerCase() === 'closed';
  const equipes = Array.isArray(event?.tournamentTeams) ? event.tournamentTeams : [];
  const toutesArchivees = equipes.length > 0
    && equipes.every((/** @type {any} */ team) => (
      String(team?.status || '').toLowerCase() === 'archived'
    ));
  return { closedAt, isClosed: estFerme && toutesArchivees && closedAt !== undefined };
};

/**
 * CORR-EVENEMENTS 129 (décision B) — un effectif minimum saisi vaut au moins 1. Les réglages du
 * tournoi et l'assistant de création lisent CETTE règle (REPRISE-EVENEMENTS 129).
 * @param {string | number | null | undefined} minRosterText - L'effectif minimum saisi.
 * @returns {boolean} - Vrai si une valeur est saisie et qu'elle vaut moins de 1.
 */
export const isTournamentMinRosterTooLow = (minRosterText) => {
  const saisi = String(minRosterText ?? '').trim();
  return saisi !== '' && !(Number.parseInt(saisi, 10) >= 1);
};

/**
 * CORR-EVENEMENTS 129 (décision B) — une poule compte au moins 2 équipes : au plus
 * équipes ÷ 2 poules. Sans format à poules (ou en championnat), rien à borner.
 * @param {{ formatMode: string, groupCount: number, teamCount: number }} reglages - Le format,
 *   le nombre de poules demandé et le nombre d'équipes (acceptées, sinon le maximum prévu).
 * @returns {{ isGroupCountTooHigh: boolean, maxGroupCount: number }} - Le plafond et le verdict.
 */
export const getTournamentGroupBounds = ({ formatMode, groupCount, teamCount }) => {
  const maxGroupCount = Math.max(1, Math.floor(teamCount / 2));
  const usesGroups = ['groups_only', 'groups_to_knockout'].includes(formatMode);
  return {
    isGroupCountTooHigh: usesGroups && teamCount >= 2 && groupCount > maxGroupCount,
    maxGroupCount,
  };
};

/**
 * T-FINITIONS2 (16/11, chef « go a+b ») — une équipe de club peut-elle être inscrite à ce tournoi ?
 * Même règle que le serveur (admin `tournament-team.js`, `registerClubTeam`) : un tournoi privé
 * (`sessionStatus: 'closed'`) prend une équipe de tout club, l'organisateur tranche ; sinon,
 * seules les équipes du club organisateur. Un club inconnu d'un côté ne bloque pas (serveur idem).
 * @param {any} event
 * @param {any} sourceTeam
 * @returns {boolean}
 */
export const canRegisterSourceTeamToTournament = (event, sourceTeam) => {
  if (normalizeTournamentText(event?.sessionStatus) === 'closed') return true;
  const eventClubId = String(event?.club?.documentId || '').trim();
  const teamClubId = String(sourceTeam?.club?.documentId || '').trim();
  return !eventClubId || !teamClubId || eventClubId === teamClubId;
};

// T-FINITIONS-3 (16/11, tournoi du 19/12) — L AGE MINIMUM D UN TOURNOI (`tournamentConfig.minAge`),
// lu comme le
// serveur (admin tournament-team.js `getTournamentConfig` et `assertTargetUserAgeAllowed`) : un
// nombre > 0, l age
// compte AU JOUR DU TOURNOI. Age inconnu : rien ne change ici, le serveur tranche (« renseigne ta
// date »).
/**
 * L age minimum du tournoi.
 * @param {any} event - le tournoi.
 * @returns {number | null} l age minimum, ou `null` sans regle.
 */
export const getTournamentMinAge = (event) => {
  const minAge = Number(event?.tournamentConfig?.minAge);
  return minAge > 0 ? Math.round(minAge) : null;
};

/**
 * Le compte est-il trop jeune pour ce tournoi ?
 * @param {any} event - le tournoi.
 * @param {any} user - le compte (`birthdate`).
 * @returns {boolean} vrai seulement si l age est connu et sous `minAge` au jour du tournoi.
 */
export const isTooYoungForTournament = (event, user) => {
  const minAge = getTournamentMinAge(event);
  if (!minAge) return false;
  const jour = event?.date ? new Date(event.date) : new Date();
  const age = computeAge(user?.birthdate, Number.isNaN(jour.getTime()) ? new Date() : jour);
  return age !== null && age < minAge;
};

/**
 * La phrase montree a la place des boutons d inscription.
 * @param {any} event - le tournoi.
 * @returns {string}
 */
export const getTournamentAgeNotice = (event) => i18next.t(
  'tournamentUtils.openFromAge',
  'Ce tournoi est ouvert à partir de {{minAge}} ans.',
  { minAge: getTournamentMinAge(event) },
);

/**
 * « A partir de {minAge} ans » remplace l age de la categorie (« Sénior (+18 ans) ») quand le
 * tournoi a un age
 * minimum ; sinon la categorie reste.
 * @param {any} event - le tournoi.
 * @param {string | null | undefined} categoryLabel - le nom de la categorie.
 * @returns {string | null | undefined}
 */
export const getTournamentCategoryLabel = (event, categoryLabel) => {
  const minAge = getTournamentMinAge(event);
  return minAge
    ? i18next.t('tournamentUtils.fromAge', 'À partir de {{minAge}} ans', { minAge })
    : categoryLabel;
};

/**
 * Une equipe que le joueur seul peut demander a rejoindre (meme regle que le serveur `requestJoin`)
 * : equipe
 * ephemere, ouverte aux demandes, ni refusee ni archivee. Regle unique de l app et du site.
 * @param {any} team - l equipe du tournoi.
 * @returns {boolean}
 */
export const isTournamentTeamOpenToJoinRequests = (team) => {
  if (!team?.documentId) return false;
  if (normalizeTournamentText(team?.sourceType) !== 'custom_team') return false;
  if (team?.isOpenToJoinRequests !== true) return false;
  return !['archived', 'declined'].includes(normalizeTournamentText(team?.status));
};

// T-PARCOURS-2, point 1 (17/11) : le prix d un tournoi payant, par joueur, au format de la carte
// d equipe (TournamentMemberPlace : « 20 € par joueur ») ; `null` sur un tournoi gratuit.
// Récolte du train 12, « P7 prix C » (chef, 17/11) : sans montant encaissé, le prix saisi par
// l organisateur (`pricePerPerson`, en euros) au même format ; jamais « Gratuit » sur un prix
// saisi.
/**
 * Le prix par joueur d un tournoi payant, ou `null`.
 * @param {any} event - le tournoi.
 * @returns {string | null}
 */
export const getTournamentEntryFeeLabel = (event) => {
  const cents = Number(event?.tournamentConfig?.entryFeeCents);
  const fee = Math.round(cents > 0 ? cents : Number(event?.pricePerPerson) * 100);
  if (!Number.isFinite(fee) || fee <= 0) return null;
  return i18next.t('tournamentUtils.entryFeePerPlayer', {
    amount: `${(fee / 100).toLocaleString('fr-FR')} €`,
    defaultValue: '{{amount}} par joueur',
  });
};

// T-FINITIONS-3, ajout du chef (17/11, recette 41) — le serveur (tournament-payment.js
// `recountTeam`) valide une equipe `pending` d un tournoi PAYANT (`entryFeeCents` > 0) quand ses
// places payees atteignent `paidMembersToValidate` (5 par defaut), quel que soit
// `registrationMode` ; « auto » la valide a la creation.
/**
 * La regle de validation d un tournoi payant en mode manuel, ou `null` (le libelle d avant reste).
 * @param {any} event - le tournoi.
 * @returns {string | null}
 */
export const getTournamentPaidValidationLabel = (event) => {
  const config = event?.tournamentConfig || {};
  if (config.registrationMode === 'auto') return null;
  const fee = Math.round(Number(config.entryFeeCents));
  if (!Number.isFinite(fee) || fee <= 0) return null;
  const seuil = Math.round(Number(config.paidMembersToValidate));
  const count = Number.isFinite(seuil) && seuil > 0 ? seuil : 5;
  return i18next.t('tournamentUtils.validatedAtPaid', {
    count,
    defaultValue_one: 'Équipe validée au 1er joueur payé',
    defaultValue_other: 'Équipe validée au {{count}}ᵉ joueur payé',
  });
};
