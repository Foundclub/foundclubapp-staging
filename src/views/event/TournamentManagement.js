import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
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

const TAB_OPTIONS = [
  { label: 'Vue d ensemble', value: 'overview' },
  { label: 'Equipes', value: 'teams' },
  { label: 'Poules', value: 'groups' },
  { label: 'Matchs', value: 'matches' },
  { label: 'Classements', value: 'standings' },
  { label: 'Phases finales', value: 'bracket' },
];

const TEAM_FILTER_OPTIONS = [
  { label: 'Toutes', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'Validees', value: 'accepted' },
  { label: 'Refusees', value: 'declined' },
  { label: 'Archivees', value: 'archived' },
  { label: 'Warnings roster', value: 'warning' },
];

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function TournamentManagement({ navigation, route }) {
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
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre a jour cette equipe.');
    },
    onSuccess: invalidate,
  });

  const closeTournamentMutation = useMutation({
    mutationFn: () => closeTournament(eventId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de cloturer ce tournoi.');
    },
    onSuccess: async () => {
      await invalidate();
      Alert.alert('Tournoi cloture', 'Le tournoi est maintenant ferme et les equipes ephemeres sont archivees.');
    },
  });

  const setupCompetitionMutation = useMutation({
    mutationFn: () => setupTournamentCompetition(eventId, tournamentConfig),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de synchroniser la structure du tournoi.');
    },
    onSuccess: invalidate,
  });

  const drawGroupsMutation = useMutation({
    mutationFn: () => drawTournamentGroups(eventId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de tirer les poules.');
    },
    onSuccess: invalidate,
  });

  const generateMatchesMutation = useMutation({
    mutationFn: () => generateTournamentMatches(eventId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de generer les matchs.');
    },
    onSuccess: invalidate,
  });

  const generateKnockoutMutation = useMutation({
    mutationFn: () => generateTournamentKnockout(eventId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de generer la phase finale.');
    },
    onSuccess: invalidate,
  });

  const publishCompetitionMutation = useMutation({
    mutationFn: () => publishTournamentCompetition(eventId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de publier cette competition.');
    },
    onSuccess: async () => {
      await invalidate();
      Alert.alert('Competition publiee', 'La structure sportive est maintenant verrouillee. Les horaires, installations et scores restent modifiables.');
    },
  });

  const renderSummaryCard = (label, value, accentColor) => (
    <View
      key={label}
      style={tournamentDs.getMetricCardStyle(accentColor)}
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
      'Cloturer le tournoi',
      'Cette action archive toutes les equipes ephemeres et gele les modifications sur la competition.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => closeTournamentMutation.mutate(),
          style: 'destructive',
          text: 'Cloturer',
        },
      ],
    );
  };

  const handlePublishCompetition = () => {
    Alert.alert(
      'Publier la competition',
      'Apres publication, la structure sportive sera verrouillee. Seuls les horaires, installations et scores resteront modifiables.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => publishCompetitionMutation.mutate(),
          text: 'Publier',
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
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Structure sportive</Text>
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
            <Tag style={tournamentDs.getToneTagStyle(Colors.success500)} text="Bracket genere" textColor="neutral00" textStyle={{ color: Colors.success500 }} />
          ) : null}
          {counters.warning > 0 ? (
            <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text={`${counters.warning} warning(s) roster`} textColor="gold500" />
          ) : null}
        </View>

        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{`Validation des equipes: ${tournamentConfig?.registrationMode === 'auto' ? 'Automatique' : 'Manuelle'}`}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{`Points: V ${tournamentConfig?.pointsWin ?? 3} | N ${tournamentConfig?.pointsDraw ?? 1} | D ${tournamentConfig?.pointsLoss ?? 0} | F ${tournamentConfig?.pointsForfeit ?? 0}`}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{`Generation des matchs: ${tournamentConfig?.matchGenerationMode === 'manual' ? 'Manuelle' : 'Automatique'}`}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{`Tirage: ${seedingLabel}`}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{`Qualifies / poule: ${tournamentConfig?.qualifiedPerGroup ?? 2}`}</Text>
          {String(tournamentConfig?.rulesText || '').trim() ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>{String(tournamentConfig.rulesText).trim()}</Text>
          ) : null}
        </View>
      </View>

      <View
        style={tournamentDs.styles.panelCard}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {canManageTournament ? 'Actions competition' : 'Lecture competition'}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {canManageTournament
            ? 'Organise le tirage, genere les matchs, puis publie la competition quand la structure est prete.'
            : 'Vous pouvez suivre les poules, les matchs, les classements et le bracket depuis ce cockpit en lecture seule.'}
        </Text>

        {canManageTournament ? (
          <View style={[Spaces.gap[12]]}>
            {renderActionButton({
              disabled: isCompetitionPublished,
              isLoading: setupCompetitionMutation.isPending,
              onPress: () => setupCompetitionMutation.mutate(),
              title: 'Synchroniser la structure',
              variant: 'Secondary',
            })}
            {competitionActions.canDrawGroups ? renderActionButton({
              isLoading: drawGroupsMutation.isPending,
              onPress: () => drawGroupsMutation.mutate(),
              title: 'Tirer les poules',
              variant: 'Primary',
            }) : null}
            {competitionActions.canGenerateMatches ? renderActionButton({
              isLoading: generateMatchesMutation.isPending,
              onPress: () => generateMatchesMutation.mutate(),
              title: 'Generer les matchs',
              variant: 'Secondary',
            }) : null}
            {competitionActions.canGenerateKnockout ? renderActionButton({
              isLoading: generateKnockoutMutation.isPending,
              onPress: () => generateKnockoutMutation.mutate(),
              title: 'Generer la phase finale',
              variant: 'Secondary',
            }) : null}
            {competitionActions.canPublish ? renderActionButton({
              isLoading: publishCompetitionMutation.isPending,
              onPress: handlePublishCompetition,
              title: 'Publier la competition',
              variant: 'Primary',
            }) : null}
            {renderActionButton({
              onPress: () => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId }),
              title: 'Modifier les parametres',
              variant: 'Secondary',
            })}
            <Button
              isLoading={closeTournamentMutation.isPending}
              onPress={handleCloseTournament}
              size="sm"
              style={{ borderColor: `${Colors.error500}55` }}
              textStyle={{ color: Colors.error500 }}
              title="Cloturer le tournoi"
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
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Equipes inscrites</Text>
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
          <Text style={[Fonts.p2, Fonts.neutral100]}>Aucune equipe ne correspond a ce filtre pour le moment.</Text>
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
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{team?.name || 'Equipe tournoi'}</Text>
                <Text style={[Fonts.p4, Fonts.primary100]}>
                  {team?.sourceType === 'club_team'
                    ? `Depuis ${team?.sourceTeam?.name || 'une equipe club'}`
                    : 'Equipe ephemere creee par un joueur'}
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
                <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text="Warning roster" textColor="gold500" />
              ) : null}
            </View>

            <View style={[Spaces.gap[12]]}>
              <Button
                onPress={() => navigation.navigate(RouteNames.TournamentTeamDetails, { eventId, teamId: team?.documentId })}
                title="Ouvrir l equipe"
                variant="Secondary"
              />
              {canManageTournament && normalizeTournamentText(team?.status) === 'pending' ? (
                <View style={[Alignments.row, Spaces.gap[12]]}>
                  <Button
                    isLoading={reviewMutation.isPending}
                    onPress={() => handleReview(team?.documentId, 'accepted')}
                    size="sm"
                    style={{ flex: 1 }}
                    title="Valider"
                    variant="Primary"
                  />
                  <Button
                    isLoading={reviewMutation.isPending}
                    onPress={() => handleReview(team?.documentId, 'declined')}
                    size="sm"
                    style={{ borderColor: `${Colors.error500}55`, flex: 1 }}
                    textStyle={{ color: Colors.error500 }}
                    title="Refuser"
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
                  title="Archiver l equipe"
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
            <Text style={[Fonts.p2, Fonts.neutral100]}>Aucun match genere pour le moment.</Text>
          </View>
        );
      }
      return (
        <View style={Spaces.gap[12]}>
          {dashboard.matches.map((match) => (
            <TournamentMatchCard
              ctaLabel="Voir le match"
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
    <ScreenContainer>
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[24], Spaces.paddingBottom[12]]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
      </View>
      <WithDataWrapper data={dashboard} error={error} isLoading={isLoading} onRetry={refetch}>
        <ScrollView contentContainerStyle={tournamentDs.styles.screenContent}>
          <View style={tournamentDs.styles.screenIntro}>
            <Text style={[Fonts.h2, Fonts.neutral00]}>Pilotage du tournoi</Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              Tire les poules, genere les matchs, calcule les classements et pilote la phase finale depuis un seul cockpit.
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
