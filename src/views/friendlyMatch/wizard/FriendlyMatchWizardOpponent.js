import { useMemo } from 'react';
import { Text, TextInput, View } from 'react-native';

import { getFormatsForSport } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  FORMAT_OTHER_VALUE,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/**
 * Retrouve une entite de reference a partir de son documentId. La collection
 * peut etre `undefined` : les hooks de requete ne rendent rien tant qu ils
 * chargent, et une pastille cliquee a ce moment-la ne doit rien casser.
 * @param {any} collection
 * @param {any} documentId
 * @returns {any}
 */
const findByDocumentId = (collection, documentId) => (
  Array.isArray(collection) ? collection : []
).find((/** @type {any} */ item) => item?.documentId === documentId) || null;

/**
 * Coche ou decoche une reference dans la liste deja choisie (D90).
 *
 * La pastille « Toutes » porte la valeur vide : l appuyer VIDE la liste au lieu
 * de s y ajouter — c est ce qui donne un moyen de tout relacher en un geste,
 * y compris ce que l equipe avait pre-rempli.
 * @param {any[]} selected
 * @param {any} collection
 * @param {any} documentId
 * @returns {any[]}
 */
const toggleReference = (selected, collection, documentId) => {
  const current = Array.isArray(selected) ? selected : [];
  if (!documentId) return [];

  const kept = current.filter((/** @type {any} */ item) => item?.documentId !== documentId);
  if (kept.length !== current.length) return kept;

  const entity = findByDocumentId(collection, documentId);
  return entity ? [...current, entity] : current;
};

/**
 * Les identifiants a passer aux pastilles. Liste vide → on coche « Toutes » :
 * l ecran doit MONTRER ce que « rien de choisi » veut dire, pas le sous-entendre.
 * @param {any[]} selected
 * @returns {string[]}
 */
const getSelectedChipValues = (selected) => {
  const documentIds = (Array.isArray(selected) ? selected : [])
    .map((/** @type {any} */ item) => String(item?.documentId || '').trim())
    .filter(Boolean);
  return documentIds.length > 0 ? documentIds : [''];
};

/**
 * Etape 5/7 — « Qui je cherche » (§4.1).
 *
 * Les trois champs sont FACULTATIFS et c est voulu : une annonce ouverte
 * (« n importe quel adversaire du coin ») est parfaitement legitime, et le
 * schema serveur ne les exige pas. Ils servent surtout aux filtres de la liste.
 *
 * D90 — categories et niveaux se cochent au PLURIEL : une equipe qui cherche un
 * match accepte souvent U15 ET U17. Rien de coche veut dire « toutes », et
 * l ecran le dit deux fois plutot qu une (la pastille « Toutes » reste allumee,
 * et l aide sous les pastilles l ecrit en toutes lettres).
 *
 * Le catalogue de formats depend du SPORT de l equipe (§3.4) : c est ce qui
 * evite une liste 11v11/7v7/5v5 qui serait du football deguise.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardOpponent({ navigation }) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();

  const issue = getFriendlyMatchWizardStepIssue('opponent', state);
  const sportName = state.activity?.name || '';

  const categoryOptions = useMemo(() => [
    { label: 'Toutes', value: '' },
    ...(categories || []).map((/** @type {any} */ category) => ({
      label: category.name,
      value: category.documentId || '',
    })),
  ], [categories]);

  const levelOptions = useMemo(() => [
    { label: 'Tous', value: '' },
    ...(levels || []).map((/** @type {any} */ level) => ({
      label: level.name,
      value: level.documentId || '',
    })),
  ], [levels]);

  const formatOptions = useMemo(() => [
    { label: 'Peu importe', value: '' },
    ...getFormatsForSport(sportName).map((format) => ({ label: format, value: format })),
  ], [sportName]);

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardDescription)}
      onSkip={() => navigation.navigate(RouteNames.FriendlyMatchWizardDescription)}
      showSkip
      skipLabel="Peu importe, je prends tout"
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('opponent')}
      subtitle="Tout est facultatif : laisse vide et tu verras plus de monde."
      title="Quel adversaire ?"
    >
      <View style={[Spaces.gap[24]]}>
        <ChoiceChipGroup
          hint="Coche autant de catégories que tu veux. Rien de coché : toutes."
          onSelect={(value) => dispatch({
            payload: toggleReference(state.categories, categories, value),
            type: 'SET_CATEGORIES',
          })}
          options={categoryOptions}
          selectedValues={getSelectedChipValues(state.categories)}
          title="Catégories"
        />

        <ChoiceChipGroup
          hint="Coche autant de niveaux que tu veux. Rien de coché : tous."
          onSelect={(value) => dispatch({
            payload: toggleReference(state.levels, levels, value),
            type: 'SET_LEVELS',
          })}
          options={levelOptions}
          selectedValues={getSelectedChipValues(state.levels)}
          title="Niveaux"
        />

        <ChoiceChipGroup
          hint={sportName
            ? `Les formats proposés sont ceux du ${sportName.toLowerCase()}.`
            : 'Choisis « Autre » si ton format n’est pas dans la liste.'}
          onSelect={(value) => dispatch({ payload: value, type: 'SET_FORMAT' })}
          options={formatOptions}
          selectedValue={state.format || ''}
          title="Format"
        />

        {state.format === FORMAT_OTHER_VALUE ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
              Ton format
            </Text>
            <TextInput
              accessibilityLabel="Format de jeu"
              maxLength={40}
              onChangeText={(value) => dispatch({ payload: value, type: 'SET_FORMAT_OTHER' })}
              placeholder="Ex : beach 3v3, 9v9..."
              placeholderTextColor={Colors.neutral400}
              style={[Fonts.p1, {
                backgroundColor: withAlpha(Colors.primary900, 0.94),
                borderColor: withAlpha(Colors.primary500, 0.15),
                borderRadius: 12,
                borderWidth: 1,
                color: Colors.neutral00,
                minHeight: 48,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }]}
              value={state.formatOther || ''}
            />
          </View>
        ) : null}

        {issue ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{issue}</Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardOpponent;
