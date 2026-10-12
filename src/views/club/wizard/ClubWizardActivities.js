import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import ChoixDuSport from '@/components/organisms/choixDuSport/ChoixDuSport';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

/**
 * Étape 3/5 — sports/activités du club (multi-sélection, au moins un).
 * FINITIONS-VILLE (T20 P09) : LE choix du sport de l'app (`ChoixDuSport`, décision A09 d'Adel) —
 * les populaires d'abord, la recherche, puis de A à Z, les doublons de la base fondus — au lieu
 * d'une liste alphabétique maison ; choix multiple, sans « Tous les sports ».
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardActivities({ navigation, route }) {
  const { t } = useTranslation();
  const { Colors, Spaces } = useTheme();
  const { dispatch, state } = useClubWizard();

  const entry = route?.params?.entry || 'search';

  const { data: activities, isLoading } = useGetActivities();

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
      {isLoading ? (
        <View style={[Spaces.marginTop[24]]}>
          <ActivityIndicator color={Colors.primary500} />
        </View>
      ) : (
        <ChoixDuSport
          multiple
          onChoisir={(/** @type {string} */ cle) => dispatch({
            payload: cle, type: 'TOGGLE_ACTIVITY',
          })}
          sansTousLesSports
          sports={activities}
          valeurs={selected}
        />
      )}
    </WizardStepLayout>
  );
}

export default ClubWizardActivities;
