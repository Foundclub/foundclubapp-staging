import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  extractSubscriptionDecisionFromError,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { createTeam } from '@/services/team/teamService';

import { useAppMode } from '@/context/AppModeContext';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardRecap({ navigation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isGold } = useAppMode();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const {
    freeUsageSummary,
    subscriptionAccessLevel,
  } = useAuth();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const activitiesQuery = useGetActivities();
  const categoriesQuery = useGetCategories();
  const levelsQuery = useGetLevels();
  const sectionsQuery = useGetSections();
  const clubQuery = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });
  const { data: activities } = activitiesQuery;
  const { data: categories } = categoriesQuery;
  const { data: levels } = levelsQuery;
  const { data: sections } = sectionsQuery;
  const { data: clubData } = clubQuery;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const freeTeamQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'FREE_TEAM', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  const selectedOverview = useMemo(() => ({
    activity: state.activities || '',
    category: state.category || '',
    clubId: state.clubId || '',
    description: state.description?.trim() || '',
    level: state.level || '',
    name: state.name?.trim() || '',
    section: state.section || '',
    trainers: Array.isArray(state.trainers) ? state.trainers.filter(Boolean) : [],
  }), [state]);

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onError: (error) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : t('APIerrors.unknown');
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['get-me'] });
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
      const targetClubId = selectedOverview.clubId;
      dispatch({ type: 'RESET' });
      const rootRoute = isGold ? RouteNames.LeagueHomeTab : RouteNames.HomeTab;
      const targetScreen = isGold ? RouteNames.LeagueSquadTab : RouteNames.MyTeamList;
      const rootNavigation = navigation.getParent();

      if (rootNavigation) {
        rootNavigation.reset({
          index: 0,
          routes: [{
            name: rootRoute,
            params: {
              params: !isGold && targetClubId ? { clubId: targetClubId } : undefined,
              screen: targetScreen,
            },
          }],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.TeamList,
          params: targetClubId ? { clubId: targetClubId } : undefined,
        }],
      });
    },
  });

  const isRecapReady = useMemo(
    () => Boolean(
      selectedOverview.name
      && selectedOverview.section
      && selectedOverview.activity
      && selectedOverview.category
      && selectedOverview.level
      && selectedOverview.trainers.length > 0
      && selectedOverview.clubId,
    ),
    [
      selectedOverview.activity,
      selectedOverview.category,
      selectedOverview.clubId,
      selectedOverview.level,
      selectedOverview.name,
      selectedOverview.section,
      selectedOverview.trainers.length,
    ],
  );

  const isReferenceLoading = activitiesQuery.isLoading
    || categoriesQuery.isLoading
    || levelsQuery.isLoading
    || sectionsQuery.isLoading
    || (Boolean(state.clubId) && clubQuery.isLoading);

  const hasReferenceError = Boolean(
    activitiesQuery.error
    || categoriesQuery.error
    || levelsQuery.error
    || sectionsQuery.error
    || clubQuery.error,
  );

  const handleSubmit = () => {
    if (!selectedOverview.clubId) {
      Alert.alert(t('common.error', 'Erreur'), t('teamWizard.errors.clubRequired', 'Club introuvable. Recommence la création depuis la liste équipe.'));
      return;
    }
    if (selectedOverview.trainers.length === 0) {
      Alert.alert(t('common.error', 'Erreur'), t('teamWizard.errors.trainerRequired', 'Sélectionnez au moins un entraîneur.'));
      return;
    }

    createTeamMutation.mutate(/** @type {any} */ ({
      activities: selectedOverview.activity ? [selectedOverview.activity] : [],
      authorizedMembershipManagers: [],
      category: selectedOverview.category || undefined,
      club: selectedOverview.clubId,
      description: selectedOverview.description,
      level: selectedOverview.level || undefined,
      name: selectedOverview.name,
      section: selectedOverview.section || undefined,
      teamMembershipApprovalEnabledForCoaches: clubData?.membershipRequestManagementMode !== 'CLUB_OWNER_ONLY',
      trainers: selectedOverview.trainers,
    }));
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  /**
   * @param {{ documentId?: string, name?: string }[] | undefined} collection
   * @param {string} value
   * @returns {string}
   */
  const getLabelFromCollection = (collection, value) => (
    collection?.find((item) => item?.documentId === value)?.name || value || t('eventWizard.recap.notSet', 'Non renseigné')
  );

  const activityLabel = getLabelFromCollection(activities, selectedOverview.activity);
  const sectionLabel = getLabelFromCollection(sections, selectedOverview.section);
  const categoryLabel = getLabelFromCollection(categories, selectedOverview.category);
  const levelLabel = getLabelFromCollection(levels, selectedOverview.level);
  const clubLabel = clubData?.name || t('eventWizard.recap.notSet', 'Non renseigné');
  const teamMembershipModeLabel = clubData?.membershipRequestManagementMode === 'CLUB_OWNER_ONLY'
    ? t('teamWizard.recap.membership.ownerOnly', 'Demandes traitées par le dirigeant')
    : t('teamWizard.recap.membership.coachAllowed', 'Demandes délégables aux entraîneurs');

  return (
    <>
      <WizardStepLayout
        isNextDisabled={!isRecapReady || isReferenceLoading || hasReferenceError}
        isNextLoading={createTeamMutation.isPending}
        nextLabel={t('teamWizard.actions.create', "Créer l'équipe")}
        onBack={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
        onClose={handleExitWizard}
        onNext={handleSubmit}
        onSkip={() => {}}
        stepCount={8}
        stepIndex={8}
        subtitle={t('teamWizard.steps.recap.subtitle', "Vérifie les informations avant de créer l'équipe.")}
        title={t('teamWizard.steps.recap.title', 'Récapitulatif')}
      >
        <View style={[Spaces.gap[16]]}>
          {freeTeamQuotaItem ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('teamWizard.recap.freeQuota.title', 'Quota equipe gratuite')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'teamWizard.recap.freeQuota.description',
                  '{{remaining}}/{{total}} creation gratuite restante avant de devoir passer sur une offre Team ou Club.',
                  {
                    remaining: freeTeamQuotaItem.remaining,
                    total: freeTeamQuotaItem.total,
                  },
                )}
              </Text>
            </View>
          ) : null}

          {isReferenceLoading ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                <ActivityIndicator size="small" />
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Chargement du recapitulatif de cette equipe...
                </Text>
              </View>
            </View>
          ) : null}

          {hasReferenceError ? (
            <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], cardSurfaceStyle]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Impossible de charger toutes les informations du recapitulatif.
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Reessaye avant de creer cette equipe pour verifier le club, les referentiels et les entraineurs.
              </Text>
              <Button
                onPress={() => {
                  activitiesQuery.refetch();
                  categoriesQuery.refetch();
                  levelsQuery.refetch();
                  sectionsQuery.refetch();
                  if (state.clubId) {
                    clubQuery.refetch();
                  }
                }}
                title="Réessayer"
                variant="Secondary"
              />
            </View>
          ) : null}

          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[8],
              {
                ...cardSurfaceStyle,
                borderColor: isRecapReady ? 'rgba(1, 179, 244, 0.45)' : 'rgba(255, 191, 71, 0.35)',
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('teamWizard.recap.summaryTitle', 'Vue d\'ensemble')}
              </Text>
              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  {
                    backgroundColor: isRecapReady ? 'rgba(1, 179, 244, 0.18)' : 'rgba(255, 191, 71, 0.18)',
                    borderColor: isRecapReady ? Colors.primary500 : Colors.gold500,
                    borderRadius: 999,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, isRecapReady ? Fonts.primary500 : Fonts.gold500]}>
                  {isRecapReady
                    ? t('teamWizard.recap.ready', 'Prêt à créer')
                    : t('teamWizard.recap.incomplete', 'Champs manquants')}
                </Text>
              </View>
            </View>

            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('teamWizard.recap.quickHint', 'Nom, section, sport, catégorie, niveau, club et entraîneur sont requis.')}
            </Text>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('teamWizard.recap.organization', 'Organisation')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.TeamWizardName)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit', 'Modifier')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2, Fonts.neutral00]}>{selectedOverview.name || t('eventWizard.recap.notSet', 'Non renseigné')}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{clubLabel}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{selectedOverview.description || t('eventWizard.recap.noDescription', 'Aucune description')}</Text>
            </View>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('teamWizard.recap.sportProfile', 'Profil sportif')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.TeamWizardSection)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit', 'Modifier')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('teamEdit.fields.section.label')}
                :
                {sectionLabel}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('teamEdit.fields.activities.label')}
                :
                {activityLabel}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('teamEdit.fields.category.label')}
                :
                {categoryLabel}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t('teamEdit.fields.level.label')}
                :
                {levelLabel}
              </Text>
            </View>
          </View>

          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('teamWizard.recap.staff', 'Encadrement')}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate(RouteNames.TeamWizardTrainers)}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('eventWizard.recap.actions.edit', 'Modifier')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('teamWizard.recap.trainersCount', {
                count: selectedOverview.trainers.length,
                defaultValue: `${selectedOverview.trainers.length} entraîneur(s)`,
              })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {teamMembershipModeLabel}
            </Text>
          </View>
        </View>
      </WizardStepLayout>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={selectedOverview.clubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </>
  );
}

export default TeamWizardRecap;
