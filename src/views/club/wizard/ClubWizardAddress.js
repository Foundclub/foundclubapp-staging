import { useTranslation } from 'react-i18next';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

/**
 * Étape 2/5 — adresse du club (OBLIGATOIRE). L'adresse géocodée alimente le
 * geohash (visibilité sur la carte) et sert d'anti-doublon côté serveur.
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardAddress({ navigation, route }) {
  const { t } = useTranslation();
  const { dispatch, state } = useClubWizard();

  const entry = route?.params?.entry || 'search';
  const hasCoordinates = Number.isFinite(state.addressOption?.lat)
    && Number.isFinite(state.addressOption?.lng);

  return (
    <WizardStepLayout
      isNextDisabled={!hasCoordinates}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.ClubWizardActivities, { entry })}
      stepCount={STEP_COUNT}
      stepIndex={2}
      subtitle={t(
        'clubWizard.address.subtitle',
        'Recherche l\'adresse de ton club. Elle le rend visible sur la carte et près des joueurs.',
      )}
      title={t('clubWizard.address.title', 'Où se trouve ton club ?')}
    >
      <AutocompleteAddressInput
        address={state.addressOption || undefined}
        label={t('clubWizard.address.label', 'Adresse du club')}
        placeholder={t('clubWizard.address.placeholder', 'Rue, ville…')}
        setAddress={(option) => dispatch({ payload: option || null, type: 'SET_ADDRESS' })}
      />
    </WizardStepLayout>
  );
}

export default ClubWizardAddress;
