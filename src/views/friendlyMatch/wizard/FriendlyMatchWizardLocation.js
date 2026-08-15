import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
// eslint-disable-next-line max-len -- chemin du composant d'adresse du depot
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { RouteNames } from '@/navigation/routeNames';

import { useGetFacilities } from '@/services/facility/facilityQueries';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  buildFriendlyMatchFacilitySelection,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';

/** Les rayons proposes, en km. Memes paliers que le filtre de la liste (§4.2). */
const RADIUS_OPTIONS = [
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
];

/**
 * Etape 4/7 — « Ou » (§4.1).
 *
 * La localisation est OBLIGATOIRE : sans elle, l annonce n a ni ville ni
 * geohash (derives par le serveur, lifecycles.ts:62-91), donc elle sort de tous
 * les tris par distance et devient invisible en pratique.
 *
 * C-G (2026-08-13) — le club a deja ses installations enregistrees : on les
 * PROPOSE, on ne les impose pas. La saisie libre reste la, et elle reste seule
 * quand il n y en a aucune — un organisateur peut jouer ailleurs que chez lui,
 * et une liste vide serait une promesse non tenue.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardLocation({ navigation }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();

  const issue = getFriendlyMatchWizardStepIssue('location', state);
  const isHosting = state.hostingPreference === 'HOST';

  // Le lecteur d installations du depot, pas un second : meme service et meme
  // clef de cache que FacilitySelector, donc une seule requete pour les deux.
  const { data: facilitiesResponse } = useGetFacilities(state.team?.club?.documentId || null);
  // Seules les installations qu on sait transformer en lieu sont proposees :
  // les autres fabriqueraient une annonce sans geohash, invisible en pratique.
  const facilitySelections = useMemo(
    () => (facilitiesResponse?.data || [])
      .map(buildFriendlyMatchFacilitySelection)
      .filter(Boolean),
    [facilitiesResponse],
  );

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(issue)}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.FriendlyMatchWizardOpponent)}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('location')}
      subtitle={isHosting
        ? 'Là où tu reçois, et jusqu’où les autres peuvent venir.'
        : 'Ton point de départ, et jusqu’où tu acceptes de te déplacer.'}
      title="Où ça se passe ?"
    >
      <View style={[Spaces.gap[24]]}>
        {facilitySelections.length > 0 ? (
          <ChoiceChipGroup
            hint={t('friendlyMatch.wizard.location.facilities.hint')}
            onSelect={(value) => {
              const choisie = facilitySelections.find(
                (/** @type {any} */ selection) => selection.installation.documentId === value,
              );
              if (choisie) dispatch({ payload: choisie, type: 'SET_LOCATION_SELECTION' });
            }}
            options={facilitySelections.map((/** @type {any} */ selection) => ({
              label: selection.installation.name,
              value: selection.installation.documentId,
            }))}
            selectedValue={state.installation?.documentId}
            title={t('friendlyMatch.wizard.location.facilities.title')}
          />
        ) : null}

        <AutocompleteAddressInput
          address={typeof state.location === 'object' && state.location
            ? state.location
            : undefined}
          label="Ville ou adresse"
          placeholder="Ex : Marseille, Stade Vélodrome..."
          setAddress={(/** @type {any} */ nextLocation) => dispatch({
            payload: { location: nextLocation },
            type: 'SET_LOCATION_SELECTION',
          })}
        />

        <ChoiceChipGroup
          hint="C’est le rayon dans lequel ton annonce sera proposée aux autres équipes."
          onSelect={(value) => dispatch({ payload: value, type: 'SET_TRAVEL_RADIUS' })}
          options={RADIUS_OPTIONS}
          selectedValue={state.travelRadiusKm}
          title="Jusqu’où"
        />

        <View style={[Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.primary500, 0.08),
          borderColor: withAlpha(Colors.primary500, 0.22),
          borderRadius: 12,
          borderWidth: 1,
        }]}
        >
          <Text style={[Fonts.p4, { color: Colors.neutral100 }]}>
            {facilitySelections.length > 0
              ? t('friendlyMatch.wizard.location.facilities.info')
              : 'Le terrain exact n’est pas demandé ici : il se convient dans la'
                + ' discussion qui s’ouvre quand une équipe te répond.'}
          </Text>
        </View>

        {issue ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{issue}</Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardLocation;
