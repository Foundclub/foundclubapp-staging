// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      nextLabel={t('adminClubWizardSponsors.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardRecap)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={7}
      subtitle={t(
        'adminClubWizardSponsors.subtitle',
        'Ajoute des sponsors si tu veux préparer la fiche club tout de suite. Cette étape reste optionnelle.',
      )}
      title="Sponsors"
    >
      <View style={[Spaces.gap[18]]}>
        <Button
          onPress={addSponsor}
          title={t('adminClubWizardSponsors.add', 'Ajouter un sponsor')}
          variant="Secondary"
        />

        {hasInvalidSponsors ? (
          <Text style={[Fonts.p2, { color: Colors.error500 }]}>
            {t(
              'adminClubWizardSponsors.invalid',
              'Chaque sponsor ajoute doit avoir au minimum un titre.',
            )}
          </Text>
        ) : null}

        {(Array.isArray(state.sponsor) ? state.sponsor : []).length === 0 ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('adminClubWizardSponsors.empty', 'Aucun sponsor ajoute pour le moment.')}
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
              label={t('adminClubWizardSponsors.titleLabel', 'Titre')}
              onChangeText={(value) => updateSponsor(index, 'title', value)}
              placeholder={t('adminClubWizardSponsors.titlePlaceholder', 'Nom du sponsor')}
              value={sponsor.title || ''}
            />
            <Input
              autoCapitalize="none"
              label={t('adminClubWizardSponsors.linkLabel', 'Lien')}
              onChangeText={(value) => updateSponsor(index, 'link', value)}
              placeholder="https://..."
              value={sponsor.link || ''}
            />
            <Button
              onPress={() => removeSponsor(index)}
              size="sm"
              title={t('adminClubWizardSponsors.remove', 'Supprimer ce sponsor')}
              variant="SecondaryLight"
            />
          </View>
        ))}
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardSponsors;
