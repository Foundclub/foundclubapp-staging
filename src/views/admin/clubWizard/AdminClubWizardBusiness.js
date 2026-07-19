// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardBusiness({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);

  const renderToggle = (label, field, description) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setField(field, !state[field])}
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[10],
        {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: state[field] ? Colors.primary500 : 'rgba(1, 179, 244, 0.18)',
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{description}</Text>
        </View>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: state[field] ? Colors.primary500 : Colors.primary900,
              borderRadius: 14,
              height: 30,
              width: 56,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{state[field] ? 'Oui' : 'Non'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardMultisport)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={5}
      subtitle="On fixe ici le partenariat, la vérification et la réservation. Les abonnements et la capacité Team se pilotent ensuite depuis les opérations abonnements."
      title="Statut et gouvernance"
    >
      <View style={[Spaces.gap[18]]}>
        {renderToggle(
          'Club partenaire',
          'clubPartner',
          'Signal commercial et interne uniquement. Ce statut n ouvre aucun droit produit a lui seul.',
        )}
        {renderToggle(
          'Club vérifie',
          'clubVerified',
          'Badge public et legitimite dirigeant. A activer seulement après review claim, migration approuvee ou action superadmin auditée.',
        )}
        {renderToggle(
          'Fournisseur de réservation',
          'isReservationProvider',
          'Active si le club peut proposer des installations et des réservations.',
        )}
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardBusiness;
