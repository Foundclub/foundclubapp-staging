import i18next from 'i18next';

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

export const getTournamentRosterSummary = (team, tournamentConfig = {}) => {
  const buckets = getTournamentMemberBuckets(team?.members || []);
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
  const totalCount = rosterMembers.length;
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

export const getTournamentPendingMembershipForUser = (teams = [], userDocumentId = '') => {
  if (!userDocumentId) return null;

  return (Array.isArray(teams) ? teams : []).find((team) => (
    Array.isArray(team?.members)
    && team.members.some((member) => (
      member?.user?.documentId === userDocumentId
      && isTournamentPendingMembershipStatus(member?.responseStatus)
    ))
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
    canGenerateKnockout: competitionState !== 'published' && usesKnockout,
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
 * @param {any} event - L'événement tournoi, avec `sessionStatus` et `tournamentTeams`.
 * @returns {{ closedAt: number | undefined, isClosed: boolean }} - L'état et sa date.
 */
export const getTournamentClosure = (event) => ({
  closedAt: (Array.isArray(event?.tournamentTeams) ? event.tournamentTeams : [])
    .map((/** @type {any} */ team) => Date.parse(team?.archivedAt || ''))
    .filter(Number.isFinite)
    .sort((/** @type {number} */ gauche, /** @type {number} */ droite) => droite - gauche)[0],
  isClosed: String(event?.sessionStatus || '').toLowerCase() === 'closed',
});

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
