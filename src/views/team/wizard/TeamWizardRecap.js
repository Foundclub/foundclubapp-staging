import { useMemo } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { createTeam } from '@/services/team/teamService';
import useTheme from '@/theme/themeContext';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardRecap({ navigation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { state, dispatch } = useTeamWizard();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const { data: activities } = useGetActivities();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();
  const { data: sections } = useGetSections();
  const { data: clubData } = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      const targetClubId = selectedOverview.clubId;
      dispatch({ type: 'RESET' });
      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.TeamList,
          params: targetClubId ? { clubId: targetClubId } : undefined,
        }],
      });
    },
    onError: (error) => {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : t('APIerrors.unknown');
      Alert.alert(t('common.error', 'Erreur'), message);
    },
  });

  const isRecapReady = useMemo(
    () => Boolean(
      selectedOverview.name
      && selectedOverview.section
      && selectedOverview.activity
      && selectedOverview.category
      && selectedOverview.level
      && selectedOverview.clubId,
    ),
    [selectedOverview.activity, selectedOverview.category, selectedOverview.clubId, selectedOverview.level, selectedOverview.name, selectedOverview.section],
  );

  const handleSubmit = () => {
    if (!selectedOverview.clubId) {
      Alert.alert(t('common.error', 'Erreur'), t('teamWizard.errors.clubRequired', 'Club introuvable. Recommence la creation depuis la liste equipe.'));
      return;
    }

    createTeamMutation.mutate(/** @type {any} */ ({
      name: selectedOverview.name,
      description: selectedOverview.description,
      activities: selectedOverview.activity ? [selectedOverview.activity] : [],
      category: selectedOverview.category || undefined,
      level: selectedOverview.level || undefined,
      section: selectedOverview.section || undefined,
      trainers: selectedOverview.trainers,
      club: selectedOverview.clubId,
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
    collection?.find((item) => item?.documentId === value)?.name || value || t('eventWizard.recap.notSet', 'Non renseigne')
  );

  const activityLabel = getLabelFromCollection(activities, selectedOverview.activity);
  const sectionLabel = getLabelFromCollection(sections, selectedOverview.section);
  const categoryLabel = getLabelFromCollection(categories, selectedOverview.category);
  const levelLabel = getLabelFromCollection(levels, selectedOverview.level);
  const clubLabel = clubData?.name || t('eventWizard.recap.notSet', 'Non renseigne');

  return (
    <WizardStepLayout
      title={t('teamWizard.steps.recap.title', 'Recapitulatif')}
      subtitle={t('teamWizard.steps.recap.subtitle', 'Verifie les informations avant de creer l equipe.')}
      stepIndex={8}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
      onNext={handleSubmit}
      onSkip={() => {}}
      nextLabel={t('teamWizard.actions.create', 'Creer l equipe')}
      isNextLoading={createTeamMutation.isPending}
      isNextDisabled={!isRecapReady}
    >
      <View style={[Spaces.gap[16]]}>
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
              {t('teamWizard.recap.summaryTitle', 'Vue d ensemble')}
            </Text>
            <View
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                {
                  backgroundColor: isRecapReady ? 'rgba(1, 179, 244, 0.18)' : 'rgba(255, 191, 71, 0.18)',
                  borderColor: isRecapReady ? Colors.primary500 : Colors.gold500,
                  borderWidth: 1,
                  borderRadius: 999,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, isRecapReady ? Fonts.primary500 : Fonts.gold500]}>
                {isRecapReady
                  ? t('teamWizard.recap.ready', 'Pret a creer')
                  : t('teamWizard.recap.incomplete', 'Champs manquants')}
              </Text>
            </View>
          </View>

          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('teamWizard.recap.quickHint', 'Nom, section, sport, categorie, niveau et club sont requis.')}
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
            <Text style={[Fonts.p2, Fonts.neutral00]}>{selectedOverview.name || t('eventWizard.recap.notSet', 'Non renseigne')}</Text>
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
              {t('teamEdit.fields.section.label')}: {sectionLabel}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('teamEdit.fields.activities.label')}: {activityLabel}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('teamEdit.fields.category.label')}: {categoryLabel}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('teamEdit.fields.level.label')}: {levelLabel}
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
              defaultValue: `${selectedOverview.trainers.length} entraineur(s)`,
            })}
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardRecap;
