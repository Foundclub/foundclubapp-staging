import { useMemo } from 'react';
import {
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardNeedsStepIndex,
  getAdWizardStepCount,
  isAdWizardCoachProfileComplete,
} from './adWizardStepUtils';

const COACH_ROLE_OPTIONS = [
  { label: 'Entraineur principal', value: 'entraineur_principal' },
  { label: 'Entraineur adjoint', value: 'entraineur_adjoint' },
  { label: 'Preparateur physique', value: 'preparateur_physique' },
  { label: 'Entraineur gardiens', value: 'entraineur_gardiens' },
  { label: 'Analyste video', value: 'analyste_video' },
  { label: 'Team manager', value: 'team_manager' },
  { label: 'Autre role', value: 'other' },
];

const EXPERIENCE_OPTIONS = [
  { label: 'Junior', value: 'junior' },
  { label: 'Confirme', value: 'confirme' },
  { label: 'Experimente', value: 'experimente' },
  { label: 'Diplome', value: 'diplome' },
];

const ENGAGEMENT_OPTIONS = [
  { label: 'Benevole', value: 'benevole' },
  { label: 'Indemnise', value: 'indemnise' },
  { label: 'Salarie', value: 'salarie' },
  { label: 'A definir', value: 'a_definir' },
];

/**
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardCoachProfile({ navigation }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();

  const selectedRoleLabel = useMemo(
    () => COACH_ROLE_OPTIONS.find((option) => option.value === state.coachRole)?.label || '',
    [state.coachRole],
  );
  const selectedExperienceLabel = useMemo(
    () => EXPERIENCE_OPTIONS.find((option) => option.value === state.coachExperienceLevel)?.label || '',
    [state.coachExperienceLevel],
  );
  const selectedEngagementLabel = useMemo(
    () => ENGAGEMENT_OPTIONS.find((option) => option.value === state.engagementType)?.label || '',
    [state.engagementType],
  );

  const handleNext = () => {
    if (!isAdWizardCoachProfileComplete(state)) return;
    navigation.navigate(RouteNames.AdWizardInfo);
  };

  const isValid = isAdWizardCoachProfileComplete(state);

  return (
    <WizardStepLayout
      isNextDisabled={!isValid}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardNeedsStepIndex(state)}
      subtitle="Definissez le role encadrement recherche et le cadre de la mission."
      title="Profil entraineur recherche"
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[32]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: 'rgba(1, 179, 244, 0.24)',
        }]}
        >
          <AutocompleteSelect
            displayVariant="card"
            label="Role principal *"
            options={COACH_ROLE_OPTIONS}
            placeholder="Selectionner un role"
            setValue={(option) => {
              if (option && !Array.isArray(option)) {
                dispatch({ payload: option.value, type: 'SET_COACH_ROLE' });
              }
            }}
            value={selectedRoleLabel}
          />

          {state.coachRole === 'other' ? (
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Precisez le role</Text>
              <TextInput
                onChangeText={(text) => dispatch({ payload: text.slice(0, 80), type: 'SET_COACH_ROLE_OTHER' })}
                placeholder="Ex. Responsable gardiens, coordinateur sportif..."
                placeholderTextColor={Colors.neutral500}
                style={[
                  Fonts.p1,
                  Spaces.paddingHorizontal[16],
                  Spaces.paddingVertical[16],
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                    borderRadius: 18,
                    borderWidth: 1,
                    color: Colors.neutral00,
                  },
                ]}
                value={state.coachRoleOther}
              />
            </View>
          ) : null}

          <AutocompleteSelect
            displayVariant="card"
            label="Experience attendue *"
            options={EXPERIENCE_OPTIONS}
            placeholder="Selectionner un niveau d'experience"
            setValue={(option) => {
              if (option && !Array.isArray(option)) {
                dispatch({ payload: option.value, type: 'SET_COACH_EXPERIENCE_LEVEL' });
              }
            }}
            value={selectedExperienceLabel}
          />

          <AutocompleteSelect
            displayVariant="card"
            label="Type d'engagement *"
            options={ENGAGEMENT_OPTIONS}
            placeholder="Selectionner un cadre"
            setValue={(option) => {
              if (option && !Array.isArray(option)) {
                dispatch({ payload: option.value, type: 'SET_ENGAGEMENT_TYPE' });
              }
            }}
            value={selectedEngagementLabel}
          />
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: 'rgba(1, 179, 244, 0.24)',
        }]}
        >
          <InputStepper
            label="Nombre de profils recherches"
            max={10}
            min={1}
            onDecrement={() => dispatch({ payload: Math.max(1, state.coachQuantity - 1), type: 'SET_COACH_QUANTITY' })}
            onIncrement={() => dispatch({ payload: Math.min(10, state.coachQuantity + 1), type: 'SET_COACH_QUANTITY' })}
            value={state.coachQuantity}
          />

          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Certifications souhaitees</Text>
            <TextInput
              onChangeText={(text) => dispatch({
                payload: text.split(',').map((item) => item.trim()).filter(Boolean),
                type: 'SET_CERTIFICATIONS_WANTED',
              })}
              placeholder="Ex. BMF, BPJEPS, experience formation jeunes"
              placeholderTextColor={Colors.neutral500}
              style={[
                Fonts.p1,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[16],
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(1, 179, 244, 0.18)',
                  borderRadius: 18,
                  borderWidth: 1,
                  color: Colors.neutral00,
                },
              ]}
              value={Array.isArray(state.certificationsWanted) ? state.certificationsWanted.join(', ') : ''}
            />
            <Text style={[Fonts.p4, Fonts.neutral300]}>Separer chaque certification par une virgule.</Text>
          </View>

          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>Disponibilites attendues</Text>
            <TextInput
              onChangeText={(text) => dispatch({ payload: text.slice(0, 140), type: 'SET_AVAILABILITY_TEXT' })}
              placeholder="Ex. Mardi et jeudi soir, match le week-end"
              placeholderTextColor={Colors.neutral500}
              style={[
                Fonts.p1,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[16],
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(1, 179, 244, 0.18)',
                  borderRadius: 18,
                  borderWidth: 1,
                  color: Colors.neutral00,
                },
              ]}
              value={state.availabilityText}
            />
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardCoachProfile;
