import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClub } from '@/services/club/clubQueries';

/**
 * Etape 4/8 du tunnel equipe — sports du club en cartes (tag « Sport du club »),
 * le reste en chips + recherche, la selection avance directement (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardActivity({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [searchValue, setSearchValue] = useState('');
  const activitiesQuery = useGetActivities();
  const clubQuery = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });
  const {
    data: activities,
    error: activitiesError,
    isLoading,
  } = activitiesQuery;
  const hasError = Boolean(activitiesError);
  const isClubMissing = !state.clubId;

  const clubActivityIds = useMemo(() => new Set(
    (clubQuery.data?.activities || [])
      .map((/** @type {any} */ activity) => String(activity?.documentId || '').trim())
      .filter(Boolean),
  ), [clubQuery.data?.activities]);

  const normalizedSearch = searchValue.trim().toLowerCase();
  const allActivities = useMemo(
    () => (Array.isArray(activities) ? activities : [])
      .filter((activity) => activity?.documentId && activity?.name),
    [activities],
  );
  const filteredActivities = useMemo(() => {
    if (!normalizedSearch) {
      return allActivities;
    }
    return allActivities.filter(
      (activity) => String(activity.name).toLowerCase().includes(normalizedSearch),
    );
  }, [allActivities, normalizedSearch]);
  const clubActivities = useMemo(
    () => filteredActivities.filter((activity) => clubActivityIds.has(activity.documentId)),
    [clubActivityIds, filteredActivities],
  );
  const otherActivities = useMemo(
    () => filteredActivities.filter((activity) => !clubActivityIds.has(activity.documentId)),
    [clubActivityIds, filteredActivities],
  );

  useEffect(() => {
    if (allActivities.length === 1) {
      const singleSportId = allActivities[0].documentId;
      if (singleSportId && state.activities !== singleSportId) {
        dispatch({ payload: singleSportId, type: 'SET_ACTIVITY' });
      }
      return;
    }

    if (state.activities
      && !allActivities.some((activity) => activity.documentId === state.activities)) {
      dispatch({ payload: '', type: 'SET_ACTIVITY' });
    }
  }, [allActivities, dispatch, state.activities]);

  const handleSelectActivity = (/** @type {string} */ activityDocumentId) => {
    dispatch({ payload: activityDocumentId, type: 'SET_ACTIVITY' });
    navigation.navigate(RouteNames.TeamWizardCategory);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.activities || isLoading || hasError || isClubMissing}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      stepCount={8}
      stepIndex={4}
      subtitle={t('teamWizard.steps.activity.subtitle', "Le sport principal de l'équipe.")}
      title={t('teamWizard.steps.activity.title', 'Sport')}
    >
      <View>
        {isLoading ? (
          <View style={[{ alignItems: 'center', flexDirection: 'row' }, Spaces.gap[12], Spaces.marginBottom[16]]}>
            <ActivityIndicator size="small" />
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Chargement des sports disponibles…
            </Text>
          </View>
        ) : null}

        {isClubMissing ? (
          <View style={Spaces.marginBottom[16]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Club introuvable pour initialiser la création de l’équipe. Reviens à la liste des équipes puis relance le wizard.
            </Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Impossible de charger le référentiel des sports. Réessaie pour continuer.
            </Text>
            <Button
              onPress={() => activitiesQuery.refetch()}
              title="Réessayer"
              variant="Secondary"
            />
          </View>
        ) : null}

        {!isLoading && !hasError ? (
          <>
            <View style={Spaces.marginBottom[16]}>
              <Input
                density="compact"
                icon="search"
                onChangeText={setSearchValue}
                placeholder={t('teamWizard.steps.activity.searchPlaceholder', 'Rechercher un sport…')}
                value={searchValue}
              />
            </View>

            {clubActivities.length > 0 ? (
              <>
                <Text
                  style={[
                    Fonts.p3Bold,
                    Fonts.neutral300,
                    Spaces.marginBottom[8],
                    { letterSpacing: 1, textTransform: 'uppercase' },
                  ]}
                >
                  {t('teamWizard.steps.activity.clubSports', 'Les sports de ton club')}
                </Text>
                {clubActivities.map((activity) => (
                  <WizardOptionCard
                    key={activity.documentId}
                    onPress={() => handleSelectActivity(activity.documentId)}
                    selected={state.activities === activity.documentId}
                    tag={t('teamWizard.steps.activity.clubSportTag', 'Sport du club')}
                    title={activity.name}
                  />
                ))}
              </>
            ) : null}

            {otherActivities.length > 0 ? (
              <>
                <Text
                  style={[
                    Fonts.p3Bold,
                    Fonts.neutral300,
                    Spaces.marginBottom[8],
                    Spaces.marginTop[8],
                    { letterSpacing: 1, textTransform: 'uppercase' },
                  ]}
                >
                  {t('teamWizard.steps.activity.allSports', 'Autres sports')}
                </Text>
                <View style={[Alignments.row, { columnGap: 9, flexWrap: 'wrap', rowGap: 9 }]}>
                  {otherActivities.map((activity) => {
                    const isSelected = state.activities === activity.documentId;
                    return (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={activity.documentId}
                        onPress={() => handleSelectActivity(activity.documentId)}
                        style={{
                          backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                          borderColor: isSelected ? Colors.primary500 : 'rgba(1,179,244,0.3)',
                          borderRadius: 999,
                          borderWidth: 1.5,
                          paddingHorizontal: 15,
                          paddingVertical: 9,
                        }}
                      >
                        <Text
                          style={[
                            Fonts.p3Bold,
                            { color: isSelected ? Colors.primary900 : Colors.neutral100 },
                          ]}
                        >
                          {activity.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {filteredActivities.length === 0 ? (
              <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
                {normalizedSearch
                  ? 'Aucun sport ne correspond à ta recherche.'
                  : 'Aucun sport n’est disponible pour le moment.'}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardActivity;
