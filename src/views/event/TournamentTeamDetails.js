import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { resolveEventCustomName } from '@/domains/event/eventDisplayName';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useRetraitBasDuDefilement from '@/components/templates/useRetraitBasDuDefilement';

import { RouteNames } from '@/navigation/routeNames';

import { EVENT_DETAIL_STALE_MS } from '@/services/event/eventCacheDurations';
import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';
import {
  inviteTournamentTeamMember,
  leaveTournamentTeam,
  removeTournamentTeamMember,
  requestJoinTournamentTeam,
  respondToTournamentInvitation,
  respondToTournamentTeam,
  reviewTournamentJoinRequest,
  toggleTournamentTeamOpenRequests,
  transferTournamentTeamCaptain,
} from '@/services/tournamentTeam/tournamentTeamService';
import { searchScopedUsers, searchUsers } from '@/services/user/userService';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getEventLocationText } from '@/utils/eventLocationText';

import useOuvrirLAssistance from '../chat/useOuvrirLAssistance';
import TournamentEssentials, { getTournamentEssentials } from './components/TournamentEssentials';
import TournamentTeamProgress, {
  getTodoDetail,
  getTodoTitle,
  getTournamentTeamProgress,
} from './components/TournamentTeamProgress';
import { openTournamentTerms } from './components/tournamentTerms';
import { createTournamentDesignSystem } from './tournamentDesignSystem';
import { hasTournamentTeamForUser } from './tournamentJoinRules';
import TournamentMemberConsent from './TournamentMemberConsent';
import { TournamentMemberPlace } from './TournamentMemberPlace';
import TournamentTeamDiscussion from './TournamentTeamDiscussion';
import {
  getTournamentAgeNotice,
  getTournamentEntryFeeLabel,
  getTournamentMemberBuckets,
  getTournamentRosterSummary,
  isTooYoungForTournament,
  isTournamentActiveMemberStatus,
  normalizeTournamentText,
} from './tournamentUtils';
import { getWithdrawalWindow } from './tournamentWithdrawal';

// T-PAGES-2 (17/11/2026) — « VOIR MON ÉQUIPE », maquette validée DESIGN-TOURNOI-PAGES (c), un seul
// fichier pour le site et le téléphone. Ordre : retour au tournoi, où en est l'équipe
// (TournamentTeamProgress), à faire maintenant (capitaine), effectif avec ses places libres et le
// menu à trois points de chaque joueur, puis le tournoi en bref, inviter, discussion ; au-delà de
// 860 px, ces trois derniers passent dans une colonne de droite. Vue d'un joueur (R6) : « Payer ma
// place » en tête, « Quitter l'équipe » tout en bas. Témoins : __tests__/T-PAGES-2.*.test.js.
// La colonne passe à droite au-delà de cette largeur (maquette (c)).
const LARGEUR_DEUX_COLONNES = 860;
const styles = {
  dashed: { borderStyle: /** @type {'dashed'} */ ('dashed') },
  leaveSeparator: { borderTopWidth: 1, paddingTop: 12 },
  spreadWrap: {
    flexWrap: /** @type {'wrap'} */ ('wrap'),
    justifyContent: /** @type {'space-between'} */ ('space-between'),
  },
  twoColumns: {
    alignItems: /** @type {'flex-start'} */ ('flex-start'),
    flexDirection: /** @type {'row'} */ ('row'),
  },
};

/**
 * IMPL-2-EQUIPE — les deux fenêtres (« Inviter un joueur », « Ta place est payée »), chargées à la
 * demande, à leur ouverture.
 * ponytail: BottomModal tire @gorhom/bottom-sheet, que les suites de cette page ne simulent pas
 * toutes ; même règle que le lien d'invitation. Sortie : une doublure commune de BottomModal.
 * @returns {{ BottomModal: any, TournamentInviteSheet: any }} Les composants.
 */
const chargerLesFenetres = () => ({
  // eslint-disable-next-line global-require
  BottomModal: require('@/components/molecules/bottomModal/BottomModal').default,
  // eslint-disable-next-line global-require
  TournamentInviteSheet: require('./components/TournamentInviteSheet').default,
});

const getMemberStatusMeta = (status, colors) => {
  const normalized = normalizeTournamentText(status);
  if (normalized === 'present') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.present',
        'Présent',
      ),
      tone: colors.success500,
    };
  }
  if (normalized === 'absent') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.absent',
        'Absent',
      ),
      tone: colors.error500,
    };
  }
  if (normalized === 'pending') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.memberPending',
        'N’a pas encore répondu présent',
      ),
      tone: colors.warning500,
    };
  }
  if (normalized === 'invited') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.invitationSent',
        'Invitation envoyée',
      ),
      tone: colors.primary500,
    };
  }
  if (normalized === 'requested') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.requestReceived',
        'Demande reçue',
      ),
      tone: colors.warning500,
    };
  }
  if (normalized === 'declined') {
    return {
      label: i18next.t(
        'tournamentTeamDetails.declined',
        'Refusé',
      ),
      tone: colors.error500,
    };
  }
  return { label: i18next.t('tournamentTeamDetails.member', 'Membre'), tone: colors.neutral300 };
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentTeamDetails({ navigation, route }) {
  const { t } = useTranslation();
  const retraitBas = useRetraitBasDuDefilement(12);
  const { eventId, focusSection, teamId } = route?.params || {};
  // T-REGLES-EQUIPE (18/11, point 9) : arrivée par la notification « demande de rejoindre »
  // (notificationNavigation.js, `focusSection: 'requests'`) : la page défile jusqu'aux demandes,
  // une fois par arrivée (nouveaux paramètres de route = nouvelle arrivée).
  const scrollRef = useRef(/** @type {any} */ (null));
  const columnsYRef = useRef(/** @type {number | null} */ (null));
  const requestsYRef = useRef(/** @type {number | null} */ (null));
  const focusDoneForRef = useRef(/** @type {any} */ (null));
  const scrollToFocusedSection = () => {
    if (focusSection !== 'requests' || focusDoneForRef.current === route?.params) return;
    if (columnsYRef.current === null || requestsYRef.current === null) return;
    focusDoneForRef.current = route?.params;
    scrollRef.current?.scrollTo?.({ animated: true, y: columnsYRef.current + requestsYRef.current });
  };
  // Page déjà ouverte dans la pile : les mesures sont là, seuls les paramètres changent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToFocusedSection(); }, [route?.params]);
  const queryClient = useQueryClient();
  const { accountRoleKey, userData } = useAuth();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  // IMPL-2-EQUIPE (18/11, planche 3b) : la fenêtre « Inviter un joueur », son premier écran et la
  // place libre touchée ; (10c, 10d) la fenêtre « Ta place est payée » avant de quitter.
  const [inviteMode, setInviteMode] = useState(/** @type {'choice' | 'search'} */ ('choice'));
  const [inviteSlot, setInviteSlot] = useState(/** @type {number | null} */ (null));
  const [isPaidLeaveOpen, setIsPaidLeaveOpen] = useState(false);
  // T-INVITE (15/11) : « Inviter des joueurs » par lien ; sur un ordinateur le lien est copié,
  // l'écran le dit. États : '' | 'pending' | 'copie' | 'echec'.
  const [inviteLinkState, setInviteLinkState] = useState('');
  const [isJoinRequestModalVisible, setIsJoinRequestModalVisible] = useState(false);
  const [joinRequestError, setJoinRequestError] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const {
    data: team,
    error,
    isLoading,
    refetch,
  } = useGetTournamentTeam(teamId);

  const currentUserDocumentId = userData?.documentId || '';
  // T-PAIE : les places d'un tournoi payant (absent pour un tournoi gratuit ou un vieux serveur).
  const placesByMember = useMemo(() => new Map(
    (team?.payment?.members || [])
      .map((/** @type {any} */ place) => [place?.memberDocumentId, place]),
  ), [team?.payment?.members]);
  const allMembers = useMemo(
    () => (Array.isArray(team?.members) ? team.members : [])
      .filter((member) => normalizeTournamentText(member?.responseStatus) !== 'removed'),
    [team?.members],
  );
  const memberBuckets = useMemo(() => getTournamentMemberBuckets(allMembers), [allMembers]);
  const {
    activeMembers,
    invitedMembers,
    requestedMembers,
  } = memberBuckets;
  const currentMember = useMemo(
    () => allMembers.find((member) => member?.user?.documentId === currentUserDocumentId) || null,
    [allMembers, currentUserDocumentId],
  );
  const currentMemberStatus = normalizeTournamentText(currentMember?.responseStatus);
  const currentMemberIsCaptain = normalizeTournamentText(currentMember?.role) === 'captain'
    || team?.captainUser?.documentId === currentUserDocumentId;
  const canManageTeam = Boolean(
    team?.captainUser?.documentId === currentUserDocumentId
    || (team?.adminUsers || []).some((user) => user?.documentId === currentUserDocumentId),
  );
  const teamIsArchived = normalizeTournamentText(team?.status) === 'archived' || Boolean(team?.archivedAt);
  const teamIsClosed = normalizeTournamentText(team?.event?.sessionStatus) === 'closed'
    || team?.event?.isActive === false;
  const teamIsLocked = teamIsArchived || teamIsClosed;
  const canManageRoster = canManageTeam && !teamIsLocked;
  const canLeaveTeam = Boolean(
    currentMember
    && isTournamentActiveMemberStatus(currentMember?.responseStatus)
    && !currentMemberIsCaptain
    && !teamIsLocked,
  );
  const canUpdateTournamentResponse = Boolean(
    currentMember
    && isTournamentActiveMemberStatus(currentMember?.responseStatus)
    && !currentMemberIsCaptain,
  );
  // PARENT-TOURNOI-LECTURE-2 (31/10) : un compte Parent LIT l'équipe ; rejoindre lui est refusé.
  const canRequestJoinTeam = Boolean(
    accountRoleKey !== 'parent'
    && !teamIsLocked
    && normalizeTournamentText(team?.sourceType) === 'custom_team'
    && team?.isOpenToJoinRequests === true
    && !canManageTeam
    && (!currentMember || currentMemberStatus === 'declined'),
  );
  const engagedMemberUserIds = useMemo(
    () => new Set(
      allMembers
        .filter((member) => !['declined', 'removed'].includes(normalizeTournamentText(member?.responseStatus)))
        .map((member) => member?.user?.documentId)
        .filter(Boolean),
    ),
    [allMembers],
  );
  const sourceTeamEligibleUsers = useMemo(
    () => (Array.isArray(team?.sourceTeam?.players) ? team.sourceTeam.players : [])
      .filter((player) => player?.documentId && !engagedMemberUserIds.has(player.documentId)),
    [engagedMemberUserIds, team?.sourceTeam?.players],
  );
  const tournamentConfig = useMemo(
    () => (team?.event?.tournamentConfig && typeof team.event.tournamentConfig === 'object'
      ? team.event.tournamentConfig
      : {}),
    [team?.event?.tournamentConfig],
  );
  const rosterSummary = useMemo(
    () => getTournamentRosterSummary(team, tournamentConfig),
    [team, tournamentConfig],
  );
  // T-PAGES-1 : l'état de l'équipe et la liste « à faire », calculés une fois pour la carte et
  // pour « À faire maintenant ».
  const progress = useMemo(() => getTournamentTeamProgress({
    members: allMembers,
    payment: team?.payment,
    teamStatus: team?.status,
    tournamentConfig,
  }), [allMembers, team?.payment, team?.status, tournamentConfig]);
  const myPlace = (team?.payment?.members || []).find((/** @type {any} */ place) => place?.isSelf)
    || null;
  const myPlaceDue = Boolean(myPlace && myPlace.status !== 'paid' && myPlace.paymentUrl);
  const isCurrentActiveMember = Boolean(
    currentMember && isTournamentActiveMemberStatus(currentMember?.responseStatus),
  );
  // F22 (recette 42) — une raison de refus connue d'avance se dit AVANT la déclaration, et le
  // bouton n'est pas proposé : l'âge (tournamentConfig.minAge, règle de la fiche), puis une équipe
  // déjà prise dans ce tournoi (`viewerMembership` des équipes de la fiche, même règle que
  // « Rejoindre une équipe », tournamentJoinRules.js). Tant que le tournoi n'est pas lu, pas de
  // bouton (la fiche est en général déjà en mémoire : pas de requête de plus).
  const tooYoung = canRequestJoinTeam && isTooYoungForTournament(team?.event, userData);
  // Même clé que la fiche (`useGetEvent`, ['event', id]) : sa lecture en mémoire sert ici. Le
  // service est chargé à la demande (comme le lien d'invitation) : les suites de cette page n'en
  // simulent pas le réseau.
  // L'identifiant du tournoi : la route, sinon celui que porte l'équipe.
  const tournamentEventId = eventId || team?.event?.documentId || '';
  const tournamentEventQuery = useQuery({
    enabled: Boolean(tournamentEventId && canRequestJoinTeam && !tooYoung),
    queryFn: () => {
      // eslint-disable-next-line global-require
      const { getEventById } = require('@/services/event/eventService');
      return getEventById(tournamentEventId);
    },
    queryKey: ['event', tournamentEventId],
    refetchOnMount: false,
    staleTime: EVENT_DETAIL_STALE_MS,
  });
  const tournamentEvent = tournamentEventQuery.data;
  const alreadyInTeam = Boolean(tournamentEvent) && hasTournamentTeamForUser(
    tournamentEvent?.tournamentTeams,
    currentUserDocumentId,
  );
  // T-SANS-PLAFOND (18/11, Adel D239) : plus d'« Équipe complète » : une équipe n'a plus de nombre
  // maximum de joueurs (remplaçants sans limite, chacun paie sa place).
  let joinBlockedReason = null;
  if (tooYoung) joinBlockedReason = getTournamentAgeNotice(team?.event);
  else if (alreadyInTeam) {
    joinBlockedReason = t(
      'tournamentTeamDetails.joinBlocked.alreadyInTeam',
      'Tu es déjà dans une équipe de ce tournoi : tu ne peux pas en rejoindre une autre.',
    );
  }
  // Une raison INCONNUE ne cache pas le bouton : seul le chargement le retient ; une lecture en
  // échec le laisse (le serveur rejuge tout, `requestJoin`).
  const canShowJoinButton = canRequestJoinTeam && !joinBlockedReason
    && !(tournamentEventQuery.isLoading && !tournamentEvent);
  const { width } = useWindowDimensions();
  const isWide = width >= LARGEUR_DEUX_COLONNES;
  // Le menu à trois points ouvert (un membre à la fois), ou ''.
  const [openMenuFor, setOpenMenuFor] = useState('');
  // « Écris-nous » : la conversation « Assistance FoundClub », comme « Nous contacter » du Profil.
  const assistance = useOuvrirLAssistance({ navigation });
  const allowCrossClubPlayers = tournamentConfig?.allowCrossClubPlayers === true;
  const eligibleScopeClubId = team?.event?.club?.documentId || team?.club?.documentId || '';
  const searchTerm = String(memberSearchQuery || '').trim();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['tournamentTeam', teamId] }),
    ]);
  };

  const {
    data: scopedSearchUsers = [],
    isFetching: isFetchingScopedUsers,
  } = useQuery({
    enabled: Boolean(
      canManageRoster
      && isInviteOpen
      && !allowCrossClubPlayers
      && eligibleScopeClubId
      && searchTerm.length >= 2,
    ),
    queryFn: () => searchScopedUsers({
      clubId: eligibleScopeClubId,
      limit: 20,
      query: searchTerm,
    }),
    queryKey: ['tournament-team-users', 'scoped', teamId, eligibleScopeClubId, searchTerm],
  });

  const {
    data: globalSearchUsers = [],
    isFetching: isFetchingGlobalUsers,
  } = useQuery({
    enabled: Boolean(
      canManageRoster
      && isInviteOpen
      && allowCrossClubPlayers
      && searchTerm.length >= 2,
    ),
    queryFn: async () => {
      const response = await searchUsers({ pageSize: 20, q: searchTerm });
      if (Array.isArray(response)) return response;
      return Array.isArray(response?.data) ? response.data : [];
    },
    queryKey: ['tournament-team-users', 'global', teamId, searchTerm],
  });

  const respondMutation = useMutation({
    mutationFn: (responseStatus) => respondToTournamentTeam(teamId, responseStatus),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToUpdateYourAnswer',
        'Impossible de mettre à jour ta réponse.',
      ));
    },
    onSuccess: invalidate,
  });

  const respondInvitationMutation = useMutation({
    mutationFn: (status) => respondToTournamentInvitation(teamId, status),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToAnswerThisInvitation',
        'Impossible de répondre à cette invitation.',
      ));
    },
    onSuccess: invalidate,
  });

  const requestJoinMutation = useMutation({
    mutationFn: ({ acceptRiskDeclaration }) => requestJoinTournamentTeam(teamId, { acceptRiskDeclaration }),
    onError: (mutationError) => {
      // T-REJOINDRE (17/11, fait de recette) : sans phrase du serveur, dire quoi faire.
      setJoinRequestError(mutationError?.message || t(
        'tournamentJoin.sendError',
        'La demande n’est pas partie. Vérifie ta connexion, puis réessaie.',
      ));
    },
    onSuccess: async () => {
      setJoinRequestError('');
      setIsJoinRequestModalVisible(false);
      await invalidate();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => removeTournamentTeamMember(teamId, memberId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToRemoveThisMember',
        'Impossible de retirer ce membre.',
      ));
    },
    onSuccess: invalidate,
  });

  const transferCaptainMutation = useMutation({
    mutationFn: (memberId) => transferTournamentTeamCaptain(teamId, memberId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToTransferTheCaptaincy',
        'Impossible de transférer le capitanat.',
      ));
    },
    onSuccess: invalidate,
  });

  const inviteMemberMutation = useMutation({
    mutationFn: (userDocumentId) => inviteTournamentTeamMember(teamId, userDocumentId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToInviteThisPlayer',
        "Impossible d'inviter ce joueur.",
      ));
    },
    onSuccess: async () => {
      setMemberSearchQuery('');
      await invalidate();
    },
  });

  const reviewJoinRequestMutation = useMutation({
    mutationFn: ({ memberId, status }) => reviewTournamentJoinRequest(teamId, memberId, status),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToProcessThisRequest',
        'Impossible de traiter cette demande.',
      ));
    },
    onSuccess: invalidate,
  });

  const toggleOpenRequestsMutation = useMutation({
    mutationFn: (isOpenToJoinRequests) => toggleTournamentTeamOpenRequests(teamId, isOpenToJoinRequests),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToUpdateThisOption',
        'Impossible de mettre à jour cette option.',
      ));
    },
    onSuccess: invalidate,
  });

  const leaveTeamMutation = useMutation({
    mutationFn: () => leaveTournamentTeam(teamId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
        'tournamentTeamDetails.unableToLeaveThisTeam',
        'Impossible de quitter cette équipe.',
      ));
    },
    onSuccess: async () => {
      await invalidate();
      navigation.navigate(RouteNames.EventDetails, { eventId });
    },
  });

  const invitedUserIds = useMemo(() => new Set(
    invitedMembers.map((member) => member?.user?.documentId).filter(Boolean),
  ), [invitedMembers]);
  const candidateUsers = useMemo(() => {
    let baseUsers = sourceTeamEligibleUsers;
    if (searchTerm.length >= 2) {
      baseUsers = allowCrossClubPlayers ? globalSearchUsers : scopedSearchUsers;
    }

    return (Array.isArray(baseUsers) ? baseUsers : [])
      .filter((user) => user?.documentId && (
        !engagedMemberUserIds.has(user.documentId) || invitedUserIds.has(user.documentId)))
      .slice(0, 12);
  }, [
    allowCrossClubPlayers,
    engagedMemberUserIds,
    invitedUserIds,
    globalSearchUsers,
    scopedSearchUsers,
    searchTerm,
    sourceTeamEligibleUsers,
  ]);

  const handleRemoveMember = (memberId) => {
    Alert.alert(
      t('tournamentTeamDetails.removeThisMember', 'Retirer ce membre'),
      t(
        'tournamentTeamDetails.thisActionOnlyRemovesThe',
        'Cette action ne retire le joueur que de cette équipe de tournoi.',
      ),
      [
        { style: 'cancel', text: t('tournamentTeamDetails.cancel', 'Annuler') },
        { onPress: () => removeMemberMutation.mutate(memberId), style: 'destructive', text: t('tournamentTeamDetails.remove', 'Retirer') },
      ],
    );
  };

  const handleTransferCaptain = (memberId) => {
    Alert.alert(
      t('tournamentTeamDetails.makeCaptain', 'Nommer capitaine'),
      t(
        'tournamentTeamDetails.theNewCaptainWillManage',
        'Le nouveau capitaine gérera cette équipe éphémère uniquement dans le cadre du tournoi.',
      ),
      [
        { style: 'cancel', text: t('tournamentTeamDetails.cancel', 'Annuler') },
        {
          onPress: () => transferCaptainMutation.mutate(memberId),
          text: t(
            'tournamentTeamDetails.confirm',
            'Confirmer',
          ),
        },
      ],
    );
  };

  const handleLeaveTeam = () => {
    // IMPL-2-EQUIPE (10b, 10c, 10d) : une place payée ne se quitte pas d'un geste ; l'Assistance
    // retire la place et lance le remboursement (CGV § 5). Sinon, une confirmation, et c'est fait.
    if (myPlace?.status === 'paid') {
      setIsPaidLeaveOpen(true);
      return;
    }
    Alert.alert(
      t('implEquipe.leave.unpaidTitle'),
      t('implEquipe.leave.unpaidText'),
      [
        { style: 'cancel', text: t('implEquipe.leave.stay') },
        {
          onPress: () => leaveTeamMutation.mutate(),
          style: 'destructive',
          text: t('implEquipe.leave.confirm'),
        },
      ],
    );
  };

  const handleReviewJoinRequest = (memberId, status) => {
    Alert.alert(
      t('tournamentTeamDetails.joinRequest', 'Demande de rejoindre'),
      status === 'accepted'
        ? t('tournamentTeamDetails.acceptThisRequest', 'Veux-tu accepter cette demande ?')
        : t('tournamentTeamDetails.declineThisRequest', 'Veux-tu refuser cette demande ?'),
      [
        { style: 'cancel', text: t('tournamentTeamDetails.cancel', 'Annuler') },
        { onPress: () => reviewJoinRequestMutation.mutate({ memberId, status }), text: t('tournamentTeamDetails.confirm', 'Confirmer') },
      ],
    );
  };

  const addMemberPlaceholder = allowCrossClubPlayers
    ? t('tournamentTeamDetails.searchForAFoundclubPlayer', 'Rechercher un joueur FoundClub')
    : t('tournamentTeamDetails.searchForAClubPlayer', 'Rechercher un joueur du club');

  // T-REJOINDRE (17/11, Clément D50, registre D210) — « le capitaine consulte le profil, peut
  // envoyer un message direct avant d'accepter la demande ». Le profil : l'écran existant
  // (UserDetails).
  // Le message : le fil direct créé ou retrouvé par le serveur, qui rejuge À CHAQUE FOIS la règle
  // des mineurs (chat `createWhisperChat`, minor-chat-guard) ; son refus s'affiche tel quel.
  const openRequesterProfile = (/** @type {string} */ userId) => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId },
      screen: RouteNames.UserDetails,
    });
  };
  const writeToRequester = async (/** @type {string} */ userId) => {
    try {
      // Chargé à la demande (comme le lien d'invitation) : les suites de la fiche n'en simulent
      // pas le réseau.
      // eslint-disable-next-line global-require
      const { createWhisperChat } = require('@/services/chat/chatService');
      const chat = await createWhisperChat([userId]);
      if (chat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
      }
    } catch (/** @type {any} */ writeError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        writeError?.response?.data?.error?.message || writeError?.message || t(
          'tournamentJoin.writeError',
          'Impossible d’ouvrir la conversation pour le moment.',
        ),
      );
    }
  };

  // T-NOMS-EQUIPE (Adel « 3- B », D227) : un lecteur sans lien reçoit `user: null` et `displayName`
  // (« Prénom I. », calculé par le serveur) ; « Participant » seulement si le serveur ne rend aucun
  // nom.
  const memberName = (/** @type {any} */ member) => [
    member?.user?.firstname, member?.user?.lastname,
  ].filter(Boolean).join(' ') || member?.displayName || t('tournamentTeamDetails.participant', 'Participant');

  const renderMemberCard = (member, variant) => {
    const isCaptain = normalizeTournamentText(member?.role) === 'captain';
    const memberStatusMeta = getMemberStatusMeta(member?.responseStatus, Colors);
    const isCurrentUserMember = member?.user?.documentId === currentUserDocumentId;
    const nom = memberName(member);
    const canOpenMenu = variant === 'active' && canManageRoster && !isCaptain;
    const menuOpen = canOpenMenu && openMenuFor === member?.documentId;
    let roleLine = memberStatusMeta.label;
    let roleTone = memberStatusMeta.tone;
    if (isCaptain) {
      roleLine = isCurrentUserMember
        ? t('tournamentTeamDetails.roster.captainYou', 'Capitaine · toi')
        : t('tournamentTeamDetails.captain', 'Capitaine');
      roleTone = Colors.primary500;
    } else if (isCurrentUserMember) {
      roleLine = `${memberStatusMeta.label} · ${t('tournamentTeamDetails.roster.you', 'toi')}`;
    }
    // IMPL-2-EQUIPE (3a) : l'invité attend dans sa place, « Invité : Prénom N., en attente ».
    if (variant === 'invited') {
      roleLine = t('implEquipe.roster.invitedWaiting');
      roleTone = Colors.warning500;
    }

    return (
      <View
        key={member?.documentId || member?.user?.documentId}
        style={tournamentDs.styles.compactPanelCard}
        testID={`tournament-member-row-${member?.documentId}`}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <ProfileAvatar
            imageUrl={member?.user?.avatar?.url}
            name={nom}
            size={42}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            {variant === 'invited' ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('implEquipe.roster.invitedName', { name: nom, ...SANS_ECHAPPEMENT })}
              </Text>
            ) : <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nom}</Text>}
            <Text style={[Fonts.p4, { color: roleTone }]}>{roleLine}</Text>
          </View>
          {canOpenMenu ? (
            <TouchableOpacity
              accessibilityLabel={t('tournamentTeamDetails.menu.open', 'Actions pour {{name}}', {
                name: nom, ...SANS_ECHAPPEMENT,
              })}
              accessibilityRole="button"
              onPress={() => setOpenMenuFor(menuOpen ? '' : member.documentId)}
              style={{
                alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
              }}
              testID={`tournament-member-menu-${member?.documentId}`}
            >
              <GlyphIcon color={Colors.neutral00} name="dotsVertical" size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* T-AGE puis T-PARENT (15/11) : autorisation attendue / reçue, pas d'image. */}
        <TournamentMemberConsent member={member} />
        {variant === 'active' ? (
          <TournamentMemberPlace
            compact
            place={placesByMember.get(member?.documentId)}
            showSelfPay={false}
          />
        ) : null}

        {/* Maquette (c) : « Nommer capitaine » et « Retirer de l'équipe » rangés dans le menu de la
            ligne ; la confirmation (Alert) reste celle d'avant. */}
        {menuOpen ? (
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            {/* IMPL-2-EQUIPE (4b) : « Voir le profil » dans le menu du joueur. */}
            {member?.user?.documentId ? (
              <Button
                onPress={() => {
                  setOpenMenuFor('');
                  openRequesterProfile(member.user.documentId);
                }}
                size="sm"
                title={t('tournamentJoin.seeProfile', 'Voir le profil')}
                variant="SecondaryLight"
              />
            ) : null}
            <Button
              onPress={() => {
                setOpenMenuFor('');
                handleTransferCaptain(member.documentId);
              }}
              size="sm"
              title={t('tournamentTeamDetails.makeCaptain', 'Nommer capitaine')}
              variant="Secondary"
            />
            <Button
              onPress={() => {
                setOpenMenuFor('');
                handleRemoveMember(member.documentId);
              }}
              size="sm"
              title={t('tournamentTeamDetails.menu.removeFromTeam', 'Retirer de l’équipe')}
              variant="Danger"
            />
          </View>
        ) : null}

        {variant === 'invited' && canManageRoster ? (
          <Button
            onPress={() => handleRemoveMember(member.documentId)}
            size="sm"
            style={{ alignSelf: 'flex-start', borderColor: `${Colors.neutral300}55` }}
            textStyle={{ color: Colors.neutral100 }}
            title={t('tournamentTeamDetails.cancel', 'Annuler')}
            variant="SecondaryLight"
          />
        ) : null}

        {/* T-REJOINDRE (17/11, Clément D50) : le capitaine voit qui demande avant d'accepter. */}
        {variant === 'requested' && canManageRoster && member?.user?.documentId ? (
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <View testID={`tournament-request-profile-${member.documentId}`}>
              <Button
                onPress={() => openRequesterProfile(member.user.documentId)}
                size="sm"
                title={t('tournamentJoin.seeProfile', 'Voir le profil')}
                variant="SecondaryLight"
              />
            </View>
            {/* MINEURS : « Écrire » seulement si le garde du serveur l'a permis. */}
            {member?.viewerCanWrite === true ? (
              <View testID={`tournament-request-write-${member.documentId}`}>
                <Button
                  onPress={() => writeToRequester(member.user.documentId)}
                  size="sm"
                  title={t('tournamentJoin.write', 'Écrire')}
                  variant="SecondaryLight"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {variant === 'requested' && canManageRoster ? (
          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <Button onPress={() => handleReviewJoinRequest(member.documentId, 'accepted')} size="sm" title={t('tournamentTeamDetails.accept', 'Accepter')} variant="Primary" />
            <Button
              onPress={() => handleReviewJoinRequest(member.documentId, 'declined')}
              size="sm"
              title={t('tournamentTeamDetails.decline', 'Refuser')}
              variant="Danger"
            />
          </View>
        ) : null}
      </View>
    );
  };

  // T-INVITE (15/11) — « Ton inscription » : le tournoi, sa date et son lieu,
  // au-dessus de l'équipe.
  // T-FINITIONS2 (16/11) : le lieu par la règle commune (jamais le JSON de `locationDetails`).
  const eventHeader = [
    // T-FINITIONS2 (16/11) : le nom donné au tournoi (T-NOM) d'abord.
    resolveEventCustomName(team?.event) || team?.event?.name,
    formatDateWithDayPrefix(team?.event?.date),
    getEventLocationText(team?.event),
  ].filter(Boolean).join(' · ');
  const inviteLinkHint = {
    copie: t(
      'tournamentTeamDetails.inviteLink.copied',
      'Lien copié : colle-le dans un message à tes joueurs.',
    ),
    echec: t(
      'tournamentTeamDetails.inviteLink.failed',
      "Le lien n'a pas pu être préparé. Réessaie dans un instant.",
    ),
  }[inviteLinkState] || t(
    'tournamentTeamDetails.inviteLink.hint',
    "Envoie ce lien à tes joueurs : ils rejoignent l'équipe puis paient leur place.",
  );
  const shareInviteLink = async (/** @type {{ lienSeul?: boolean }} */ options = {}) => {
    setInviteLinkState('pending');
    try {
      // Chargé à la demande (comme teamInviteShare) : les suites de la fiche
      // n'en simulent pas le réseau.
      // eslint-disable-next-line global-require
      const { shareTournamentTeamInviteLink } = require('@/services/teamInvite/teamInviteShare');
      const { envoi, url } = await shareTournamentTeamInviteLink({
        eventId,
        eventName: team?.event?.name,
        lienSeul: options?.lienSeul === true,
        teamId: team?.documentId || teamId,
        teamName: team?.name,
      });
      setInviteLinkState(!url || envoi === 'echec' ? 'echec' : (envoi || ''));
    } catch (_error) {
      setInviteLinkState('echec');
    }
  };

  // L'effectif visé (minRosterSize, sinon le seuil des places payées) : les places libres à remplir.
  const rosterTarget = Number(tournamentConfig?.minRosterSize) > 0
    ? Number(tournamentConfig.minRosterSize)
    : progress.needed;
  const freeSlots = canManageRoster && !progress.isValidated
    ? Math.max(0, rosterTarget - activeMembers.length)
    : 0;
  const todoItems = canManageRoster && !progress.isValidated ? progress.todo : [];
  const essentials = getTournamentEssentials(team?.event);
  const entryFeeLabel = getTournamentEntryFeeLabel(team?.event);
  // IMPL-2-EQUIPE remplace T-SUITES-TOURNOI (points 7 et 8) : « Chercher un joueur » et « Inviter »
  // ouvrent une fenêtre LÀ OÙ L'ON EST ; plus besoin de défiler jusqu'à une carte.
  /**
   * IMPL-2-EQUIPE (3b) : ouvre « Inviter un joueur » sur ses deux choix, ou sur la recherche.
   * @param {'choice' | 'search'} [mode] - Le premier écran.
   * @param {number | null} [slot] - La place libre touchée.
   */
  const openInvite = (mode = 'choice', slot = null) => {
    setInviteMode(mode);
    setInviteSlot(slot);
    setIsInviteOpen(true);
  };
  const openInviteSearch = () => openInvite('search', null);
  // IMPL-2-EQUIPE (3b) : le lien de l'équipe par WhatsApp, SMS ou copie (« share » = la feuille
  // du système, le geste d'avant). Même lien et même message que `shareTournamentTeamInviteLink`.
  const shareInviteVia = async (/** @type {string} */ canal) => {
    if (canal === 'share' || canal === 'copy') {
      // « Copier le lien » : l'adresse seule (T-SUITES-TOURNOI, point 13).
      await shareInviteLink(canal === 'copy' ? { lienSeul: true } : {});
      return;
    }
    setInviteLinkState('pending');
    try {
      // Chargés à la demande, comme le lien d'invitation : les suites n'en simulent pas le réseau.
      /* eslint-disable global-require */
      const { buildInviteWebUrl } = require('@/domains/invitations/inviteLink');
      const LinksPlatform = require('@/platform/links').default;

      const {
        buildTournamentTeamInviteMessage, resolveInviteLinkOrigin,
      } = require('@/services/teamInvite/teamInviteShare');
      const { createTournamentTeamInviteLink } = require('@/services/tournamentTeam/tournamentTeamService');
      /* eslint-enable global-require */
      const link = await createTournamentTeamInviteLink(team?.documentId || teamId);
      const url = link?.code ? buildInviteWebUrl({
        code: String(link.code),
        id: String(link?.eventDocumentId || eventId || ''),
        origin: resolveInviteLinkOrigin(),
        subject: 'tournament',
      }) : '';
      if (!url) {
        setInviteLinkState('echec');
        return;
      }
      const texte = encodeURIComponent(buildTournamentTeamInviteMessage({
        eventName: team?.event?.name, teamName: team?.name, url,
      }));
      await LinksPlatform.openUrl(canal === 'whatsapp'
        ? `https://wa.me/?text=${texte}`
        : `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${texte}`);
      setInviteLinkState('');
    } catch (_error) {
      setInviteLinkState('echec');
    }
  };
  const renderTodoActions = (/** @type {any} */ item) => {
    if (item.kind === 'players') {
      return (
        <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
          <Button
            isLoading={inviteLinkState === 'pending'}
            onPress={() => shareInviteLink()}
            size="sm"
            title={t('tournamentTeamDetails.todo.shareLink', 'Partager le lien d’invitation')}
            variant="Primary"
          />
          <Button
            onPress={openInviteSearch}
            size="sm"
            title={t('tournamentTeamDetails.todo.searchPlayer', 'Chercher un joueur')}
            variant="Secondary"
          />
        </View>
      );
    }
    return null;
  };

  const tournamentCard = (
    <View
      style={[...tournamentDs.styles.panelCard, Spaces.gap[12]]}
      testID="tournament-team-tournament"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('tournamentTeamDetails.tournamentCard.title', 'Le tournoi')}
      </Text>
      <TournamentEssentials items={essentials} />
      <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
        <Button
          onPress={openTournamentTerms}
          size="sm"
          title={t('tournamentTeamDetails.tournamentCard.terms', 'Conditions d’inscription')}
          variant="SecondaryLight"
        />
        <Button
          onPress={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
          size="sm"
          title={t('tournamentTeamDetails.tournamentCard.seeTournament', 'Fiche du tournoi')}
          variant="SecondaryLight"
        />
      </View>
    </View>
  );

  // IMPL-2-EQUIPE (9g, 9h) : « Recrutement », l'interrupteur « Ouverte aux demandes » et sa phrase
  // (avant : « Ouvrir / Fermer les demandes » dans la carte d'invitation). Même appel serveur.
  const isOpenToRequests = team?.isOpenToJoinRequests === true;
  const toggleRequests = () => toggleOpenRequestsMutation.mutate(!isOpenToRequests);
  const recruitmentCard = canManageRoster
    && normalizeTournamentText(team?.sourceType) === 'custom_team' ? (
      <View style={Spaces.gap[12]} testID="tournament-team-recruitment">
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('implEquipe.recruit.title')}</Text>
        <TouchableOpacity
          accessibilityLabel={t('implEquipe.recruit.switch')}
          accessibilityRole="switch"
          accessibilityState={{
            checked: isOpenToRequests, disabled: toggleOpenRequestsMutation.isPending,
          }}
          disabled={toggleOpenRequestsMutation.isPending}
          onPress={toggleRequests}
          style={[
            ...tournamentDs.styles.compactPanelCard,
            Alignments.row, Alignments.alignCenter, Spaces.gap[12], { minHeight: 52 },
          ]}
          testID="tournament-team-open-requests"
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('implEquipe.recruit.switch')}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {isOpenToRequests ? t('implEquipe.recruit.on') : t('implEquipe.recruit.off')}
            </Text>
          </View>
          <Switch
            accessibilityElementsHidden
            disabled={toggleOpenRequestsMutation.isPending}
            importantForAccessibility="no-hide-descendants"
            onValueChange={toggleRequests}
            thumbColor={Colors.neutral00}
            trackColor={{ false: `${Colors.primary500}4D`, true: Colors.primary500 }}
            value={isOpenToRequests}
          />
        </TouchableOpacity>
      </View>
    ) : null;

  const discussionCard = team?.discussion ? (
    <View style={tournamentDs.styles.panelCard}>
      <TournamentTeamDiscussion discussion={team?.discussion} navigation={navigation} />
    </View>
  ) : null;

  // Décision d'Adel « 6- A » (17/11) : le retrait est traité à la main par l'équipe FoundClub. La
  // phrase ne promet rien de plus que les conditions d'inscription (conditionsTournoi.js) : elle y
  // renvoie, sans date.
  const withdrawCard = isCurrentActiveMember && !teamIsLocked ? (
    <View
      style={[...tournamentDs.styles.compactPanelCard, Spaces.gap[12]]}
      testID="tournament-team-withdraw"
    >
      <Button
        isLoading={assistance.enCours}
        onPress={assistance.ouvrir}
        size="sm"
        style={{ alignSelf: 'stretch', maxWidth: '100%' }}
        title={t('tournamentTeamDetails.withdraw.button', 'Écrire à l’Assistance FoundClub')}
        variant="SecondaryLight"
      />
      {assistance.erreur ? (
        <Text style={[Fonts.p4, Fonts.error500]}>
          {t('tournamentTeamDetails.withdraw.error', 'La conversation ne s’est pas ouverte. Réessaie dans un instant.')}
        </Text>
      ) : null}
    </View>
  ) : null;

  // R6 : « Quitter l'équipe » tout en bas, en lien rouge séparé.
  const leaveLink = canLeaveTeam ? (
    <View style={[styles.leaveSeparator, { borderTopColor: tournamentDs.colors.borderStrong }]}>
      <Button
        disabled={leaveTeamMutation.isPending}
        isLoading={leaveTeamMutation.isPending}
        onPress={handleLeaveTeam}
        size="sm"
        style={{ alignSelf: 'stretch' }}
        title={t('implEquipe.leave.button')}
        variant="Danger"
      />
    </View>
  ) : null;

  // IMPL-2-EQUIPE (9a, 10a) — « À faire maintenant ».
  const amount = Number(team?.payment?.entryFeeCents) > 0
    ? `${(Number(team.payment.entryFeeCents) / 100).toLocaleString('fr-FR')} €` : '';
  const myPlacePaid = Boolean(myPlace && myPlace.status === 'paid');
  const showOtherPlace = canManageRoster && !progress.isValidated && progress.isPaid;
  // Un tournoi payant dit qui manque dans sa phrase (TournamentTeamProgress) ; un tournoi gratuit
  // garde « Trouver N joueurs ».
  const otherTodo = todoItems.filter((/** @type {any} */ item) => (
    ['consents', 'jerseys'].includes(item.kind) || (!progress.isPaid && item.kind === 'players')
  ));
  const paidDetail = [
    amount,
    myPlace?.jerseySize ? t('implEquipe.place.jersey', { size: myPlace.jerseySize, ...SANS_ECHAPPEMENT }) : '',
  ].filter(Boolean).join(' · ');
  const todoCard = myPlaceDue || myPlacePaid || showOtherPlace || otherTodo.length > 0 ? (
    <View
      style={[...tournamentDs.styles.panelCard, Spaces.gap[12]]}
      testID="tournament-team-todo"
    >
      {/* Équipe validée (4b, 10a) : plus rien « à faire », la place payée reste. */}
      {!progress.isValidated ? (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('tournamentTeamDetails.todo.title', 'À faire maintenant')}
        </Text>
      ) : null}
      {myPlaceDue ? (
        <View
          style={[...tournamentDs.styles.insetPanelCard, Spaces.gap[8]]}
          testID="tournament-team-my-place"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('implEquipe.place.dueTitle')}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {[
              entryFeeLabel,
              tournamentConfig?.jerseySizeRequired === true
                ? t('tournamentTeamDetails.myPlace.jersey', 'Tu choisis ta taille de maillot en payant.')
                : null,
            ].filter(Boolean).join('. ')}
          </Text>
          <TournamentMemberPlace
            payLabel={amount ? t('implEquipe.place.payMine', { amount, ...SANS_ECHAPPEMENT }) : ''}
            place={myPlace}
          />
        </View>
      ) : null}
      {myPlacePaid ? (
        <View
          style={[
            ...tournamentDs.styles.insetPanelCard, Spaces.gap[8],
            { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}80` },
          ]}
          testID="tournament-team-my-place-paid"
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <GlyphIcon color={Colors.primary500} name="circleCheck" size={20} />
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('implEquipe.place.paidTitle')}</Text>
          </View>
          {paidDetail ? <Text style={[Fonts.p3, Fonts.neutral200]}>{paidDetail}</Text> : null}
          <Button
            onPress={() => navigation.navigate(RouteNames.MyLicenses)}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('implEquipe.place.receipt')}
            variant="Ghost"
          />
        </View>
      ) : null}
      {showOtherPlace ? (
        <View style={[...tournamentDs.styles.insetPanelCard, Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('implEquipe.place.otherTitle')}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('implEquipe.place.otherText', { needed: progress.needed })}
          </Text>
          <Button
            isLoading={inviteLinkState === 'pending'}
            onPress={() => shareInviteLink()}
            size="sm"
            style={{ alignSelf: 'stretch' }}
            title={t('tournamentTeamDetails.todo.shareLink', 'Partager le lien d’invitation')}
            variant="Secondary"
          />
          <Button
            onPress={openInviteSearch}
            size="sm"
            style={{ alignSelf: 'stretch' }}
            title={t('tournamentTeamDetails.todo.searchPlayer', 'Chercher un joueur')}
            variant="Secondary"
          />
        </View>
      ) : null}
      {/* Le lien copié (ordinateur) ou en échec : l'écran le dit, fenêtre fermée ou non. */}
      {['copie', 'echec'].includes(inviteLinkState) && !isInviteOpen ? (
        <Text style={[Fonts.p3, Fonts.neutral100]}>{inviteLinkHint}</Text>
      ) : null}
      {otherTodo.map((/** @type {any} */ item) => {
        const detail = getTodoDetail(item);
        return (
          <View key={item.kind} style={[...tournamentDs.styles.insetPanelCard, Spaces.gap[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{getTodoTitle(item)}</Text>
            {detail ? <Text style={[Fonts.p4, Fonts.neutral200]}>{detail}</Text> : null}
            {renderTodoActions(item)}
          </View>
        );
      })}
    </View>
  ) : null;

  // IMPL-2-EQUIPE (10c, 10d) — quitter après avoir payé : la règle des conditions d'inscription,
  // puis l'Assistance (aucun écran de cession dans l'app).
  const withdrawal = getWithdrawalWindow({ eventDate: team?.event?.date });
  const fermerEtEcrire = () => {
    setIsPaidLeaveOpen(false);
    assistance.ouvrir();
  };
  const paidLeaveContent = (
    <View style={Spaces.gap[12]} testID="tournament-team-paid-leave">
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t('implEquipe.leave.paidTitle')}</Text>
      {withdrawal.phase === 'refund' ? (
        <View
          style={[
            ...tournamentDs.styles.insetPanelCard,
            { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}66` },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('implEquipe.leave.refundUntil', {
              amount: amount || entryFeeLabel, date: withdrawal.refundDate, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      ) : null}
      {withdrawal.phase === 'cession' ? (
        <View
          style={[
            ...tournamentDs.styles.insetPanelCard, Spaces.gap[4],
            { backgroundColor: `${Colors.warning500}14`, borderColor: `${Colors.warning500}66` },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.warning500]}>
            {t('implEquipe.leave.noRefund', { date: withdrawal.noRefundDate, ...SANS_ECHAPPEMENT })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('implEquipe.leave.cession', { date: withdrawal.cessionDate, ...SANS_ECHAPPEMENT })}
          </Text>
        </View>
      ) : null}
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {{
          after: t('implEquipe.leave.after'),
          cession: '',
          refund: t('implEquipe.leave.refundHow'),
          unknown: t('implEquipe.leave.generic'),
        }[withdrawal.phase]}
      </Text>
      <Button
        isLoading={assistance.enCours}
        onPress={fermerEtEcrire}
        style={{ alignSelf: 'stretch' }}
        title={withdrawal.phase === 'cession'
          ? t('implEquipe.leave.cede') : t('implEquipe.leave.writeAssistance')}
        variant="Primary"
      />
      {withdrawal.phase === 'cession' ? (
        <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
          {t('implEquipe.leave.cedeHint', { date: withdrawal.cessionDate, ...SANS_ECHAPPEMENT })}
        </Text>
      ) : null}
      <Button
        onPress={() => setIsPaidLeaveOpen(false)}
        style={{ alignSelf: 'stretch' }}
        title={t('implEquipe.leave.stay')}
        variant="Ghost"
      />
    </View>
  );

  const fenetres = isInviteOpen || isPaidLeaveOpen ? chargerLesFenetres() : null;

  const mainColumn = (
    <View style={[Spaces.gap[16], isWide ? { flex: 1, minWidth: 0 } : null]}>
      {teamIsLocked ? (
        <View
          style={[
            ...tournamentDs.styles.panelCard,
            { borderColor: teamIsArchived ? `${Colors.neutral300}33` : `${Colors.warning500}33` },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{teamIsArchived ? t('tournamentTeamDetails.teamArchived', 'Équipe archivée') : t('tournamentTeamDetails.tournamentClosed', 'Tournoi clôturé')}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {teamIsArchived
              ? t('tournamentTeamDetails.thisTemporaryTeamIsArchived', "Cette équipe éphémère est archivée. Le roster reste lisible mais n'est plus modifiable.")
              : t('tournamentTeamDetails.theTournamentIsClosedTeam', "Le tournoi est fermé. Les modifications d'équipe et les nouvelles réponses sont maintenant bloquées.")}
          </Text>
        </View>
      ) : null}

      <TournamentTeamProgress
        detailed
        members={allMembers}
        noLimitHint={canManageRoster}
        payment={team?.payment}
        teamStatus={team?.status}
        tournamentConfig={tournamentConfig}
        viewerIsMember={isCurrentActiveMember || canManageTeam}
      />
      {rosterSummary.hasWarning && normalizeTournamentText(team?.status) === 'accepted' ? (
        <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
          {t('tournamentTeamDetails.thisTeamStaysAcceptedBut', "Cette équipe reste acceptée, mais un warning roster est maintenant visible pour l'organisateur.")}
        </Text>
      ) : null}

      {todoCard}

      {currentMemberStatus === 'invited' ? (
        <View style={[...tournamentDs.styles.panelCard, Spaces.gap[12]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>
            {t('tournamentTeamDetails.invitationReceived', 'Invitation reçue')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'tournamentTeamDetails.invitationAddsYou',
              "Cette invitation t'ajoute au roster tournoi uniquement si tu l'acceptes.",
            )}
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <Button disabled={respondInvitationMutation.isPending || teamIsLocked} onPress={() => respondInvitationMutation.mutate('accepted')} size="sm" title={t('tournamentTeamDetails.accept', 'Accepter')} variant="Primary" />
            <Button
              disabled={respondInvitationMutation.isPending || teamIsLocked}
              onPress={() => respondInvitationMutation.mutate('declined')}
              size="sm"
              style={{ borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title={t('tournamentTeamDetails.decline', 'Refuser')}
              variant="SecondaryLight"
            />
          </View>
        </View>
      ) : null}

      {currentMemberStatus === 'requested' ? (
        <View style={[...tournamentDs.styles.panelCard, Spaces.gap[8]]}>
          <Text style={[Fonts.p4Bold, Fonts.warning500]}>
            {t('tournamentTeamDetails.requestSent', 'Demande envoyée')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('tournamentTeamDetails.yourRequestIsWaitingFor', 'Ta demande est en attente de validation par le capitaine ou un admin de cette équipe tournoi.')}
          </Text>
        </View>
      ) : null}

      {canUpdateTournamentResponse ? (
        <View style={[...tournamentDs.styles.panelCard, Spaces.gap[12]]}>
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>
            {t('tournamentTeamDetails.myTournamentAnswer', 'Ma réponse tournoi')}
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <Button disabled={respondMutation.isPending || teamIsLocked} onPress={() => respondMutation.mutate('present')} size="sm" title={t('tournamentTeamDetails.present', 'Présent')} variant={currentMemberStatus === 'present' ? 'Primary' : 'Secondary'} />
            <Button
              disabled={respondMutation.isPending || teamIsLocked}
              onPress={() => respondMutation.mutate('absent')}
              size="sm"
              style={currentMemberStatus === 'absent'
                ? { backgroundColor: `${Colors.error500}12`, borderColor: `${Colors.error500}55` }
                : { borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title={t('tournamentTeamDetails.absent', 'Absent')}
              variant="SecondaryLight"
            />
          </View>
        </View>
      ) : null}

      {canRequestJoinTeam ? (
        <View
          style={[...tournamentDs.styles.panelCard, Spaces.gap[12]]}
          testID="tournament-team-join"
        >
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>
            {t('tournamentTeamDetails.joinThisTeam', 'Rejoindre cette équipe')}
          </Text>
          {joinBlockedReason ? (
            <Text style={[Fonts.p3, Fonts.warning500]} testID="tournament-team-join-blocked">
              {joinBlockedReason}
            </Text>
          ) : (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('tournamentTeamDetails.sendAJoinRequestThe', "Envoie une demande de rejoindre. Le capitaine ou un admin pourra ensuite l'accepter ou la refuser.")}
            </Text>
          )}
          {canShowJoinButton ? (
            <Button
              disabled={requestJoinMutation.isPending}
              isLoading={requestJoinMutation.isPending}
              onPress={() => {
                setJoinRequestError('');
                setIsJoinRequestModalVisible(true);
              }}
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              title={t('tournamentTeamDetails.askToJoin', 'Demander à rejoindre')}
              variant="Primary"
            />
          ) : null}
        </View>
      ) : null}

      {!canRequestJoinTeam && !currentMember && normalizeTournamentText(team?.sourceType) === 'custom_team' && team?.isOpenToJoinRequests !== true ? (
        <View style={[...tournamentDs.styles.panelCard, Spaces.gap[8]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            {t('tournamentTeamDetails.requestsClosed', 'Demandes fermées')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('tournamentTeamDetails.theCaptainOrAnAdmin', 'Le capitaine ou un admin doit ouvrir cette équipe avant de recevoir de nouvelles demandes.')}
          </Text>
        </View>
      ) : null}

      <View style={Spaces.gap[12]} testID="tournament-team-roster">
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], styles.spreadWrap]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('implEquipe.roster.title')}</Text>
          {/* T-SANS-PLAFOND (D239) : plus de « sur {{max}} » ; le seuil est dans la progression. */}
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {progress.isValidated && progress.isPaid
              ? t('implEquipe.roster.countPaid', {
                count: activeMembers.length, paid: Number(team?.payment?.paidCount) || 0,
              })
              : t('implEquipe.roster.count', { count: activeMembers.length })}
          </Text>
        </View>
        {team?.sourceType === 'club_team' ? (
          <Text style={[Fonts.p3, Fonts.primary100]}>
            {t('tournamentTeamDetails.activeMembersMakeUpThe', "Les membres actifs composent l'équipe tournoi. Cette composition ne modifie jamais l'équipe club permanente.")}
          </Text>
        ) : null}
        {activeMembers.length === 0 ? (
          <View style={tournamentDs.styles.compactPanelCard}>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{t('tournamentTeamDetails.noActiveMemberInThe', 'Aucun membre actif dans le roster pour le moment.')}</Text>
          </View>
        ) : null}
        {activeMembers.map((member) => renderMemberCard(member, 'active'))}
        {invitedMembers.map((member) => renderMemberCard(member, 'invited'))}
        {Array.from({ length: freeSlots }, (_, index) => (
          <View
            key={`libre-${index}`}
            style={[
              ...tournamentDs.styles.compactPanelCard,
              Alignments.row, Alignments.alignCenter, Spaces.gap[12], styles.dashed,
            ]}
            testID="tournament-team-free-slot"
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral100]}>
                {t('tournamentTeamDetails.roster.freeSlot', 'Place {{index}} libre', {
                  index: activeMembers.length + index + 1,
                })}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {t('tournamentTeamDetails.roster.freeSlotHint', 'Invite un joueur pour la remplir')}
              </Text>
            </View>
            <Button
              onPress={() => openInvite('choice', activeMembers.length + index + 1)}
              size="sm"
              title={t('tournamentTeamDetails.invite', 'Inviter')}
              variant="Secondary"
            />
          </View>
        ))}
        {/* IMPL-2-EQUIPE (4c) : « Inviter un joueur » toujours visible, même après 5 joueurs. */}
        {canManageRoster ? (
          <View testID="tournament-team-invite-button">
            <Button
              onPress={() => openInvite('choice', null)}
              style={{ alignSelf: 'stretch' }}
              title={t('implEquipe.roster.inviteAPlayer')}
              variant="Secondary"
            />
          </View>
        ) : null}
      </View>

      {recruitmentCard}

      {(requestedMembers.length > 0 || currentMemberStatus === 'requested'
        || (canManageRoster && isOpenToRequests
          && normalizeTournamentText(team?.sourceType) === 'custom_team')) ? (
            <View
              onLayout={(event) => {
                requestsYRef.current = event?.nativeEvent?.layout?.y ?? null;
                scrollToFocusedSection();
              }}
              style={Spaces.gap[12]}
              testID="tournament-team-requests"
            >
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                {canManageRoster
                  ? t('implEquipe.recruit.requests', { count: requestedMembers.length })
                  : t('tournamentTeamDetails.joinRequests', 'Demandes de rejoindre')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {canManageRoster
                  ? t('implEquipe.recruit.requestsHint')
                  : t('tournamentTeamDetails.acceptedRequestsThenMoveInto', 'Les demandes acceptées passent ensuite dans le roster actif avec un statut initial en attente.')}
              </Text>
              {requestedMembers.length === 0 ? (
                <View style={tournamentDs.styles.compactPanelCard}>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{t('tournamentTeamDetails.noPendingRequestForNow', 'Aucune demande en attente pour le moment.')}</Text>
                </View>
              ) : null}
              {requestedMembers.map((member) => renderMemberCard(member, 'requested'))}
            </View>
        ) : null}
    </View>
  );

  const sideColumn = (
    <View
      style={[Spaces.gap[16], isWide ? { width: 340 } : null]}
      testID="tournament-team-side"
    >
      {tournamentCard}
      {discussionCard}
      {withdrawCard}
      {leaveLink}
    </View>
  );

  return (
    <ScreenContainer
      // DEFILEMENT-LOT1 (règle A) : pile au-dessus des onglets, pas de barre ici ; le cadre ne
      // garde rien en bas, la fin du défilement laisse sa marge et le retrait commun.
      bottomInsetMode="scroll-edge"
      // 🤖 ANDROIDBAR-3 — un champ en bas : sur Android 15+, le clavier ne rétrécit plus l'écran.
      keyboardAvoiding
    >
      <WithDataWrapper
        data={team}
        error={error}
        isLoading={isLoading}
        onRetry={refetch}
        wrapperStyle={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            tournamentDs.styles.screenContent,
            { paddingBottom: 40 + retraitBas },
          ]}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Maquette (c) : le retour au tournoi en haut (plus de « Revenir au tournoi » en bas). */}
          <Button
            onPress={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            title={t('tournamentTeamDetails.back', 'Retour au tournoi')}
            variant="SecondaryLight"
          />
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.p4Bold, Fonts.primary500]}>
              {currentMemberIsCaptain
                ? t('tournamentTeamDetails.eyebrowCaptain', 'Équipe du tournoi · Tu es capitaine')
                : t('tournamentTeamDetails.eyebrow', 'Équipe du tournoi')}
            </Text>
            <Text style={[Fonts.h2, Fonts.neutral00]}>
              {team?.name || t(
                'tournamentTeamDetails.tournamentTeam',
                'Équipe tournoi',
              )}
            </Text>
            {team?.sourceType === 'club_team' ? (
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {t('tournamentTeamDetails.derivedFrom', 'Équipe tournoi dérivée de {{name}}', {
                  name: team?.sourceTeam?.name
                    || t('tournamentTeamDetails.theClubTeam', "l'équipe club"),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
            ) : null}
            {eventHeader ? (
              <Text style={[Fonts.p3, Fonts.neutral100]} testID="tournament-team-event-header">
                {eventHeader}
              </Text>
            ) : null}
          </View>

          <View
            onLayout={(event) => {
              columnsYRef.current = event?.nativeEvent?.layout?.y ?? null;
              scrollToFocusedSection();
            }}
            style={[Spaces.gap[16], isWide ? styles.twoColumns : null]}
            testID="tournament-team-columns"
          >
            {mainColumn}
            {sideColumn}
          </View>
        </ScrollView>

        {fenetres && isInviteOpen && canManageRoster ? (
          <fenetres.TournamentInviteSheet
            candidates={candidateUsers}
            initialMode={inviteMode}
            invitedIds={invitedUserIds}
            isInviting={inviteMemberMutation.isPending}
            isSearching={isFetchingScopedUsers || isFetchingGlobalUsers}
            isSharing={inviteLinkState === 'pending'}
            isVisible
            isWide={isWide}
            onChangeQuery={setMemberSearchQuery}
            onClose={() => setIsInviteOpen(false)}
            onInvite={(/** @type {any} */ userId) => inviteMemberMutation.mutate(userId)}
            onShare={shareInviteVia}
            placeholder={addMemberPlaceholder}
            query={memberSearchQuery}
            shareHint={['copie', 'echec'].includes(inviteLinkState) ? inviteLinkHint : ''}
            slotIndex={inviteSlot}
            teamName={team?.name || ''}
          />
        ) : null}
        {fenetres && isPaidLeaveOpen ? (
          <fenetres.BottomModal
            close={() => setIsPaidLeaveOpen(false)}
            isVisible
            webPresentation={isWide ? 'dialog' : undefined}
          >
            {paidLeaveContent}
          </fenetres.BottomModal>
        ) : null}

        <JoinEventModal
          clubName={team?.event?.club?.name || team?.club?.name || ''}
          confirmLabel={t('tournamentTeamDetails.sendMyRequest', 'Envoyer ma demande')}
          contextNote={t('tournamentTeamDetails.chosenTeam', 'Équipe choisie : {{name}}.', {
            name: team?.name || t('tournamentTeamDetails.tournamentTeam', 'Équipe tournoi'),
            ...SANS_ECHAPPEMENT,
          })}
          errorMessage={joinRequestError || null}
          isSubmitting={requestJoinMutation.isPending}
          isVisible={isJoinRequestModalVisible}
          onClose={() => {
            setIsJoinRequestModalVisible(false);
            setJoinRequestError('');
          }}
          onConfirm={async (acceptance = {}) => {
            try {
              setJoinRequestError('');
              await requestJoinMutation.mutateAsync({
                acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
              });
            } catch (mutationError) {
              setJoinRequestError(mutationError?.message || t(
                'tournamentJoin.sendError',
                'La demande n’est pas partie. Vérifie ta connexion, puis réessaie.',
              ));
            }
          }}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentTeamDetails;
