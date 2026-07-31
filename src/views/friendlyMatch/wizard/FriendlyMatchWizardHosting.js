import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Les trois reponses possibles, dites du point de vue de celui qui publie.
 * L ordre suit celui de la spec (§3.1) : recevoir, se deplacer, les deux.
 */
const HOSTING_OPTIONS = [
  { label: 'Je reçois', value: 'HOST' },
  { label: 'Je me déplace', value: 'AWAY' },
  { label: 'Les deux', value: 'BOTH' },
];

/** Ce que chaque choix implique concretement, en une phrase. */
const HOSTING_EXPLANATIONS = {
  AWAY: 'Le match se jouera chez l’équipe qui te répond. Tu n’as pas de terrain à proposer.',
  BOTH: 'Tu laisses le choix : c’est l’équipe qui te répond qui décidera, et tu valides.',
  HOST: 'Le match se jouera chez toi. Tu pourras proposer ton terrain à l’étape suivante.',
};

/**
 * Etape 2/7 — « Je peux… » (§4.1, arbitrage Adel Q1).
 *
 * C est LA regle metier neuve du dossier : ce choix contraint ensuite ce que le
 * candidat pourra cocher (§3.3). Il n est jamais pre-rempli — pas de valeur par
 * defaut, meme « Les deux » : un choix implicite serait subi, pas fait.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardHosting({ navigation }) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const issue = getFriendlyMatchWizardStepIssue('hosting', state);
  const explanation = HOSTING_EXPLANATIONS[
    /** @type {keyof typeof HOSTING_EXPLANATIONS} */ (state.hostingPreference)
  ];

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardDates)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('hosting')}
      subtitle="C’est ce qui décide où le match se jouera."
      title="Tu peux recevoir ?"
    >
      <View style={[Spaces.gap[16]]}>
        <ChoiceChipGroup
          onSelect={(value) => dispatch({ payload: value, type: 'SET_HOSTING_PREFERENCE' })}
          options={HOSTING_OPTIONS}
          selectedValue={state.hostingPreference}
          title="Je peux"
        />

        {explanation ? (
          <View style={[Spaces.padding[16], {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: withAlpha(Colors.primary500, 0.22),
            borderRadius: 12,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>{explanation}</Text>
          </View>
        ) : null}

        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          Les équipes qui cherchent l’inverse de toi verront ton annonce ; les
          autres ne la verront pas. Personne ne tombe donc sur un message
          d’erreur : les annonces incompatibles sont simplement masquées.
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardHosting;
