import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import i18next from 'i18next';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeams } from '@/services/team/teamQueries';
import { updateTeam } from '@/services/team/teamService';

const getTeamDisplayName = (team) => String(team?.name || i18next.t(
  'assignCoachTeams.fallbacks.team',
  'Équipe',
)).trim() || i18next.t(
  'assignCoachTeams.fallbacks.team',
  'Équipe',
);

/**
 * @param {Team} team
 * @param {string} trainerId
 * @returns {boolean}
 */
const isTrainerAlreadyAssigned = (team, trainerId) => {
  if (!team || !trainerId) return false;
  return (team?.trainers || []).some((trainer) => trainer?.documentId === trainerId);
};

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function AssignCoachTeams({ navigation, route }) {
  const clubId = sanitizeRouteParam(route?.params?.clubId);
  const trainerId = sanitizeRouteParam(route?.params?.trainerId)
    || sanitizeRouteParam(route?.params?.coachId);
  const trainerName = String(route?.params?.trainerName || '').trim();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const [selectedTeamIds, setSelectedTeamIds] = useState(/** @type {string[]} */([]));

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetTeams({
    clubId,
    pageSize: 20,
  }, {
    enabled: !!clubId,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const teams = useMemo(
    () => data?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [],
    [data],
  );

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!trainerId) {
        throw new Error('Trainer ID missing');
      }

      const teamIdsToAssign = selectedTeamIds.filter((teamId) => {
        const team = teams.find((item) => item?.documentId === teamId);
        return !isTrainerAlreadyAssigned(team, trainerId);
      });

      const results = await Promise.allSettled(
        teamIdsToAssign.map((teamId) => updateTeam({
          documentId: teamId,
          trainers: {
            connect: [{ documentId: trainerId }],
          },
        })),
      );

      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length > 0) {
        throw new Error('Some assignments failed');
      }
    },
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'assignCoachTeams.errors.assign',
          "Impossible d'assigner l'entraîneur aux équipes sélectionnées.",
        ),
      );
    },
    onSuccess: () => {
      Alert.alert(
        t('assignCoachTeams.alerts.success.title', 'Assignation terminée'),
        t(
          'assignCoachTeams.alerts.success.message',
          '{{trainerName}} a été assigné aux équipes sélectionnées.',
          {
            trainerName: trainerName
              || t('assignCoachTeams.alerts.success.trainerFallback', "L'entraîneur"),
            ...SANS_ECHAPPEMENT,
          },
        ),
        [{
          onPress: () => navigation.goBack(),
          text: t('common.actions.ok', 'OK'),
        }],
      );
    },
  });

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  /**
   * @param {string} teamId
   */
  const toggleTeamSelection = useCallback((teamId) => {
    setSelectedTeamIds((current) => (
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    ));
  }, []);

  const handleCreateTeam = useCallback(() => {
    navigation.navigate(RouteNames.TeamStack, {
      params: {
        clubId,
        preselectedTrainerId: trainerId,
      },
      screen: RouteNames.TeamWizardName,
    });
  }, [clubId, navigation, trainerId]);

  const handleAssignSelected = useCallback(() => {
    if (!trainerId) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'assignCoachTeams.errors.trainerNotFound',
          'Impossible de retrouver cet entraîneur. Merci de réessayer.',
        ),
      );
      return;
    }
    if (!selectedTeamIds.length) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('assignCoachTeams.errors.noTeamSelected', 'Sélectionne au moins une équipe.'),
      );
      return;
    }
    assignMutation.mutate();
  }, [assignMutation, selectedTeamIds.length, t, trainerId]);

  const renderEmptyList = useCallback(() => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius24,
        Alignments.alignCenter,
        Spaces.gap[16],
        Spaces.padding[24],
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('assignCoachTeams.empty.message', 'Aucune équipe pour le moment.')}
      </Text>
      <Button
        onPress={handleCreateTeam}
        title={t('assignCoachTeams.actions.createTeam', 'Créer une équipe')}
        variant="Secondary"
      />
    </View>
  ), [
    Alignments.alignCenter,
    ApplicationStyle.backgroundColor.primary900,
    ApplicationStyle.borderRadius24,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.textCenter,
    Spaces.gap,
    Spaces.padding,
    handleCreateTeam,
    t,
  ]);

  const renderItem = useCallback(({ item }) => {
    const teamId = item?.documentId || '';
    const isAssigned = isTrainerAlreadyAssigned(item, trainerId);
    const checked = selectedTeamIds.includes(teamId) || isAssigned;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (!teamId || isAssigned) return;
          toggleTeamSelection(teamId);
        }}
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.marginBottom[12],
          Spaces.padding[16],
          { borderColor: checked ? Colors.primary500 : `${Colors.primary500}33` },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <ClubLogoMark
            club={item?.club}
            name={item?.club?.name || getTeamDisplayName(item)}
            size={60}
          />
          <View style={[Alignments.fill, Spaces.gap[4]]}>
            {/* MARQUEE — le nom de l equipe se lit en entier */}
            <MarqueeText
              style={[Fonts.p1Bold, Fonts.neutral00]}
              text={getTeamDisplayName(item)}
            />
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {item?.activities?.[0]?.name || t('assignCoachTeams.fallbacks.team', 'Équipe')}
            </Text>
          </View>
          {isAssigned ? (
            <View
              style={[
                ApplicationStyle.backgroundColor.gold900,
                ApplicationStyle.borderRadius12,
                ApplicationStyle.borderWidth1,
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                { borderColor: `${Colors.gold500}66` },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.gold500]}>
                {t('assignCoachTeams.badges.alreadyAssigned', 'Déjà assigné')}
              </Text>
            </View>
          ) : (
            <View style={{ minWidth: 48 }}>
              <Checkable
                isChecked={selectedTeamIds.includes(teamId)}
                setIsChecked={() => toggleTeamSelection(teamId)}
                text=""
                type="square"
                wrapperStyle={[
                  {
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    justifyContent: 'center',
                    padding: 0,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [
    Alignments.alignCenter,
    Alignments.fill,
    Alignments.row,
    ApplicationStyle.backgroundColor.gold900,
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius12,
    ApplicationStyle.borderRadius24,
    ApplicationStyle.borderWidth1,
    Colors.gold500,
    Colors.primary500,
    Fonts.gold500,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.p3,
    Fonts.p4Bold,
    Fonts.primary100,
    Spaces.gap,
    Spaces.marginBottom,
    Spaces.padding,
    Spaces.paddingHorizontal,
    Spaces.paddingVertical,
    selectedTeamIds,
    toggleTeamSelection,
    trainerId,
    t,
  ]);

  const selectedCountLabel = useMemo(() => {
    if (!selectedTeamIds.length) {
      return t(
        'assignCoachTeams.selection.none',
        'Aucune équipe sélectionnée',
      );
    }
    if (selectedTeamIds.length === 1) {
      return t(
        'assignCoachTeams.selection.one',
        '1 équipe sélectionnée',
      );
    }
    return t(
      'assignCoachTeams.selection.many',
      '{{teamCount}} équipes sélectionnées',
      { teamCount: selectedTeamIds.length, ...SANS_ECHAPPEMENT },
    );
  }, [selectedTeamIds.length, t]);

  if (!clubId) {
    return (
      <ClubStateView
        description={t(
          'assignCoachTeams.state.missingClub.description',
          "Impossible d'ouvrir cette assignation sans club valide. Reviens à la demande "
            + "d'adhésion puis relance l'action.",
        )}
        title={t('assignCoachTeams.state.missingClub.title', 'Club introuvable')}
      />
    );
  }

  if (!trainerId) {
    return (
      <ClubStateView
        description={t(
          'assignCoachTeams.state.missingCoach.description',
          'Impossible de retrouver le coach à assigner. Reviens à la demande puis relance '
            + "l'assignation.",
        )}
        title={t('assignCoachTeams.state.missingCoach.title', 'Coach introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Spaces.paddingBottom[24],
      ]}
    >
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill]}>
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.marginBottom[16],
              Spaces.padding[16],
              { borderColor: `${Colors.primary500}33` },
            ]}
          >
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('assignCoachTeams.header.title', 'Assigner un entraîneur')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.primary500, Spaces.marginTop[8]]}>
              {trainerName || t('assignCoachTeams.header.userFallback', 'Utilisateur')}
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100, Spaces.marginTop[8]]}>
              {t('assignCoachTeams.header.hint', 'Cochez une ou plusieurs équipes, puis valide.')}
            </Text>
          </View>

          <FlashList
            data={teams}
            keyExtractor={(item, index) => item?.documentId || String(index)}
            ListEmptyComponent={renderEmptyList}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
          />

          <View
            style={[
              Spaces.gap[12],
              Spaces.paddingTop[12],
            ]}
          >
            <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter]}>
              {selectedCountLabel}
            </Text>
            <Button
              disabled={!selectedTeamIds.length || assignMutation.isPending || isLoading}
              isLoading={assignMutation.isPending}
              onPress={handleAssignSelected}
              title={t(
                'assignCoachTeams.actions.assignSelected',
                'Assigner aux équipes sélectionnées',
              )}
              variant="Primary"
            />
            <Button
              onPress={handleCreateTeam}
              title={t('assignCoachTeams.actions.createTeam', 'Créer une équipe')}
              variant="Secondary"
            />
          </View>
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default AssignCoachTeams;
