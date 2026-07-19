import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

/**
 * Étape 3/5 — sports/activités du club (multi-sélection, au moins un).
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardActivities({ navigation, route }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useClubWizard();

  const entry = route?.params?.entry || 'search';
  const [search, setSearch] = useState('');

  const { data: activities, isLoading } = useGetActivities();

  const filtered = useMemo(() => {
    const list = Array.isArray(activities) ? activities : [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((activity) => String(activity?.name || '').toLowerCase().includes(query));
  }, [activities, search]);

  const selected = Array.isArray(state.activityDocumentIds) ? state.activityDocumentIds : [];
  const canContinue = selected.length > 0;

  return (
    <WizardStepLayout
      isNextDisabled={!canContinue}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.ClubWizardContact, { entry })}
      stepCount={STEP_COUNT}
      stepIndex={3}
      subtitle={t(
        'clubWizard.activities.subtitle',
        'Sélectionne les sports pratiqués dans ton club (tu pourras en ajouter plus tard).',
      )}
      title={t('clubWizard.activities.title', 'Quels sports pratiques-tu ?')}
    >
      <Input
        label={t('clubWizard.activities.searchLabel', 'Rechercher un sport')}
        onChangeText={setSearch}
        placeholder={t('clubWizard.activities.searchPlaceholder', 'Football, basket…')}
        value={search}
      />

      {isLoading ? (
        <View style={[Spaces.marginTop[24]]}>
          <ActivityIndicator color={Colors.primary500} />
        </View>
      ) : (
        <View style={[Spaces.marginTop[16]]}>
          {filtered.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('clubWizard.activities.empty', 'Aucun sport ne correspond.')}
            </Text>
          ) : filtered.map((activity) => (
            <View key={activity.documentId} style={[Spaces.marginBottom[8]]}>
              <WizardOptionCard
                compact
                multi
                onPress={() => dispatch({ payload: activity.documentId, type: 'TOGGLE_ACTIVITY' })}
                selected={selected.includes(activity.documentId)}
                title={activity.name}
              />
            </View>
          ))}
        </View>
      )}
    </WizardStepLayout>
  );
}

export default ClubWizardActivities;
