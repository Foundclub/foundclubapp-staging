import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useClubWizard } from './ClubWizardContext';

const STEP_COUNT = 5;

const isValidOptionalEmail = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

/**
 * Étape 4/5 — coordonnées du club (email/téléphone, facultatifs). Étape passable.
 * FINITIONS-VILLE (« créateur C », 08/10) : la case « je suis aussi dirigeant » (décision B2),
 * DÉCOCHÉE par défaut, laissait des clubs sans dirigeant ; elle devient la question obligatoire
 * « Qui dirige ce club ? » du récapitulatif.
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardContact({ navigation, route }) {
  const { t } = useTranslation();
  const { Spaces } = useTheme();
  const { dispatch, state } = useClubWizard();

  const entry = route?.params?.entry || 'search';

  const emailValid = isValidOptionalEmail(state.email);

  const goNext = () => navigation.navigate(RouteNames.ClubWizardRecap, { entry });

  return (
    <WizardStepLayout
      isNextDisabled={!emailValid}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onClose={() => navigation.goBack()}
      onNext={goNext}
      onSkip={goNext}
      showSkip
      skipLabel={t('clubWizard.contact.skip', 'Passer cette étape')}
      stepCount={STEP_COUNT}
      stepIndex={4}
      subtitle={t(
        'clubWizard.contact.subtitle',
        'Ces coordonnées aident les joueurs à contacter ton club. Tu peux les ajouter plus tard.',
      )}
      title={t('clubWizard.contact.title', 'Coordonnées du club')}
    >
      <Input
        autoCapitalize="none"
        error={emailValid ? undefined : t(
          'clubWizard.contact.emailInvalid',
          'Adresse email invalide.',
        )}
        keyboardType="email-address"
        label={t('clubWizard.contact.emailLabel', 'Email du club (facultatif)')}
        onChangeText={(value) => dispatch({ payload: value, type: 'SET_EMAIL' })}
        placeholder={t('clubWizard.contact.emailPlaceholder', 'contact@club.fr')}
        value={state.email}
      />

      <View style={[Spaces.marginTop[16]]}>
        <Input
          keyboardType="phone-pad"
          label={t('clubWizard.contact.phoneLabel', 'Téléphone du club (facultatif)')}
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_PHONE' })}
          placeholder={t('clubWizard.contact.phonePlaceholder', '0612345678')}
          value={state.phoneNumber}
        />
      </View>
    </WizardStepLayout>
  );
}

export default ClubWizardContact;
