import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
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
 * Étape 4/5 — coordonnées du club (email/téléphone, facultatifs) et, pour un
 * coach, l'option « je suis aussi dirigeant » (décision B2). Étape passable.
 * @param {any} props
 * @returns {import('react').ReactElement}
 */
function ClubWizardContact({ navigation, route }) {
  const { t } = useTranslation();
  const { Spaces } = useTheme();
  const { dispatch, state } = useClubWizard();
  const { userData } = useAuth();

  const entry = route?.params?.entry || 'search';
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const isCoach = roleKey === 'coach';

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
        error={emailValid ? undefined : t('clubWizard.contact.emailInvalid', 'Adresse email invalide.')}
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

      {isCoach ? (
        <View style={[Spaces.marginTop[24]]}>
          <WizardOptionCard
            multi
            onPress={() => dispatch({ payload: !state.alsoDirector, type: 'SET_ALSO_DIRECTOR' })}
            selected={state.alsoDirector === true}
            subtitle={t(
              'clubWizard.contact.alsoDirectorSubtitle',
              'Coche si tu gères aussi le club (et pas seulement une équipe).',
            )}
            title={t('clubWizard.contact.alsoDirector', 'Je suis aussi dirigeant de ce club')}
          />
        </View>
      ) : null}
    </WizardStepLayout>
  );
}

export default ClubWizardContact;
