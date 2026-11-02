import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs, LinearGradient, Rect, Stop,
} from 'react-native-svg';

import { resolveMyClubDocumentId } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction, emitGuidanceRefusal } from '@/domains/guidance/guidanceRuntime';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { isOrphanTeam, isTeamTrainer } from '@/domains/team/teamMembership';
import { isDeletedAccount } from '@/domains/user/deletedAccount';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';

import { useGetClub } from '@/services/club/clubQueries';
import { claimTeamAsCoach } from '@/services/team/teamService';
import { createTeamMembershipRequest } from '@/services/teamMembershipRequest/teamMembershipRequestService';

import { useTour } from '@/context/useTour';

/**
 * Question de la mission 1 du guide Entraîneur (FIN-GUIDE, point 1, Adel 02/11) : « si y'a des
 * équipes ça pose la question êtes vous entraîneurs de une de ces équipes, sinon créer la vôtre ».
 * Même source et mêmes gestes que le choix du tunnel équipe (`TeamWizardName`) : les équipes du
 * club, une demande au club, ou la reprise d'une équipe sans entraîneur·e. Club sans équipe ou
 * illisible : le guide continue, jamais bloqué.
 * @returns {import('react').ReactElement} L'écran plein cadre.
 */
function TourTeamChoice() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { refetchUserData, userData } = /** @type {any} */ (useAuth());
  const { completeCurrentStep, pauseTour } = useTour();
  const [selectedId, setSelectedId] = useState(/** @type {string | null} */ (null));

  const clubId = resolveMyClubDocumentId(userData) || undefined;
  const clubQuery = /** @type {any} */ (useGetClub(clubId, { enabled: Boolean(clubId) }));
  const isSettled = Boolean(clubQuery.isFetched || clubQuery.isError);
  const teams = useMemo(
    () => (Array.isArray(clubQuery.data?.teams) ? clubQuery.data.teams : []),
    [clubQuery.data],
  );
  // Le profil, servi par un cache, peut ne pas encore dire ce que l'équipe dit déjà.
  const trained = teams.find((/** @type {any} */ team) => isTeamTrainer(team, userData));
  const trainedName = trained?.name;
  const isTrained = Boolean(trained);
  const hasNoTeam = isSettled && teams.length === 0;

  useEffect(() => {
    if (isTrained) emitGuidanceAction('team.trained', { teamName: trainedName || '' });
    else if (hasNoTeam) completeCurrentStep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNoTeam, isTrained]);

  const selected = teams.find((/** @type {any} */ team) => team?.documentId === selectedId);

  const requestMutation = useMutation({
    meta: { preventToastError: true },
    mutationFn: (/** @type {any} */ team) => createTeamMembershipRequest({
      team: team.documentId,
      user: userData?.documentId,
    }),
    onError: (/** @type {any} */ error) => {
      Alert.alert(
        t('onboarding.trainedTeams.errorTitle', 'Demande non envoyée'),
        error?.message
          || t(
            'onboarding.trainedTeams.errorMessage',
            'Impossible d\'envoyer ta demande pour le moment. Réessaie dans un instant.',
          ),
      );
    },
    onSuccess: async (/** @type {any} */ _result, /** @type {any} */ team) => {
      await Promise.resolve(refetchUserData?.()).catch(() => {});
      emitGuidanceAction('team.requested', { teamName: team?.name || '' });
    },
  });

  const claimMutation = useMutation({
    meta: { preventToastError: true },
    mutationFn: (/** @type {any} */ team) => claimTeamAsCoach(team.documentId),
    onError: (/** @type {any} */ error) => {
      // Quota : la mission l'apprend, et la carte du guide le dit (`refusals` de M1).
      if (extractSubscriptionDecisionFromError(error)) {
        emitGuidanceRefusal('paywall.team-limit');
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.response?.data?.error?.message
          || t('teamWizardName.claim.error', 'Impossible de reprendre cette équipe pour le moment.'),
      );
    },
    onSuccess: async (/** @type {any} */ _result, /** @type {any} */ team) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
      ]).catch(() => {});
      emitGuidanceAction('team.trained', { teamName: team?.name || '' });
    },
  });

  const isSending = requestMutation.isPending || claimMutation.isPending;
  const confirm = () => {
    if (!selected || isSending) return;
    if (isOrphanTeam(selected, userData)) claimMutation.mutate(selected);
    else requestMutation.mutate(selected);
  };

  return (
    <View style={{
      bottom: 0, left: 0, position: 'absolute', right: 0, top: 0,
    }}
    >
      <Svg height="100%" style={{ position: 'absolute' }} width="100%">
        <Defs>
          <LinearGradient id="tourTeamChoice" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={Colors.primary900} stopOpacity={0.95} />
            <Stop offset="1" stopColor={Colors.primary800} stopOpacity={0.98} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#tourTeamChoice)" height="100%" width="100%" x={0} y={0} />
      </Svg>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 16,
          paddingHorizontal: 22,
          paddingTop: Math.max(64, insets.top + 24),
          rowGap: 12,
        }}
      >
        <Text style={[Fonts.p3Black, {
          color: Colors.primary500,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }]}
        >
          {t('tourGuide.mission', 'Mission')}
          {' 1'}
        </Text>
        <Text style={[Fonts.h1Black, { color: Colors.neutral00, fontSize: 25, lineHeight: 32 }]}>
          {t('tourCatalog.coach.m1-choice.title', 'Es-tu entraîneur·e d’une de ces équipes ?')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
          {t(
            'tourCatalog.coach.m1-choice.body',
            'Ton club est déjà sur FoundClub. Choisis ton équipe : ta demande part au club. Sinon, tu crées la tienne.', // eslint-disable-line max-len
          )}
        </Text>
        {isSettled ? teams.map((/** @type {any} */ team) => {
          const isOrphan = isOrphanTeam(team, userData);
          const activeTrainers = (Array.isArray(team?.trainers) ? team.trainers : [])
            .filter((/** @type {any} */ trainer) => !isDeletedAccount(trainer));
          return (
            <WizardOptionCard
              compact
              key={team?.documentId || team?.name}
              onPress={() => setSelectedId(team?.documentId)}
              selected={team?.documentId === selectedId}
              subtitle={isOrphan
                ? t('teamWizardName.chooser.orphan', 'Sans entraîneur·e — reprends-la')
                : t('teamWizardName.chooser.trainerCount', {
                  count: activeTrainers.length,
                  defaultValue_one: '{{count}} entraîneur·e',
                  defaultValue_other: '{{count}} entraîneur·es',
                })}
              title={team?.name || t('teamWizardName.chooser.teamFallback', 'Équipe')}
            />
          );
        }) : (
          <View style={{ alignItems: 'center', columnGap: 10, flexDirection: 'row' }}>
            <ActivityIndicator color={Colors.primary500} />
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
              {t('tourCatalog.coach.m1-choice.loading', 'Je regarde les équipes de ton club…')}
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={{
        paddingBottom: Math.max(40, insets.bottom + 16),
        paddingHorizontal: 22,
        rowGap: 8,
      }}
      >
        <Button
          disabled={!selected}
          isLoading={isSending}
          onPress={confirm}
          title={t('tourCatalog.coach.m1-choice.yes', 'Oui, c’est mon équipe')}
          variant="Primary"
        />
        <Button
          onPress={() => completeCurrentStep()}
          title={t('tourCatalog.coach.m1-choice.no', 'Non, je crée la mienne')}
          variant="Secondary"
        />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={pauseTour}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
          testID="Plus tard"
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
            {t('tourCatalog.coach.open.later', 'Plus tard')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default TourTeamChoice;
