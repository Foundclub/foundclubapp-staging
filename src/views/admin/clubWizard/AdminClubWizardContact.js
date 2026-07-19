// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import { isValidOptionalEmail } from './helpers';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardContact({ navigation }) {
  const { Fonts, Spaces } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const hasInvalidEmail = !isValidOptionalEmail(state.email);

  return (
    <WizardStepLayout
      isNextDisabled={hasInvalidEmail}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardAddress)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={2}
      subtitle="Ajoute un email et un numéro de téléphone pour que la fiche club soit exploitable des la création. Ces champs restent optionnels."
      title="Contact principal"
    >
      <View style={[Spaces.gap[18]]}>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          error={hasInvalidEmail ? 'Renseigne un email valide ou laisse le champ vide.' : undefined}
          inputMode="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => setField('email', value)}
          placeholder="contact@club.fr"
          value={state.email}
        />
        <Input
          inputMode="tel"
          keyboardType="phone-pad"
          label="Telephone"
          onChangeText={(value) => setField('phoneNumber', value)}
          placeholder="06 00 00 00 00"
          value={state.phoneNumber}
        />
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          Tu pourras toujours revenir dans la fiche club pour compléter ou corriger ces informations.
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardContact;
