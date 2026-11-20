import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { photoDuLieu } from '@/domains/event/photoDuLieu';
import { confirmerLeRefus } from '@/domains/requests/confirmerLeRefus';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import Tag from '@/components/atoms/tag/Tag';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import { useDeclarerPageDuSite } from '@/components/templates/pageDuSite';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useRetraitBasDuDefilement from '@/components/templates/useRetraitBasDuDefilement';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
import { useGetTournamentDashboard } from '@/services/tournamentCompetition/tournamentCompetitionQueries';
import {
  drawTournamentGroups,
  generateTournamentKnockout,
  generateTournamentMatches,
  publishTournamentCompetition,
  setupTournamentCompetition,
} from '@/services/tournamentCompetition/tournamentCompetitionService';
import {
  useTournamentOrganizerSummary,
} from '@/services/tournamentTeam/tournamentOrganizerService';
import {
  closeTournament,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import { isAccessRefusalError } from '@/utils/errors/accessRefusal';

import TournamentOrganizerBoard from './components/TournamentOrganizerBoard';
import {
  TournamentBracketBoard,
  TournamentGroupCards,
  TournamentMatchCard,
  TournamentStandingsTable,
} from './tournamentCompetitionComponents';
import { createTournamentDesignSystem, withAlpha } from './tournamentDesignSystem';
import TournamentInvitationRequest from './TournamentInvitationRequest';
import TournamentInvites from './TournamentInvites';
import {
  getTournamentRegisteredTeamsCount,
  isTournamentTeamRegistered,
} from './tournamentTeamsCount';
import {
  getTournamentClosure,
  getTournamentCompetitionActions,
  getTournamentCompetitionStateLabel,
  getTournamentFormatLabel,
  getTournamentPaidValidationLabel,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  getTournamentTeamStatusMeta,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from './tournamentUtils';

// I18N-2 : des GETTERS, pas des textes — ces tableaux sont lus à l import, avant
// l initialisation d i18next ; le libellé se traduit au moment où il s affiche.
// La barre fine laisse au titre la fenêtre moins 152 px (marges, retour, vide) ; un signe : ~11 px.
const PLACE_PRISE_DANS_LA_BARRE = 152;
const LARGEUR_D_UN_SIGNE = 11;

const TAB_OPTIONS = [
  {
    get label() { return i18next.t('tournamentManagement.tabOverview', 'Vue d ensemble'); },
    value: 'overview',
  },
  {
    get label() { return i18next.t('tournamentManagement.tabTeams', 'Equipes'); },
    value: 'teams',
  },
  {
    get label() { return i18next.t('tournamentManagement.tabGroups', 'Poules'); },
    value: 'groups',
  },
  {
    get label() { return i18next.t('tournamentManagement.tabMatches', 'Matchs'); },
    value: 'matches',
  },
  {
    get label() { return i18next.t('tournamentManagement.tabStandings', 'Classements'); },
    value: 'standings',
  },
  {
    get label() { return i18next.t('tournamentManagement.tabBracket', 'Phases finales'); },
    value: 'bracket',
  },
];

const TEAM_FILTER_OPTIONS = [
  {
    get label() { return i18next.t('tournamentManagement.filterAll', 'Toutes'); },
    value: 'all',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterPending', 'En attente'); },
    value: 'pending',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterAccepted', 'Validees'); },
    value: 'accepted',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterDeclined', 'Refusées'); },
    value: 'declined',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterArchived', 'Archivees'); },
    value: 'archived',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterRosterToReview', 'Effectifs à revoir'); },
    value: 'warning',
  },
];

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentManagement({ navigation, route }) {
  const { t } = useTranslation();
  const retraitBas = useRetraitBasDuDefilement(12);
  const { width: largeurDeLaFenetre } = useWindowDimensions();
  const { eventId } = route?.params || {};
  const queryClient = useQueryClient();
  const { canManageEvent, userData } = /** @type {any} */ (useAuth());
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [teamFilter, setTeamFilter] = useState('all');

  const {
    data: dashboard,
    error,
    isLoading,
    refetch,
  } = useGetTournamentDashboard(eventId || '');
  // IMPL-1B-PHOTO (19/11, écran 1a) : le tableau de bord ne rend pas le lieu ; la photo du
  // complexe se lit sur la fiche du tournoi (même clé de cache `['event', id]` : aucun appel
  // quand on vient de la fiche).
  const { data: ficheDuTournoi } = useGetEvent(eventId || '');

  const tournamentConfig = useMemo(
    () => (dashboard?.config && typeof dashboard.config === 'object' ? dashboard.config : {}),
    [dashboard?.config],
  );
  const event = dashboard?.event || null;
  const canManageTournament = Boolean(canManageEvent(event));
  const tournamentTeams = useMemo(
    () => (Array.isArray(dashboard?.teams) ? [...dashboard.teams] : [])
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))),
    [dashboard?.teams],
  );
  const counters = useMemo(
    () => getTournamentStatusCounters(tournamentTeams, tournamentConfig),
    [tournamentConfig, tournamentTeams],
  );
  const competitionActions = useMemo(
    () => getTournamentCompetitionActions(dashboard),
    [dashboard],
  );
  // IMPL-1C (19/11, recette 48, écart 4 ; planche page 8) : qui ne gère pas le tournoi ne voit que
  // les équipes inscrites (en attente, validées), sans état interne ; le serveur les rend toutes
  // (tournament-competition.js:544, lot IMPL-5). Témoin : TournamentManagement.IMPL-1C.lecteur.
  // Sa propre équipe reste visible, refusée comprise (chef, 19/11). Contrat IMPL-5D : pour un
  // non-gérant, le serveur rend `memberCount` partout et `members` pour SA seule équipe ; aucune
  // lecture de `members` sans garde.
  const moi = userData?.documentId || null;
  const serveurSansMembres = useMemo(
    () => tournamentTeams.some((team) => Number.isFinite(Number(team?.memberCount))),
    [tournamentTeams],
  );
  const estLaMienne = useCallback(
    (/** @type {any} */ team) => Boolean(team?.viewerMembership)
      || (serveurSansMembres && Array.isArray(team?.members))
      || Boolean(moi && team?.captainUser?.documentId === moi)
      || Boolean(moi && (Array.isArray(team?.members) ? team.members : [])
        .some((/** @type {any} */ membre) => membre?.user?.documentId === moi)),
    [moi, serveurSansMembres],
  );
  const equipesVisibles = useMemo(
    () => (canManageTournament
      ? tournamentTeams
      : tournamentTeams.filter((team) => isTournamentTeamRegistered(team) || estLaMienne(team))),
    [canManageTournament, estLaMienne, tournamentTeams],
  );
  const filteredTeams = useMemo(
    () => equipesVisibles.filter((team) => {
      if (teamFilter === 'all') return true;
      if (teamFilter === 'warning') return isTournamentTeamNonCompliant(team, tournamentConfig);
      return normalizeTournamentText(team?.status) === teamFilter;
    }),
    [equipesVisibles, teamFilter, tournamentConfig],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['tournament-dashboard', eventId] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: ({ status, teamDocumentId }) => reviewTournamentTeamRegistration(teamDocumentId, status),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToUpdateThisTeam',
        'Impossible de mettre à jour cette équipe.',
      ));
    },
    onSuccess: invalidate,
  });

  const closeTournamentMutation = useMutation({
    mutationFn: () => closeTournament(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToCloseThisTournament',
        'Impossible de clôturer ce tournoi.',
      ));
    },
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t('tournamentManagement.tournamentClosed', 'Tournoi clôture'), t('tournamentManagement.theTournamentIsNowClosed', 'Le tournoi est maintenant ferme et les équipes éphémères sont archivées.'));
    },
  });

  const setupCompetitionMutation = useMutation({
    mutationFn: () => setupTournamentCompetition(eventId, tournamentConfig),
    onError: (mutationError) => {
      Alert.alert(t('common.error', 'Erreur'), mutationError?.details?.error || mutationError?.message || t('tournamentManagement.unableToSyncTheTournament', 'Impossible de synchroniser la structure du tournoi.'));
    },
    onSuccess: invalidate,
  });

  const drawGroupsMutation = useMutation({
    mutationFn: () => drawTournamentGroups(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToDrawTheGroups',
        'Impossible de tirer les poules.',
      ));
    },
    onSuccess: invalidate,
  });

  const generateMatchesMutation = useMutation({
    mutationFn: () => generateTournamentMatches(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToGenerateTheMatches',
        'Impossible de générer les matchs.',
      ));
    },
    // CORR-EVENEMENTS 129 C : « Générer » dit ce qu'il a créé, ou pourquoi il n'a rien créé.
    onSuccess: async (resultat) => {
      await invalidate();
      const total = Number(resultat?.overview?.totalMatches ?? resultat?.data?.overview?.totalMatches ?? 0);
      if (total > 0) {
        Alert.alert(t('tournamentManagement.matchesGenerated', {
          count: total,
          defaultValue_one: '{{count}} match créé.',
          defaultValue_other: '{{count}} matchs créés.',
        }));
        return;
      }
      Alert.alert(
        t('tournamentManagement.noMatchGenerated', 'Aucun match créé.'),
        t(
          'tournamentManagement.noMatchGeneratedHint',
          'Chaque poule doit compter au moins 2 équipes : réduis le nombre de poules dans les paramètres.',
        ),
      );
    },
  });

  const generateKnockoutMutation = useMutation({
    mutationFn: () => generateTournamentKnockout(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToGenerateTheKnockout',
        'Impossible de générer la phase finale.',
      ));
    },
    onSuccess: invalidate,
  });

  const publishCompetitionMutation = useMutation({
    mutationFn: () => publishTournamentCompetition(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.details?.error || mutationError?.message || t(
        'tournamentManagement.unableToPublishThisCompetition',
        'Impossible de publier cette compétition.',
      ));
    },
    onSuccess: async () => {
      await invalidate();
      Alert.alert(t('tournamentManagement.competitionPublished', 'Compétition publiée'), t('tournamentManagement.theSportsStructureIsNow', 'La structure sportive est maintenant verrouillée. Les horaires, installations et scores restent modifiables.'));
    },
  });

  const renderSummaryCard = (label, value, accentColor) => (
    <View
      key={label}
      style={[tournamentDs.getMetricCardStyle(accentColor), { width: '100%' }]}
    >
      <Text style={[Fonts.p4Bold, { color: accentColor }]}>{label}</Text>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{String(value)}</Text>
    </View>
  );

  const renderActionButton = ({
    disabled = false,
    isLoading: actionLoading = false,
    onPress,
    title,
    variant = 'Secondary',
  }) => (
    <Button
      disabled={disabled || actionLoading}
      isLoading={actionLoading}
      onPress={onPress}
      size="sm"
      title={title}
      variant={variant}
    />
  );

  const handleCloseTournament = () => {
    Alert.alert(
      t('tournamentManagement.closeTheTournament', 'Clôturer le tournoi'),
      t('tournamentManagement.thisActionArchivesAllTemporary', 'Cette action archive toutes les équipes éphémères et gele les modifications sur la compétition.'),
      [
        { style: 'cancel', text: t('tournamentManagement.cancel', 'Annuler') },
        {
          onPress: () => closeTournamentMutation.mutate(),
          style: 'destructive',
          text: t('tournamentManagement.close', 'Cloturer'),
        },
      ],
    );
  };

  const handlePublishCompetition = () => {
    Alert.alert(
      t('tournamentManagement.publishTheCompetition', 'Publier la compétition'),
      t('tournamentManagement.afterPublishingTheSportsStructure', 'Après publication, la structure sportive sera verrouillée. Seuls les horaires, installations et scores resteront modifiables.'),
      [
        { style: 'cancel', text: t('tournamentManagement.cancel', 'Annuler') },
        {
          onPress: () => publishCompetitionMutation.mutate(),
          text: t('tournamentManagement.publish', 'Publier'),
        },
      ],
    );
  };

  const handleReview = (teamDocumentId, status) => {
    reviewMutation.mutate({ status, teamDocumentId });
  };

  // CORR-EVENEMENTS 131 (décision A) : un tournoi clôturé se lit, il ne se pilote plus.
  const { closedAt, isClosed } = getTournamentClosure({
    ...event,
    tournamentConfig,
    tournamentTeams,
  });
  const estPrive = normalizeTournamentText(event?.sessionStatus) === 'closed';
  // FIN-TEXTES (PARENT 130) : la barre fine du site lit la clé du registre (« Pilotage du
  // tournoi ») tant que l'écran ne déclare rien ; le lecteur y lit donc le nom du tournoi.
  const titreDuLecteur = event?.name || t('tournamentManagement.competition', 'Compétition');
  // T3-PLACE (03/11) : à 390, un nom long se coupait dans la barre et se répétait juste dessous.
  // ponytail: « il tient » est estimé en signes ; sortie : mesurer le texte de la barre.
  const nomTropLongPourLaBarre = titreDuLecteur.length * LARGEUR_D_UN_SIGNE
    > largeurDeLaFenetre - PLACE_PRISE_DANS_LA_BARRE;
  const titreDeLaBarre = nomTropLongPourLaBarre
    ? t('tournamentManagement.competition', 'Compétition')
    : titreDuLecteur;
  useDeclarerPageDuSite({ titre: canManageTournament && !isClosed ? null : titreDeLaBarre });
  // IMPL-3-ORGA (18/11, page 1 des planches) : l'organisateur d'un tournoi ouvert lit le tableau
  // de bord ; ses chiffres viennent de sa route à lui (admin tournament-organizer.js), jamais du
  // tableau partagé.
  const pilote = canManageTournament && !isClosed;
  const {
    data: resumeDeLOrganisateur,
    error: erreurDuResume,
    refetch: relireLeResume,
  } = useTournamentOrganizerSummary(eventId || '', {
    enabled: Boolean(eventId) && pilote,
  });
  const competitionStateLabel = isClosed
    ? t('tournamentManagement.closedTag', 'Clôturé')
    : getTournamentCompetitionStateLabel(tournamentConfig?.competitionState);
  const isCompetitionPublished = normalizeTournamentText(tournamentConfig?.competitionState) === 'published';
  // CORR-EVENEMENTS 133 : les textes du cockpit passent par le catalogue, avec leurs accents.
  let seedingLabel = t('tournamentManagement.seedingRandom', 'Aléatoire');
  if (tournamentConfig?.seedingMode === 'manual') {
    seedingLabel = t('tournamentManagement.seedingManual', 'Manuel');
  } else if (tournamentConfig?.seedingMode === 'snake') {
    seedingLabel = t('tournamentManagement.seedingSnake', 'Serpentin');
  }

  const renderOverviewTab = () => (
    <View style={Spaces.gap[16]}>
      <View
        style={tournamentDs.styles.panelCard}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('tournamentManagement.sportsStructure', 'Structure sportive')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('tournamentManagement.formatLine', 'Format : {{format}}', {
                format: getTournamentFormatLabel(tournamentConfig?.formatMode),
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
          <Tag
            style={tournamentDs.getToneTagStyle(isCompetitionPublished ? Colors.success500 : Colors.warning500)}
            text={competitionStateLabel}
            textColor="neutral00"
            textStyle={{ color: isCompetitionPublished ? Colors.success500 : Colors.warning500 }}
          />
        </View>

        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={t('tournamentManagement.groupsCount', { count: dashboard?.overview?.groups || 0, defaultValue_one: '{{count}} poule', defaultValue_other: '{{count}} poules' })} textColor="primary500" />
          <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={t('tournamentManagement.matchesCount', { count: dashboard?.overview?.totalMatches || 0, defaultValue_one: '{{count}} match', defaultValue_other: '{{count}} matchs' })} textColor="primary500" />
          {competitionActions.hasBracket ? (
            <Tag style={tournamentDs.getToneTagStyle(Colors.success500)} text={t('tournamentManagement.bracketGenerated', 'Bracket génère')} textColor="neutral00" textStyle={{ color: Colors.success500 }} />
          ) : null}
          {canManageTournament && counters.warning > 0 ? (
            <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text={t('tournamentManagement.rosterAlertsCount', { count: counters.warning, defaultValue_one: '{{count}} effectif à revoir', defaultValue_other: '{{count}} effectifs à revoir' })} textColor="gold500" />
          ) : null}
        </View>

        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.teamApprovalMode', 'Validation des équipes: {{mode}}', {
              // T-PARCOURS-2 (point 11) : un tournoi payant valide l'équipe au seuil payé (la
              // règle de la fiche) ; sinon le mode choisi par l'organisateur.
              mode: getTournamentPaidValidationLabel({ tournamentConfig })
                || (tournamentConfig?.registrationMode === 'auto'
                  ? t('tournamentManagement.automatic', 'Automatique')
                  : t('tournamentManagement.manual', 'Manuelle')),
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.pointsSummary', 'Points: V {{win}} | N {{draw}} | D {{loss}} | F {{forfeit}}', {
              draw: tournamentConfig?.pointsDraw ?? 1,
              forfeit: tournamentConfig?.pointsForfeit ?? 0,
              loss: tournamentConfig?.pointsLoss ?? 0,
              win: tournamentConfig?.pointsWin ?? 3,
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.matchGenerationMode', 'Génération des matchs: {{mode}}', {
              mode: tournamentConfig?.matchGenerationMode === 'manual'
                ? t('tournamentManagement.manual', 'Manuelle')
                : t('tournamentManagement.automatic', 'Automatique'),
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.seeding', 'Tirage: {{seeding}}', { seeding: seedingLabel, ...SANS_ECHAPPEMENT })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.qualifiedPerGroup', 'Qualifies / poule: {{qualified}}', {
              qualified: tournamentConfig?.qualifiedPerGroup ?? 2,
            })}
          </Text>
          {String(tournamentConfig?.rulesText || '').trim() ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>{String(tournamentConfig.rulesText).trim()}</Text>
          ) : null}
        </View>
      </View>

      <View
        style={tournamentDs.styles.panelCard}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('tournamentManagement.competitionView', 'Lecture compétition')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('tournamentManagement.youCanFollowGroupsMatches', 'Tu peux suivre les poules, les matchs, les classements et le bracket depuis ce cockpit en lecture seule.')}
        </Text>

        {isClosed ? (
          <View
            accessibilityRole="summary"
            style={[Spaces.padding[12], Spaces.gap[4], {
              backgroundColor: `${Colors.neutral00}10`,
              borderColor: `${Colors.neutral00}33`,
              borderRadius: 12,
              borderWidth: 1,
            }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {closedAt
                ? t('tournamentManagement.closedOn', 'Tournoi clôturé le {{date}}', {
                  date: new Date(closedAt).toLocaleDateString(localeDesFormats()),
                  ...SANS_ECHAPPEMENT,
                })
                : t('tournamentManagement.closedBanner', 'Tournoi clôturé')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'tournamentManagement.closedReadOnly',
                'Les poules, les matchs et les classements restent consultables ; plus rien ne se modifie.',
              )}
            </Text>
          </View>
        ) : null}

        {/* ORGANISATEUR 2 (19/11) : qui pilote ne lit plus ce bloc (tableau de bord) ; ses
            gestes sont sous les lignes du Jour J (gestesDuJourJ). Ici, la lecture seule :
            lecteur, ou tournoi clôturé. */}
      </View>
    </View>
  );

  const renderTeamsTab = () => (
    <View style={Spaces.gap[16]}>
      {canManageTournament && estPrive && !isClosed ? (
        <TournamentInvites clubId={event?.club?.documentId || null} eventId={eventId} />
      ) : null}
      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('tournamentManagement.registeredTeams', 'Équipes inscrites')}
        </Text>
        {canManageTournament ? (
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {TEAM_FILTER_OPTIONS.map((option) => {
              const selected = teamFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setTeamFilter(option.value)}
                  style={tournamentDs.getPillStyle(selected)}
                >
                  <Text style={[Fonts.p4Bold, selected ? Fonts.primary100 : Fonts.neutral200]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>

      {filteredTeams.length === 0 ? (
        <View style={tournamentDs.styles.panelCard}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{t('tournamentManagement.noTeamMatchesThisFilter', 'Aucune équipe ne correspond à ce filtre pour le moment.')}</Text>
        </View>
      ) : null}

      {filteredTeams.map((team) => {
        const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
        const statusMeta = getTournamentTeamStatusMeta(team?.status, Colors);
        const hasRosterWarning = canManageTournament
          && isTournamentTeamNonCompliant(team, tournamentConfig);
        // Le nombre de joueurs : `memberCount` du serveur (IMPL-5D), sinon le résumé ou
        // `members`, sinon rien ; jamais « 0 joueur » faute de données.
        const montrerEtat = canManageTournament || estLaMienne(team)
          || normalizeTournamentText(team?.status) === 'accepted';
        let nombreDeJoueurs = null;
        if (team?.memberCount !== null && team?.memberCount !== undefined
          && Number.isFinite(Number(team.memberCount))) {
          nombreDeJoueurs = Number(team.memberCount);
        } else if (Array.isArray(team?.members) || rosterSummary.membersSummary) {
          nombreDeJoueurs = rosterSummary.totalCount;
        }
        const sousTitreEphemere = canManageTournament
          ? t('tournamentManagement.temporaryTeamCreatedByA', 'Équipe éphémère créée par un joueur')
          : t('implFiche.tournamentTeam', 'Équipe du tournoi');
        return (
          <View
            key={team?.documentId || team?.name}
            style={tournamentDs.styles.panelCard}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{team?.name || t('tournamentManagement.tournamentTeam', 'Équipe tournoi')}</Text>
                <Text style={[Fonts.p4, Fonts.primary100]}>
                  {team?.sourceType === 'club_team'
                    ? t('tournamentManagement.fromTeam', 'Depuis {{teamName}}', {
                      teamName: team?.sourceTeam?.name
                        || t('tournamentManagement.aClubTeam', 'une équipe club'),
                      ...SANS_ECHAPPEMENT,
                    })
                    : sousTitreEphemere}
                </Text>
              </View>
              {montrerEtat ? (
                <Tag style={tournamentDs.getToneTagStyle(statusMeta.tone)} text={statusMeta.label} textColor="neutral00" textStyle={{ color: statusMeta.tone }} />
              ) : null}
            </View>

            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              {nombreDeJoueurs !== null ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={t('tournamentManagement.rosterTotal', { count: nombreDeJoueurs, defaultValue_one: '{{count}} joueur', defaultValue_other: '{{count}} joueurs' })} textColor="primary500" />
              ) : null}
              {canManageTournament ? (
                <>
                  <Tag style={{ backgroundColor: tournamentDs.colors.subtleSurface, borderColor: tournamentDs.colors.borderMuted }} text={t('tournamentManagement.rosterPresent', { count: rosterSummary.presentCount, defaultValue_one: '{{count}} présent', defaultValue_other: '{{count}} présents' })} textColor="neutral00" />
                  <Tag style={{ backgroundColor: tournamentDs.colors.subtleSurface, borderColor: tournamentDs.colors.borderMuted }} text={t('tournamentManagement.rosterPending', { count: rosterSummary.pendingCount, defaultValue: '{{count}} en attente' })} textColor="neutral00" />
                  {rosterSummary.invitedCount > 0 ? (
                    <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={t('tournamentManagement.rosterInvited', { count: rosterSummary.invitedCount, defaultValue_one: '{{count}} invitation', defaultValue_other: '{{count}} invitations' })} textColor="primary500" />
                  ) : null}
                  {rosterSummary.requestedCount > 0 ? (
                    <Tag style={tournamentDs.getToneTagStyle(Colors.warning500)} text={t('tournamentManagement.rosterRequested', { count: rosterSummary.requestedCount, defaultValue_one: '{{count}} demande', defaultValue_other: '{{count}} demandes' })} textColor="warning500" />
                  ) : null}
                </>
              ) : null}
              {hasRosterWarning ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text={t('tournamentManagement.rosterToReview', 'Effectif à revoir')} textColor="gold500" />
              ) : null}
            </View>

            <View style={[Spaces.gap[12]]}>
              <Button
                onPress={() => navigation.navigate(RouteNames.TournamentTeamDetails, { eventId, teamId: team?.documentId })}
                // Avant : « Ouvrir l équipe ». 1a (19/11) : « Voir l'équipe » partout.
                title={t('implOrga.seeTeam', 'Voir l’équipe')}
                variant="Secondary"
              />
              {canManageTournament && !isClosed && normalizeTournamentText(team?.status) === 'pending' ? (
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <Button
                    isLoading={reviewMutation.isPending}
                    onPress={() => handleReview(team?.documentId, 'accepted')}
                    size="sm"
                    style={{ flex: 1 }}
                    title={t('tournamentManagement.approve', 'Valider')}
                    variant="Primary"
                  />
                  <Button
                    isLoading={reviewMutation.isPending}
                    onPress={() => confirmerLeRefus(
                      t,
                      () => handleReview(team?.documentId, 'declined'),
                    )}
                    size="sm"
                    style={{ borderColor: `${Colors.error500}55`, flex: 1 }}
                    textStyle={{ color: Colors.error500 }}
                    title={t('tournamentManagement.decline', 'Refuser')}
                    variant="SecondaryLight"
                  />
                </View>
              ) : null}
              {canManageTournament && !isClosed && normalizeTournamentText(team?.status) !== 'archived' ? (
                <Button
                  isLoading={reviewMutation.isPending}
                  onPress={() => handleReview(team?.documentId, 'archived')}
                  size="sm"
                  style={{ borderColor: `${Colors.neutral300}55` }}
                  textStyle={{ color: Colors.neutral100 }}
                  title={t('tournamentManagement.archiveTheTeam', 'Archiver l équipe')}
                  variant="SecondaryLight"
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'teams') return renderTeamsTab();
    if (activeTab === 'groups') {
      return <TournamentGroupCards groups={dashboard?.groups} standings={dashboard?.standings} />;
    }
    if (activeTab === 'matches') {
      if (!Array.isArray(dashboard?.matches) || dashboard.matches.length === 0) {
        return (
          <View style={tournamentDs.styles.panelCard}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('tournamentManagement.noMatchGeneratedYet', 'Aucun match génère pour le moment.')}
            </Text>
          </View>
        );
      }
      return (
        <View style={Spaces.gap[12]}>
          {dashboard.matches.map((match) => (
            <TournamentMatchCard
              ctaLabel={t('tournamentManagement.seeTheMatch', 'Voir le match')}
              key={match?.documentId}
              match={match}
              onPress={() => navigation.navigate(RouteNames.TournamentMatchDetails, {
                eventId,
                matchId: match?.documentId,
              })}
            />
          ))}
        </View>
      );
    }
    if (activeTab === 'standings') {
      return <TournamentStandingsTable standings={dashboard?.standings} />;
    }
    if (activeTab === 'bracket') {
      return (
        <TournamentBracketBoard
          bracket={dashboard?.bracket}
          onMatchPress={(match) => navigation.navigate(RouteNames.TournamentMatchDetails, {
            eventId,
            matchId: match?.documentId,
          })}
        />
      );
    }
    return renderOverviewTab();
  };

  // IMPL-3-ORGA (planche 1c) — « À la une » : la demande de mise en avant publique, validée par
  // FoundClub
  // (le même geste que le menu de la fiche, portée PUBLIC).
  const demanderLaUne = () => {
    Alert.alert(
      t('implOrga.featuredTitle', 'Mettre le tournoi à la une ?'),
      t('implOrga.featuredBody', 'FoundClub reçoit ta demande et la valide.'),
      [
        { style: 'cancel', text: t('tournamentManagement.cancel', 'Annuler') },
        {
          onPress: async () => {
            try {
              // Chargé au geste : eventService tire react-native-blob-util, que les suites du
              // cockpit ne doublent pas (même parade que TournamentTeamDetails pour le fil).
              // eslint-disable-next-line global-require
              const { requestFeatured } = require('@/services/event/eventService');
              await requestFeatured({ eventId, scopes: ['PUBLIC'] });
              Alert.alert(
                t('implOrga.featuredSent', 'Demande envoyée'),
                t('implOrga.featuredSentBody', 'Tu seras prévenu quand le tournoi sera à la une.'),
              );
            } catch (/** @type {any} */ cause) {
              Alert.alert(
                t('common.error', 'Erreur'),
                cause?.response?.data?.error?.message || cause?.message
                  || t('implOrga.featuredError', 'La demande n’est pas partie.'),
              );
            }
          },
          text: t('implOrga.featuredConfirm', 'Demander'),
        },
      ],
    );
  };

  // ORGANISATEUR 8 (Adel Q5 « A », 19/11) : « Annuler » l'événement d'un tournoi quitte le menu de
  // la fiche
  // du site et vient ici, sous Réglages, à côté de « Clôturer ». Même geste que la fiche
  // (EventDetails.web.js annulerLEvenement) : confirmation, POST /events/:id/cancel, la Ville
  // prévenue le
  // cas échéant, puis retour. ponytail: un tournoi n'a pas de série ; sans la feuille « cette
  // séance /
  // les suivantes », seule cette date est annulée. Sortie : CancelSeriesSheet si un tournoi
  // récurrent naît.
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const annulerLEvenement = () => {
    Alert.alert(
      t('eventDetails.modals.cancelEvent.title', 'Es-tu sûr·e de vouloir annuler cet événement ?'),
      t(
        'eventDetails.modals.cancelEvent.description',
        'Une fois annulé, l’événement ne sera plus visible par les participant·e·s.',
      ),
      [
        { style: 'cancel', text: t('tournamentManagement.cancel', 'Annuler') },
        {
          onPress: async () => {
            setAnnulationEnCours(true);
            try {
              // Chargé au geste, comme « À la une » (eventService tire react-native-blob-util).
              // eslint-disable-next-line global-require
              const { cancelEvent } = require('@/services/event/eventService');
              const reponse = await cancelEvent({ documentId: eventId });
              await invalidate();
              const prevenue = reponse?.meta?.collectivitePrevenue;
              const revenir = () => navigation.goBack();
              if (prevenue) {
                Alert.alert(
                  t('useEventMutations.villePrevenue.titre', 'C’est annulé'),
                  t('useEventMutations.villePrevenue.corps', {
                    defaultValue: 'La {{ville}} est prévenue : la place se libère.',
                    ville: prevenue.collectiviteName
                      || t('collectiviteDemandes.club.laVille', 'Ville'),
                    ...SANS_ECHAPPEMENT,
                  }),
                  [{ onPress: revenir, text: 'OK' }],
                );
                return;
              }
              revenir();
            } catch (/** @type {any} */ cause) {
              Alert.alert(
                t('common.error', 'Erreur'),
                cause?.response?.data?.error?.message || cause?.message
                  || t('implOrga.cancelEventError', 'L’événement n’a pas pu être annulé.'),
              );
            } finally {
              setAnnulationEnCours(false);
            }
          },
          style: 'destructive',
          text: t('implOrga.cancelEventConfirm', 'Annuler l’événement'),
        },
      ],
    );
  };

  const surfaceDesLignes = {
    backgroundColor: withAlpha(Colors.primary900, 'F2'),
    borderColor: withAlpha(Colors.primary500, '3D'),
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  };
  /**
   * Une ligne de « Jour J » ou des réglages (planche 1c).
   * @param {object} ligne
   * @param {any} ligne.icone - Le glyphe.
   * @param {() => void} ligne.onPress - Le geste.
   * @param {boolean} [ligne.selected] - Ouverte.
   * @param {string} [ligne.sousTitre] - La phrase sous le titre.
   * @param {string} ligne.testID - Le repère des témoins.
   * @param {string} ligne.titre - Le titre.
   * @param {string} [ligne.valeur] - La valeur à droite.
   * @returns {import('react').ReactElement} La ligne.
   */
  const ligneDeNavigation = ({
    icone, onPress, selected = false, sousTitre = '', testID, titre, valeur = '',
  }) => (
    <TouchableOpacity
      accessibilityLabel={titre}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      key={testID}
      onPress={onPress}
      style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { minHeight: 56 }]}
      testID={testID}
    >
      <GlyphIcon color={selected ? Colors.primary500 : Colors.neutral00} name={icone} size={20} />
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.h5Bold, selected ? Fonts.primary500 : Fonts.neutral00]}>{titre}</Text>
        {sousTitre ? <Text style={[Fonts.p3, Fonts.neutral300]}>{sousTitre}</Text> : null}
      </View>
      {valeur ? <Text style={[Fonts.p3, Fonts.neutral300]}>{valeur}</Text> : null}
      <GlyphIcon
        color={Colors.neutral300}
        name={selected ? 'chevronDown' : 'chevronRight'}
        size={16}
      />
    </TouchableOpacity>
  );
  const separateur = (/** @type {string} */ cle) => (
    <View key={cle} style={{ backgroundColor: Colors.primary700, height: 1 }} />
  );

  // ORGANISATEUR 2 (Adel 19/11, carte 1c) : les blocs « Structure sportive » et « Actions
  // compétition »
  // quittent la page de l'organisateur (la structure vit dans « Réglages »). Leurs gestes
  // n'existaient nulle
  // part ailleurs (grep du 19/11) : chacun passe sous la ligne du Jour J qu'il concerne, mêmes
  // conditions,
  // même mutation. « Clôturer le tournoi » n'a pas de ligne : il reste seul sous « Réglages / À la
  // une ».
  // Témoin : TournamentManagement.ORGANISATEUR.test.js.
  const gestesDuJourJ = (/** @type {string} */ onglet) => {
    /** @type {any[]} */
    let gestes = [];
    if (onglet === 'groups') {
      gestes = [
        renderActionButton({
          disabled: isCompetitionPublished,
          isLoading: setupCompetitionMutation.isPending,
          onPress: () => setupCompetitionMutation.mutate(),
          title: t('tournamentManagement.syncTheStructure', 'Synchroniser la structure'),
          variant: 'Secondary',
        }),
        competitionActions.canDrawGroups ? renderActionButton({
          isLoading: drawGroupsMutation.isPending,
          onPress: () => drawGroupsMutation.mutate(),
          title: t('tournamentManagement.drawTheGroups', 'Tirer les poules'),
          variant: 'Primary',
        }) : null,
      ];
    } else if (onglet === 'matches') {
      gestes = [
        competitionActions.canGenerateMatches ? renderActionButton({
          isLoading: generateMatchesMutation.isPending,
          onPress: () => generateMatchesMutation.mutate(),
          title: t('tournamentManagement.generateTheMatches', 'Générer les matchs'),
          variant: 'Secondary',
        }) : null,
        // « Publier » demande des matchs ou un tableau : la ligne Matchs existe toujours.
        competitionActions.canPublish ? renderActionButton({
          isLoading: publishCompetitionMutation.isPending,
          onPress: handlePublishCompetition,
          title: t('tournamentManagement.publishTheCompetition', 'Publier la compétition'),
          variant: 'Primary',
        }) : null,
      ];
    } else if (onglet === 'bracket') {
      gestes = [
        competitionActions.canGenerateKnockout ? renderActionButton({
          isLoading: generateKnockoutMutation.isPending,
          onPress: () => generateKnockoutMutation.mutate(),
          title: t('tournamentManagement.generateTheKnockoutStage', 'Générer la phase finale'),
          variant: 'Secondary',
        }) : null,
      ];
    }
    const presents = gestes.filter(Boolean);
    // L'état de la compétition (brouillon / publiée) se lisait dans « Structure sportive » : il
    // reste lu ici,
    // au-dessus des gestes qu'il ouvre ou ferme.
    return presents.length ? (
      <View style={Spaces.gap[12]} testID={`orga-gestes-${onglet}`}>
        <Text style={[Fonts.p3, Fonts.neutral300]}>{competitionStateLabel}</Text>
        {presents.map((geste, index) => (
          <View key={`geste-${onglet}-${String(index)}`}>{geste}</View>
        ))}
      </View>
    ) : null;
  };

  // Planche 1c : « Jour J » (poules, matchs, classements, et la phase finale quand elle existe) ;
  // chaque ligne déplie le contenu d'avant (les onglets) et ses gestes.
  const renderJourJ = () => {
    const groupes = Number(dashboard?.overview?.groups) || 0;
    const matchs = Number(dashboard?.overview?.totalMatches) || 0;
    const basculer = (/** @type {string} */ onglet) => setActiveTab(
      activeTab === onglet ? 'overview' : onglet,
    );
    const lignes = [
      {
        icone: 'chartSimpleHorizontal',
        onglet: 'groups',
        titre: t('tournamentManagement.tabGroups', 'Poules'),
        valeur: groupes > 0
          ? t('tournamentManagement.groupsCount', {
            count: groupes,
            defaultValue_one: '{{count}} poule',
            defaultValue_other: '{{count}} poules',
          })
          : t('implOrga.toDo', 'à faire'),
      },
      {
        icone: 'calendar',
        onglet: 'matches',
        titre: t('tournamentManagement.tabMatches', 'Matchs'),
        valeur: t('implOrga.matchesScheduled', {
          count: matchs,
          defaultValue_one: '{{count}} programmé',
          defaultValue_other: '{{count}} programmés',
        }),
      },
      {
        icone: 'flag',
        onglet: 'standings',
        titre: t('tournamentManagement.tabStandings', 'Classements'),
      },
      ...(competitionActions.hasBracket || competitionActions.canGenerateKnockout ? [
        {
          icone: 'chartColumn',
          onglet: 'bracket',
          titre: t('tournamentManagement.tabBracket', 'Phases finales'),
        },
      ] : []),
    ];
    const maxEquipes = Number(resumeDeLOrganisateur?.maxTeams ?? tournamentConfig?.maxTeams) || 0;
    return (
      <View style={Spaces.gap[12]}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t('implOrga.dayTitle', 'Jour J')}</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('implOrga.daySubtitle', 'poules, matchs, classements')}
          </Text>
        </View>
        <View style={surfaceDesLignes}>
          {lignes.flatMap((ligne, index) => [
            index > 0 ? separateur(`sep-${ligne.onglet}`) : null,
            ligneDeNavigation({
              icone: ligne.icone,
              onPress: () => basculer(ligne.onglet),
              selected: activeTab === ligne.onglet,
              testID: `orga-jour-j-${ligne.onglet}`,
              titre: ligne.titre,
              valeur: ligne.valeur,
            }),
          ])}
        </View>
        {activeTab !== 'overview' ? gestesDuJourJ(activeTab) : null}
        {activeTab !== 'overview' ? renderActiveTab() : null}
        <View style={surfaceDesLignes}>
          {ligneDeNavigation({
            icone: 'penSquare',
            onPress: () => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId }),
            sousTitre: maxEquipes > 0
              ? t('implOrga.settingsHintTeams', {
                count: maxEquipes,
                defaultValue: 'prix, âge, maillot, {{count}} équipes, date, lieu',
              })
              : t('implOrga.settingsHint', 'prix, âge, maillot, équipes, date, lieu'),
            testID: 'orga-reglages',
            titre: t('implOrga.settings', 'Réglages'),
          })}
          {separateur('sep-une')}
          {ligneDeNavigation({
            icone: 'thumbtack',
            onPress: demanderLaUne,
            sousTitre: t('implOrga.featuredHint', 'demander la mise en avant'),
            testID: 'orga-a-la-une',
            titre: t('implOrga.featured', 'À la une'),
          })}
        </View>
        <Button
          isLoading={closeTournamentMutation.isPending}
          onPress={handleCloseTournament}
          size="sm"
          style={{ borderColor: `${Colors.error500}55` }}
          textStyle={{ color: Colors.error500 }}
          title={t('tournamentManagement.closeTheTournament', 'Clôturer le tournoi')}
          variant="SecondaryLight"
        />
        <Button
          isLoading={annulationEnCours}
          onPress={annulerLEvenement}
          size="sm"
          style={{ borderColor: `${Colors.error500}55` }}
          textStyle={{ color: Colors.error500 }}
          title={t('implOrga.cancelEvent', 'Annuler l’événement')}
          variant="SecondaryLight"
        />
      </View>
    );
  };

  const filtresDesEquipes = (
    <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
      {TEAM_FILTER_OPTIONS.map((option) => {
        const selected = teamFilter === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => setTeamFilter(option.value)}
            style={tournamentDs.getPillStyle(selected)}
          >
            <Text style={[Fonts.p4Bold, selected ? Fonts.primary100 : Fonts.neutral200]}>
              {/* RETOUCHES-R50 (1b) : chez l'organisateur, une équipe archivée est « retirée ». */}
              {option.value === 'archived'
                ? t('implOrga.filterRemoved', 'Retirées')
                : option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const deuxColonnes = largeurDeLaFenetre >= 1024;
  const inscrites = getTournamentRegisteredTeamsCount({ tournamentTeams }) || 0;
  const invitesDuTournoiPrive = estPrive
    ? <TournamentInvites clubId={event?.club?.documentId || null} eventId={eventId} />
    : null;

  // T3-TOURNOI-PRIVE : le lien d'un tournoi privé ouvre cet écran ;
  // un compte sans lien y demande à participer.
  if (isAccessRefusalError(error)) {
    return (
      // DEFILEMENT-LOT1 : rien ne défile ici ; le plancher du cadre, plus la place des onglets.
      <ScreenContainer>
        <TournamentInvitationRequest eventId={eventId} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      // DEFILEMENT-LOT1 (règle A) : pile au-dessus des onglets, pas de barre ici ; le cadre ne
      // garde rien en bas, la fin du défilement laisse sa marge et le retrait commun.
      bottomInsetMode="scroll-edge"
    >
      <WithDataWrapper
        data={dashboard}
        error={error}
        isLoading={isLoading}
        onRetry={refetch}
        wrapperStyle={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.paddingTop[24],
            { paddingBottom: 40 + retraitBas },
            Spaces.gap[24],
          ]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {pilote ? (
            <>
              {/* 1a (19/11) : le titre une seule fois. Le site le dit dans sa barre fine
                  (registre), et le nom est dans la carte du tournoi ; le téléphone (pile sans
                  titre) le dit ici, avec le nom. */}
              {Platform.OS === 'web' ? null : (
                <View style={tournamentDs.styles.screenIntro}>
                  <Text style={[Fonts.h2, Fonts.neutral00]}>
                    {t('tournamentManagement.tournamentControl', 'Gérer le tournoi')}
                  </Text>
                  <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral300]}>
                    {titreDuLecteur}
                  </Text>
                </View>
              )}
              {/* Planche 1f : au bureau (1024 px et plus), « Jour J » et les réglages passent
                  à droite. */}
              <View
                style={deuxColonnes
                  ? [Alignments.row, Spaces.gap[24], { alignItems: 'flex-start' }]
                  : Spaces.gap[24]}
                testID={deuxColonnes ? 'orga-deux-colonnes' : 'orga-une-colonne'}
              >
                <View style={deuxColonnes ? { flex: 2, minWidth: 0 } : null}>
                  <TournamentOrganizerBoard
                    // 1f : les lignes serrées demandent ≈ 500 px fixes (barre, état, lien, menu) ;
                    // à 1024 la colonne des équipes n'en a pas assez, les cartes restent.
                    compact={largeurDeLaFenetre >= 1280}
                    event={event}
                    eventId={eventId}
                    filters={filtresDesEquipes}
                    invites={invitesDuTournoiPrive}
                    navigation={navigation}
                    onChanged={async () => {
                      await Promise.all([invalidate(), relireLeResume?.()]);
                    }}
                    photo={photoDuLieu(ficheDuTournoi, 'medium')}
                    registeredTeamsCount={inscrites}
                    summary={resumeDeLOrganisateur || null}
                    summaryFailed={Boolean(erreurDuResume)}
                    teams={filteredTeams}
                    totalTeamsCount={tournamentTeams.length}
                    tournamentConfig={tournamentConfig}
                    viewerDocumentId={String(userData?.documentId || '')}
                  />
                </View>
                <View style={deuxColonnes ? { flex: 1, minWidth: 0 } : null}>{renderJourJ()}</View>
              </View>
            </>
          ) : null}
          {/* REPRISE-EVENEMENTS 130 : le lecteur (parent, joueur) lit le nom du tournoi ; la
              phrase de pilotage ne s'adresse qu'à qui pilote. */}
          {/* IMPL-3-ORGA : qui pilote lit le tableau de bord ci-dessus ; ce qui suit est la vue du
              lecteur (parent, joueur) et du tournoi clôturé, inchangée. */}
          {pilote ? null : (
            <>
              <View style={tournamentDs.styles.screenIntro}>
                <Text style={[Fonts.h2, Fonts.neutral00]}>{titreDuLecteur}</Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
                {/* T-REGLES-EQUIPE (point 8) : en attente + validées, comme le serveur (maxTeams) et la fiche. */}
                {renderSummaryCard(t('tournamentManagement.summaryTeams', 'Équipes'), canManageTournament ? getTournamentRegisteredTeamsCount({ tournamentTeams }) : equipesVisibles.length, Colors.primary500)}
                {renderSummaryCard(t('tournamentManagement.summaryGroups', 'Poules'), dashboard?.overview?.groups || 0, Colors.primary500)}
                {renderSummaryCard(t('tournamentManagement.summaryMatches', 'Matchs'), dashboard?.overview?.totalMatches || 0, Colors.success500)}
                {canManageTournament ? renderSummaryCard(t('tournamentManagement.summaryRosterAlerts', 'À revoir'), counters.warning, Colors.gold500) : null}
              </View>

              <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
                {TAB_OPTIONS.map((option) => {
                  const selected = activeTab === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setActiveTab(option.value)}
                      style={tournamentDs.getPillStyle(selected)}
                      testID={`tournoi-onglet-${option.value}`}
                    >
                      <Text style={[Fonts.p4Bold, selected ? Fonts.primary100 : Fonts.neutral200]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {renderActiveTab()}
            </>
          )}
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentManagement;
