// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import { hasInvalidSponsorRows } from './helpers';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardSponsors({ navigation }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    addSponsor,
    removeSponsor,
    state,
    updateSponsor,
  } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const hasInvalidSponsors = hasInvalidSponsorRows(state.sponsor);

  return (
    <WizardStepLayout
      isNextDisabled={hasInvalidSponsors}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardRecap)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={7}
      subtitle="Ajoute des sponsors si tu veux préparer la fiche club tout de suite. Cette étape reste optionnelle."
      title="Sponsors"
    >
      <View style={[Spaces.gap[18]]}>
        <Button
          onPress={addSponsor}
          title="Ajouter un sponsor"
          variant="Secondary"
        />

        {hasInvalidSponsors ? (
          <Text style={[Fonts.p2, { color: Colors.error500 }]}>
            Chaque sponsor ajoute doit avoir au minimum un titre.
          </Text>
        ) : null}

        {(Array.isArray(state.sponsor) ? state.sponsor : []).length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Aucun sponsor ajoute pour le moment.
          </Text>
        ) : null}

        {(Array.isArray(state.sponsor) ? state.sponsor : []).map((sponsor, index) => (
          <View
            key={sponsor.draftKey || `${sponsor.title || 'sponsor'}-${sponsor.link || 'row'}`}
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[12],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: 'rgba(1, 179, 244, 0.18)',
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{`Sponsor ${index + 1}`}</Text>
            <Input
              label="Titre"
              onChangeText={(value) => updateSponsor(index, 'title', value)}
              placeholder="Nom du sponsor"
              value={sponsor.title || ''}
            />
            <Input
              autoCapitalize="none"
              label="Lien"
              onChangeText={(value) => updateSponsor(index, 'link', value)}
              placeholder="https://..."
              value={sponsor.link || ''}
            />
            <Button
              onPress={() => removeSponsor(index)}
              size="sm"
              title="Supprimer ce sponsor"
              variant="SecondaryLight"
            />
          </View>
        ))}
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardSponsors;
