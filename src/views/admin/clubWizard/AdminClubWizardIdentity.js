// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useMutation } from '@tanstack/react-query';
import {
  Alert, Image, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  getClubInitials,
} from '@/services/admin/adminClubContentModel';
import { pickAndUploadAdminClubLogo } from '@/services/admin/adminClubContentService';

import { getErrorMessage } from '@/utils/errors/displayError';

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
function AdminClubWizardIdentity({ navigation }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const uploadLogoMutation = useMutation({
    mutationFn: pickAndUploadAdminClubLogo,
  });

  const handleUploadLogo = async () => {
    try {
      const uploaded = await uploadLogoMutation.mutateAsync();
      if (uploaded) {
        setField('logo', uploaded);
      }
    } catch (error) {
      Alert.alert('Upload impossible', getErrorMessage(error, 'generic'));
    }
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.name?.trim()}
      nextLabel="Suivant"
      onBack={handleExitWizard}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardContact)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={1}
      subtitle="Donne une identite claire au club. Tu pourras enrichir le reste du dossier ensuite et garder un recap avant creation."
      title="Identite du club"
    >
      <View style={[Spaces.gap[20]]}>
        <View
          style={[
            Alignments.alignCenter,
            Spaces.gap[14],
            {
              alignSelf: 'center',
            },
          ]}
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary700,
                borderColor: `${Colors.primary500}55`,
                borderRadius: 26,
                borderWidth: 1,
                height: 118,
                overflow: 'hidden',
                width: 118,
              },
            ]}
          >
            {state.logo?.url ? (
              <Image
                resizeMode="cover"
                source={{ uri: state.logo.url }}
                style={{ height: 118, width: 118 }}
              />
            ) : (
              <Text style={[Fonts.h2Bold, { color: Colors.primary200 }]}>
                {getClubInitials({ name: state.name })}
              </Text>
            )}
          </View>

          <View style={[Spaces.gap[10], { width: '100%' }]}>
            <Button
              isLoading={uploadLogoMutation.isPending}
              onPress={handleUploadLogo}
              title={state.logo?.url ? 'Changer le logo' : 'Importer un logo'}
            />
            {state.logo?.url ? (
              <Button
                onPress={() => setField('logo', null)}
                title="Retirer le logo"
                variant="Secondary"
              />
            ) : null}
          </View>
        </View>

        <View style={[Spaces.gap[10]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Le nom du club est le seul champ obligatoire du tunnel. Les autres etapes servent a construire une fiche complete, comme pour le wizard equipe.
          </Text>
          <Input
            autoFocus
            label="Nom du club"
            onChangeText={(value) => setField('name', value)}
            placeholder="Ex: FC FoundClub Paris"
            value={state.name}
          />
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardIdentity;
