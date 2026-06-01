// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import { buildAddressSelectionPatch } from './helpers';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardAddress({ navigation }) {
  const {
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);

  const handleSelectAddress = useCallback((addressOption) => {
    setField('addressOption', addressOption || null);
    const patch = buildAddressSelectionPatch(addressOption);
    Object.entries(patch).forEach(([field, value]) => {
      setField(field, value);
    });
  }, [setField]);

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardActivities)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={3}
      subtitle="Positionne le club comme dans les autres tunnels FoundClub. Une recherche d'adresse remplit automatiquement la ville, le code postal et les coordonnees."
      title="Adresse du club"
    >
      <View style={[Spaces.gap[18]]}>
        <AutocompleteAddressInput
          address={state.addressOption || undefined}
          label="Adresse principale"
          placeholder="Rechercher une adresse"
          setAddress={handleSelectAddress}
        />

        <Input
          label="Precision / complement"
          onChangeText={(value) => setField('addressDetails', value)}
          placeholder="Ex: entree stade, batiment, gymnase..."
          value={state.addressDetails}
        />

        {state.addressLabel ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[8],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: 'rgba(1, 179, 244, 0.24)',
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>Adresse selectionnee</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>{state.addressLabel}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {[state.city, state.postcode].filter(Boolean).join(' - ') || 'Ville non remontee'}
            </Text>
            {(state.latitude && state.longitude) ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {`Lat ${state.latitude} / Lng ${state.longitude}`}
              </Text>
            ) : null}
            <Button
              onPress={() => handleSelectAddress(undefined)}
              size="sm"
              title="Retirer cette adresse"
              variant="Secondary"
            />
          </View>
        ) : (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Cette etape reste facultative, mais une adresse nette aide beaucoup pour les recherches, la cartographie et les futures equipes du club.
          </Text>
        )}
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardAddress;
