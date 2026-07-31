import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

// eslint-disable-next-line max-len -- chemin du selecteur de creneaux, partage avec le repostage
import FriendlyMatchSlotEditor from '@/components/molecules/friendlyMatchSlotEditor/FriendlyMatchSlotEditor';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Etape 3/7 — « Quand » (§4.1).
 *
 * Plusieurs dates sont la regle, pas l exception : c est ce qui evite l aller-
 * retour « et le 12, ca t irait ? ». Le creneau horaire reste facultatif —
 * beaucoup d annonces se contentent de « samedi », l heure se convient dans le
 * fil (§4.4).
 *
 * La saisie elle-meme vit dans FriendlyMatchSlotEditor : le repostage d une
 * annonce expiree (§4.7) demande exactement le meme bloc.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardDates({ navigation }) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const issue = getFriendlyMatchWizardStepIssue('dates', state);

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardLocation)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('dates')}
      subtitle="Propose plusieurs dates : tu auras beaucoup plus de réponses."
      title="Quand veux-tu jouer ?"
    >
      <View style={[Spaces.gap[16]]}>
        <FriendlyMatchSlotEditor
          onAdd={(slot) => dispatch({ payload: slot, type: 'ADD_CANDIDATE_DATE' })}
          onRemove={(isoDay) => dispatch({ payload: isoDay, type: 'REMOVE_CANDIDATE_DATE' })}
          slots={Array.isArray(state.candidateDates) ? state.candidateDates : []}
        />

        {issue ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{issue}</Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardDates;
