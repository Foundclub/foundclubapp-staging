// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      Alert.alert(t(
        'adminClubWizardIdentity.uploadError',
        'Upload impossible',
      ), getErrorMessage(error, 'generic'));
    }
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.name?.trim()}
      nextLabel={t('adminClubWizardIdentity.next', 'Suivant')}
      onBack={handleExitWizard}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardContact)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={1}
      subtitle={t(
        'adminClubWizardIdentity.subtitle',
        'Donne une identité claire au club. Tu pourras enrichir le reste du dossier ensuite et garder un recap avant création.',
      )}
      title={t('adminClubWizardIdentity.title', 'Identité du club')}
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
              title={state.logo?.url
                ? t('adminClubWizardIdentity.changeLogo', 'Changer le logo')
                : t('adminClubWizardIdentity.importLogo', 'Importer un logo')}
            />
            {state.logo?.url ? (
              <Button
                onPress={() => setField('logo', null)}
                title={t('adminClubWizardIdentity.removeLogo', 'Retirer le logo')}
                variant="Secondary"
              />
            ) : null}
          </View>
        </View>

        <View style={[Spaces.gap[10]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'adminClubWizardIdentity.nameHint',
              'Le nom du club est le seul champ obligatoire du tunnel. Les autres étapes servent à construire une fiche complète, comme pour le wizard équipe.',
            )}
          </Text>
          <Input
            autoFocus
            label={t('adminClubWizardIdentity.nameLabel', 'Nom du club')}
            onChangeText={(value) => setField('name', value)}
            placeholder={t('adminClubWizardIdentity.namePlaceholder', 'Ex: FC FoundClub Paris')}
            value={state.name}
          />
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardIdentity;
