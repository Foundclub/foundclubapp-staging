import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTournamentDashboard } from '@/services/tournamentCompetition/tournamentCompetitionQueries';
import {
  drawTournamentGroups,
  generateTournamentKnockout,
  generateTournamentMatches,
  publishTournamentCompetition,
  setupTournamentCompetition,
} from '@/services/tournamentCompetition/tournamentCompetitionService';
import {
  closeTournament,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import {
  TournamentBracketBoard,
  TournamentGroupCards,
  TournamentMatchCard,
  TournamentStandingsTable,
} from './tournamentCompetitionComponents';
import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  getTournamentCompetitionActions,
  getTournamentCompetitionStateLabel,
  getTournamentFormatLabel,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  getTournamentTeamStatusMeta,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from './tournamentUtils';

// I18N-2 : des GETTERS, pas des textes — ces tableaux sont lus à l import, avant
// l initialisation d i18next ; le libellé se traduit au moment où il s affiche.
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
    get label() { return i18next.t('tournamentManagement.filterDeclined', 'Refusees'); },
    value: 'declined',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterArchived', 'Archivees'); },
    value: 'archived',
  },
  {
    get label() { return i18next.t('tournamentManagement.filterWarning', 'Warnings roster'); },
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
  const { eventId } = route?.params || {};
  const queryClient = useQueryClient();
  const { canManageEvent } = useAuth();
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
  const filteredTeams = useMemo(
    () => tournamentTeams.filter((team) => {
      if (teamFilter === 'all') return true;
      if (teamFilter === 'warning') return isTournamentTeamNonCompliant(team, tournamentConfig);
      return normalizeTournamentText(team?.status) === teamFilter;
    }),
    [teamFilter, tournamentConfig, tournamentTeams],
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
      ), mutationError?.message || t(
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
      ), mutationError?.message || t(
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
      Alert.alert(t('common.error', 'Erreur'), mutationError?.message || t('tournamentManagement.unableToSyncTheTournament', 'Impossible de synchroniser la structure du tournoi.'));
    },
    onSuccess: invalidate,
  });

  const drawGroupsMutation = useMutation({
    mutationFn: () => drawTournamentGroups(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
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
      ), mutationError?.message || t(
        'tournamentManagement.unableToGenerateTheMatches',
        'Impossible de générer les matchs.',
      ));
    },
    onSuccess: invalidate,
  });

  const generateKnockoutMutation = useMutation({
    mutationFn: () => generateTournamentKnockout(eventId),
    onError: (mutationError) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), mutationError?.message || t(
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
      ), mutationError?.message || t(
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

  const competitionStateLabel = getTournamentCompetitionStateLabel(tournamentConfig?.competitionState);
  const isCompetitionPublished = normalizeTournamentText(tournamentConfig?.competitionState) === 'published';
  let seedingLabel = 'Aleatoire';
  if (tournamentConfig?.seedingMode === 'manual') {
    seedingLabel = 'Manuel';
  } else if (tournamentConfig?.seedingMode === 'snake') {
    seedingLabel = 'Serpentin';
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
              {`Format: ${getTournamentFormatLabel(tournamentConfig?.formatMode)}`}
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
          <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${dashboard?.overview?.groups || 0} poule(s)`} textColor="primary500" />
          <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${dashboard?.overview?.totalMatches || 0} match(s)`} textColor="primary500" />
          {competitionActions.hasBracket ? (
            <Tag style={tournamentDs.getToneTagStyle(Colors.success500)} text={t('tournamentManagement.bracketGenerated', 'Bracket génère')} textColor="neutral00" textStyle={{ color: Colors.success500 }} />
          ) : null}
          {counters.warning > 0 ? (
            <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text={`${counters.warning} warning(s) roster`} textColor="gold500" />
          ) : null}
        </View>

        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('tournamentManagement.teamApprovalMode', 'Validation des équipes: {{mode}}', {
              mode: tournamentConfig?.registrationMode === 'auto'
                ? t('tournamentManagement.automatic', 'Automatique')
                : t('tournamentManagement.manual', 'Manuelle'),
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
          {canManageTournament ? t(
            'tournamentManagement.competitionActions',
            'Actions compétition',
          ) : t(
            'tournamentManagement.competitionView',
            'Lecture compétition',
          )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {canManageTournament
            ? t('tournamentManagement.runTheDrawGenerateThe', 'Organise le tirage, génère les matchs, puis publie la compétition quand la structure est prête.')
            : t('tournamentManagement.youCanFollowGroupsMatches', 'Tu peux suivre les poules, les matchs, les classements et le bracket depuis ce cockpit en lecture seule.')}
        </Text>

        {canManageTournament ? (
          <View style={[Spaces.gap[12]]}>
            {renderActionButton({
              disabled: isCompetitionPublished,
              isLoading: setupCompetitionMutation.isPending,
              onPress: () => setupCompetitionMutation.mutate(),
              title: t('tournamentManagement.syncTheStructure', 'Synchroniser la structure'),
              variant: 'Secondary',
            })}
            {competitionActions.canDrawGroups ? renderActionButton({
              isLoading: drawGroupsMutation.isPending,
              onPress: () => drawGroupsMutation.mutate(),
              title: t('tournamentManagement.drawTheGroups', 'Tirer les poules'),
              variant: 'Primary',
            }) : null}
            {competitionActions.canGenerateMatches ? renderActionButton({
              isLoading: generateMatchesMutation.isPending,
              onPress: () => generateMatchesMutation.mutate(),
              title: t('tournamentManagement.generateTheMatches', 'Générer les matchs'),
              variant: 'Secondary',
            }) : null}
            {competitionActions.canGenerateKnockout ? renderActionButton({
              isLoading: generateKnockoutMutation.isPending,
              onPress: () => generateKnockoutMutation.mutate(),
              title: t('tournamentManagement.generateTheKnockoutStage', 'Générer la phase finale'),
              variant: 'Secondary',
            }) : null}
            {competitionActions.canPublish ? renderActionButton({
              isLoading: publishCompetitionMutation.isPending,
              onPress: handlePublishCompetition,
              title: t('tournamentManagement.publishTheCompetition', 'Publier la compétition'),
              variant: 'Primary',
            }) : null}
            {renderActionButton({
              onPress: () => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId }),
              title: t('tournamentManagement.editTheSettings', 'Modifier les paramètres'),
              variant: 'Secondary',
            })}
            <Button
              isLoading={closeTournamentMutation.isPending}
              onPress={handleCloseTournament}
              size="sm"
              style={{ borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title={t('tournamentManagement.closeTheTournament', 'Clôturer le tournoi')}
              variant="SecondaryLight"
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderTeamsTab = () => (
    <View style={Spaces.gap[16]}>
      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('tournamentManagement.registeredTeams', 'Équipes inscrites')}
        </Text>
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
      </View>

      {filteredTeams.length === 0 ? (
        <View style={tournamentDs.styles.panelCard}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{t('tournamentManagement.noTeamMatchesThisFilter', 'Aucune équipe ne correspond à ce filtre pour le moment.')}</Text>
        </View>
      ) : null}

      {filteredTeams.map((team) => {
        const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
        const statusMeta = getTournamentTeamStatusMeta(team?.status, Colors);
        const hasRosterWarning = isTournamentTeamNonCompliant(team, tournamentConfig);
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
                    : t(
                      'tournamentManagement.temporaryTeamCreatedByA',
                      'Équipe éphémère créée par un joueur',
                    )}
                </Text>
              </View>
              <Tag style={tournamentDs.getToneTagStyle(statusMeta.tone)} text={statusMeta.label} textColor="neutral00" textStyle={{ color: statusMeta.tone }} />
            </View>

            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${rosterSummary.totalCount} roster`} textColor="primary500" />
              <Tag style={{ backgroundColor: tournamentDs.colors.subtleSurface, borderColor: tournamentDs.colors.borderMuted }} text={`${rosterSummary.presentCount} presents`} textColor="neutral00" />
              <Tag style={{ backgroundColor: tournamentDs.colors.subtleSurface, borderColor: tournamentDs.colors.borderMuted }} text={`${rosterSummary.pendingCount} en attente`} textColor="neutral00" />
              {rosterSummary.invitedCount > 0 ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={`${rosterSummary.invitedCount} invitation${rosterSummary.invitedCount > 1 ? 's' : ''}`} textColor="primary500" />
              ) : null}
              {rosterSummary.requestedCount > 0 ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.warning500)} text={`${rosterSummary.requestedCount} demande${rosterSummary.requestedCount > 1 ? 's' : ''}`} textColor="warning500" />
              ) : null}
              {hasRosterWarning ? (
                <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text={t('tournamentManagement.rosterWarning', 'Warning roster')} textColor="gold500" />
              ) : null}
            </View>

            <View style={[Spaces.gap[12]]}>
              <Button
                onPress={() => navigation.navigate(RouteNames.TournamentTeamDetails, { eventId, teamId: team?.documentId })}
                title={t('tournamentManagement.openTheTeam', 'Ouvrir l équipe')}
                variant="Secondary"
              />
              {canManageTournament && normalizeTournamentText(team?.status) === 'pending' ? (
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
                    onPress={() => handleReview(team?.documentId, 'declined')}
                    size="sm"
                    style={{ borderColor: `${Colors.error500}55`, flex: 1 }}
                    textStyle={{ color: Colors.error500 }}
                    title={t('tournamentManagement.decline', 'Refuser')}
                    variant="SecondaryLight"
                  />
                </View>
              ) : null}
              {canManageTournament && normalizeTournamentText(team?.status) !== 'archived' ? (
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

  return (
    <ScreenContainer bottomInsetMode="tab-scene">
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
            Spaces.paddingBottom[40],
            Spaces.gap[24],
          ]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>
              {t('tournamentManagement.tournamentControl', 'Pilotage du tournoi')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {t('tournamentManagement.drawTheGroupsGenerateThe', 'Tire les poules, génère les matchs, calcule les classements et pilote la phase finale depuis un seul cockpit.')}
            </Text>
          </View>

          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            {renderSummaryCard('Equipes', tournamentTeams.length, Colors.primary500)}
            {renderSummaryCard('Poules', dashboard?.overview?.groups || 0, Colors.primary500)}
            {renderSummaryCard('Matchs', dashboard?.overview?.totalMatches || 0, Colors.success500)}
            {renderSummaryCard('Warnings', counters.warning, Colors.gold500)}
          </View>

          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {TAB_OPTIONS.map((option) => {
              const selected = activeTab === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setActiveTab(option.value)}
                  style={tournamentDs.getPillStyle(selected)}
                >
                  <Text style={[Fonts.p4Bold, selected ? Fonts.primary100 : Fonts.neutral200]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {renderActiveTab()}
        </ScrollView>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TournamentManagement;
