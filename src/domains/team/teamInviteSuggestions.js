/**
 * teamInviteSuggestions.js — INVIT2 : ce que la feuille « Inviter dans l'équipe » dit
 * de chaque personne proposée, de chaque invitation envoyée, et le texte partagé.
 *
 * 🧱 MODULE 100 % PUR (i18next et deux modules purs) — même règle que teamInvitation.js :
 * un service réseau importé ici ferait tomber toutes les suites de la fiche d'équipe.
 */
import i18next from 'i18next';

import {
  describePersonName,
  readPersonId,
  selectInvitableCandidates,
} from '@/domains/team/teamInvitation';
// Les noms viennent du serveur et partent dans un texte : jamais échappés en HTML.
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * Pourquoi cette personne est proposée, en une phrase.
 * @param {{ reason?: string, reasonDate?: string | null, reasonLabel?: string }} suggestion
 * - la proposition.
 * @param {(iso: string) => string} formatDate - « 12/09 ».
 * @returns {string} la phrase, ou une chaîne vide.
 */
export const describeSuggestionReason = (suggestion, formatDate) => {
  const label = String(suggestion?.reasonLabel || '').trim();
  switch (suggestion?.reason) {
    case 'applied':
      return label
        ? i18next.t(
          'teamInviteSheet.reason.appliedTo',
          'A candidaté : {{label}}',
          { label, ...SANS_ECHAPPEMENT },
        )
        : i18next.t('teamInviteSheet.reason.applied', 'A candidaté à une annonce de l\'équipe');
    case 'club':
      return i18next.t('teamInviteSheet.reason.club', 'Membre de ton club');
    case 'clubStaff':
      return i18next.t('teamInviteSheet.reason.clubStaff', 'Encadrant de ton club');
    case 'otherTeam':
      return label
        ? i18next.t(
          'teamInviteSheet.reason.otherTeam',
          'Joue en {{label}}',
          { label, ...SANS_ECHAPPEMENT },
        )
        : i18next.t(
          'teamInviteSheet.reason.otherTeamUnnamed',
          'Joue dans une autre équipe du club',
        );
    case 'requested':
      return suggestion?.reasonDate
        ? i18next.t(
          'teamInviteSheet.reason.requestedOn',
          'A demandé à rejoindre l\'équipe le {{date}}',
          { ...SANS_ECHAPPEMENT, date: formatDate(String(suggestion.reasonDate)) },
        )
        : i18next.t('teamInviteSheet.reason.requested', 'A demandé à rejoindre l\'équipe');
    default:
      return '';
  }
};

/**
 * La liste de la feuille : les propositions du serveur quand elles sont là, sinon
 * les membres du club que la fiche a déjà chargés. Dans les deux cas, ni l'équipe
 * ni moi, filtré par la recherche, et l'état « invitation envoyée » gardé.
 * @param {object} params - les sources.
 * @param {any[]} [params.clubMembers] - `clubData.members`.
 * @param {string} [params.currentUserId] - moi.
 * @param {string[]} [params.invitedIds] - invités pendant que la feuille est ouverte.
 * @param {string} [params.search] - la recherche.
 * @param {any[] | undefined} [params.serverSuggestions] - la réponse du serveur.
 * @param {any} [params.team] - l'équipe (joueurs, encadrants).
 * @returns {any[]} la liste à afficher.
 */
export const selectSheetSuggestions = ({
  clubMembers = [],
  currentUserId = '',
  invitedIds = [],
  search = '',
  serverSuggestions,
  team,
} = {}) => {
  if (!Array.isArray(serverSuggestions)) {
    return selectInvitableCandidates({
      alreadyInvitedIds: invitedIds,
      candidates: clubMembers,
      currentUserId,
      players: team?.players || [],
      search,
      trainers: team?.trainers || [],
    }).map((candidate) => ({ ...candidate, reason: candidate.reason || 'club' }));
  }

  const excluded = new Set([
    ...(team?.players || []).map(readPersonId),
    ...(team?.trainers || []).map(readPersonId),
    String(currentUserId || '').trim(),
  ].filter(Boolean));
  const invited = new Set((invitedIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const needle = String(search || '').trim().toLowerCase();

  // L'ordre du serveur a un SENS (demandes, candidatures, autres équipes, club) :
  // on le garde, on ne retrie pas par nom.
  return serverSuggestions
    .filter((suggestion) => {
      const id = readPersonId(suggestion);
      if (!id || excluded.has(id)) return false;
      if (!needle) return true;
      return describePersonName(suggestion, '').toLowerCase().includes(needle);
    })
    .map((suggestion) => ({
      ...suggestion,
      avatar: suggestion.avatar || (suggestion.avatarUrl ? { url: suggestion.avatarUrl } : null),
      hasPendingInvitation: Boolean(suggestion.hasPendingInvitation)
        || invited.has(readPersonId(suggestion)),
    }));
};

/**
 * L'état d'une invitation envoyée, lisible par le staff.
 * @param {{ expiresAt?: string | null, state?: string }} item - l'invitation.
 * @param {(iso: string) => string} formatDate - « 15/10 ».
 * @returns {string} l'état.
 */
export const describeSentInviteState = (item, formatDate) => {
  switch (item?.state) {
    case 'accepted':
      return i18next.t('teamInviteSheet.sent.accepted', 'Acceptée');
    case 'cancelled':
      return i18next.t('teamInviteSheet.sent.cancelled', 'Annulée');
    case 'expired':
      return i18next.t('teamInviteSheet.sent.expired', 'Expirée');
    case 'refused':
      return i18next.t('teamInviteSheet.sent.refused', 'Refusée');
    default:
      return item?.expiresAt
        ? i18next.t('teamInviteSheet.sent.pendingUntil', 'En attente · expire le {{date}}', {
          ...SANS_ECHAPPEMENT,
          date: formatDate(String(item.expiresAt)),
        })
        : i18next.t('teamInviteSheet.sent.pending', 'En attente');
  }
};

/**
 * La phrase qui accompagne le lien, prête à coller dans WhatsApp ou un SMS.
 * @param {{ clubName?: string, inviterName?: string, teamName?: string }} params - les noms.
 * @returns {string} la phrase.
 */
export const buildTeamInviteShareText = ({ clubName, inviterName, teamName } = {}) => {
  const team = String(teamName || '').trim();
  const club = String(clubName || '').trim();
  const inviter = String(inviterName || '').trim();
  const teamLabel = club
    ? i18next.t(
      'teamInviteShare.teamWithClub',
      '{{team}} ({{club}})',
      { club, team, ...SANS_ECHAPPEMENT },
    )
    : team;
  return inviter
    ? i18next.t(
      'teamInviteShare.messageFrom',
      '{{inviter}} t\'invite à rejoindre l\'équipe {{team}} sur FoundClub.'
      + ' Ouvre ce lien pour voir l\'invitation :',
      { inviter, team: teamLabel, ...SANS_ECHAPPEMENT },
    )
    : i18next.t(
      'teamInviteShare.message',
      'Tu es invité·e à rejoindre l\'équipe {{team}} sur FoundClub.'
      + ' Ouvre ce lien pour voir l\'invitation :',
      { team: teamLabel, ...SANS_ECHAPPEMENT },
    );
};

/**
 * Un numéro plausible : au moins 8 chiffres. Le serveur normalise ; ce contrôle
 * évite seulement d'envoyer un geste dont on sait qu'il sera refusé.
 * ⚠️ Un champ vide n'est PAS un numéro (piège `Number('')`).
 * @param {unknown} value - la saisie.
 * @returns {boolean} vrai si plausible.
 */
export const isPlausibleInvitePhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};
