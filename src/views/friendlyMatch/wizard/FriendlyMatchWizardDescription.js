import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
} from './friendlyMatchWizardSteps';

const DESCRIPTION_MAX_LENGTH = 600;
const REFEREEING_MAX_LENGTH = 120;

/**
 * Etape 6/7 — « Un mot » (§4.1).
 *
 * Entierement facultative : elle porte le bouton « Passer cette etape » du
 * gabarit. Une annonce sans description reste une annonce valable.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const goToRecap = () => navigation.navigate(RouteNames.FriendlyMatchWizardRecap);

  /**
   * Le meme champ de saisie pour les deux zones de texte.
   * @param {{
   *  accessibilityLabel: string, maxLength: number, multiline: boolean,
   *  onChangeText: (value: string) => void, placeholder: string, value: string
   * }} props
   * @returns {import('react').ReactElement}
   */
  const renderInput = (props) => (
    <TextInput
      accessibilityLabel={props.accessibilityLabel}
      maxLength={props.maxLength}
      multiline={props.multiline}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={Colors.neutral400}
      style={[Fonts.p1, {
        backgroundColor: withAlpha(Colors.primary900, 0.94),
        borderColor: withAlpha(Colors.primary500, 0.15),
        borderRadius: 12,
        borderWidth: 1,
        color: Colors.neutral00,
        minHeight: props.multiline ? 128 : 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        textAlignVertical: props.multiline ? 'top' : 'center',
      }]}
      value={props.value}
    />
  );

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={goToRecap}
      onSkip={goToRecap}
      showSkip
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('description')}
      subtitle={t(
        'friendlyMatchWizardDescription.twoLinesAreEnoughIt',
        'Deux lignes suffisent. C’est ce que les autres staffs liront en premier.',
      )}
      title={t('friendlyMatchWizardDescription.aWordToConvince', 'Un mot pour convaincre')}
    >
      <View style={[Spaces.gap[24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {t('friendlyMatchWizardDescription.descriptionOptional', 'Description (facultatif)')}
          </Text>
          {renderInput({
            accessibilityLabel: t(
              'friendlyMatchWizardDescription.listingDescription',
              'Description de l’annonce',
            ),
            maxLength: DESCRIPTION_MAX_LENGTH,
            multiline: true,
            onChangeText: (value) => dispatch({ payload: value, type: 'SET_DESCRIPTION' }),
            placeholder: t(
              'friendlyMatchWizardDescription.eGCommittedU15Team',
              'Ex : équipe U15 sérieuse, on cherche un match de',
            )
              + t(
                'friendlyMatchWizardDescription.warmUpMatchBeforeThe',
                ' préparation avant la reprise.',
              ),
            value: state.description || '',
          })}
          <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
            {`${(state.description || '').length}/${DESCRIPTION_MAX_LENGTH}`}
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {t('friendlyMatchWizardDescription.refereeingOptional', 'Arbitrage (facultatif)')}
          </Text>
          {renderInput({
            accessibilityLabel: t('friendlyMatchWizardDescription.refereeing', 'Arbitrage'),
            maxLength: REFEREEING_MAX_LENGTH,
            multiline: false,
            onChangeText: (value) => dispatch({ payload: value, type: 'SET_REFEREEING' }),
            placeholder: t(
              'friendlyMatchWizardDescription.eGRefereeProvidedBy',
              'Ex : arbitre fourni par le club',
            ),
            value: state.refereeing || '',
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardDescription;
