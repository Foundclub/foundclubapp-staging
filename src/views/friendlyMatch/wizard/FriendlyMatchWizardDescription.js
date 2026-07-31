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
      subtitle="Deux lignes suffisent. C’est ce que les autres staffs liront en premier."
      title="Un mot pour convaincre"
    >
      <View style={[Spaces.gap[24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            Description (facultatif)
          </Text>
          {renderInput({
            accessibilityLabel: 'Description de l’annonce',
            maxLength: DESCRIPTION_MAX_LENGTH,
            multiline: true,
            onChangeText: (value) => dispatch({ payload: value, type: 'SET_DESCRIPTION' }),
            placeholder: 'Ex : équipe U15 sérieuse, on cherche un match de'
              + ' préparation avant la reprise.',
            value: state.description || '',
          })}
          <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
            {`${(state.description || '').length}/${DESCRIPTION_MAX_LENGTH}`}
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            Arbitrage (facultatif)
          </Text>
          {renderInput({
            accessibilityLabel: 'Arbitrage',
            maxLength: REFEREEING_MAX_LENGTH,
            multiline: false,
            onChangeText: (value) => dispatch({ payload: value, type: 'SET_REFEREEING' }),
            placeholder: 'Ex : arbitre fourni par le club',
            value: state.refereeing || '',
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardDescription;
