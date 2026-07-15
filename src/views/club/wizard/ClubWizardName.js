import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

/**
 * Étape 1/5 — nom du club, avec un rappel « c'est peut-être l'un de ceux-ci ? »
 * (les résultats de recherche live permettent de rejoindre un club existant
 * plutôt que d'en créer un doublon).
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardName({ navigation, route }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { dispatch, state } = useClubWizard();

  const entry = route?.params?.entry || 'search';
  const initialName = route?.params?.initialName;

  const [debouncedName, setDebouncedName] = useState('');

  useEffect(() => {
    // Préremplissage depuis la recherche d'affiliation (une seule fois).
    if (initialName && !state.name) {
      dispatch({ payload: initialName, type: 'SET_NAME' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const value = String(state.name || '').trim();
    const timer = setTimeout(() => setDebouncedName(value), 300);
    return () => clearTimeout(timer);
  }, [state.name]);

  const { data: clubsData } = useGetClubs(
    { name: debouncedName },
    { enabled: debouncedName.length >= 3 },
  );

  const suggestions = useMemo(() => {
    const pages = clubsData?.pages || [];
    const clubs = pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
    return clubs.slice(0, 3);
  }, [clubsData]);

  const canContinue = String(state.name || '').trim().length >= 2;

  return (
    <WizardStepLayout
      isNextDisabled={!canContinue}
      nextLabel={t('common.next', 'Suivant')}
      onClose={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.ClubWizardAddress, { entry })}
      stepCount={STEP_COUNT}
      stepIndex={1}
      subtitle={t(
        'clubWizard.name.subtitle',
        'Donne le nom officiel de ton club. On vérifie au passage qu\'il n\'existe pas déjà.',
      )}
      title={t('clubWizard.name.title', 'Quel est le nom de ton club ?')}
    >
      <Input
        autoCapitalize="words"
        label={t('clubWizard.name.label', 'Nom du club')}
        onChangeText={(value) => dispatch({ payload: value, type: 'SET_NAME' })}
        placeholder={t('clubWizard.name.placeholder', 'FC Marseille')}
        value={state.name}
      />

      {suggestions.length > 0 ? (
        <View style={[Spaces.marginTop[24]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200, Spaces.marginBottom[12]]}>
            {t('clubWizard.name.duplicateHint', 'C\'est peut-être l\'un de ceux-ci ?')}
          </Text>
          {suggestions.map((club) => (
            <View key={club.documentId} style={[Spaces.marginBottom[8]]}>
              <WizardOptionCard
                compact
                onPress={() => navigation.navigate(RouteNames.Club, {
                  clubId: club.documentId,
                  ...(entry === 'onboarding' ? { fromOnboardingAffiliation: true } : {}),
                })}
                subtitle={club?.addressDetails || undefined}
                title={club?.name}
              />
            </View>
          ))}
        </View>
      ) : null}
    </WizardStepLayout>
  );
}

export default ClubWizardName;
