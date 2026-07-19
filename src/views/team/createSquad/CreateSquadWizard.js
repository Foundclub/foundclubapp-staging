/* global globalThis */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';

import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import SquadAvailabilitiesStep from '@/views/team/createSquad/steps/SquadAvailabilitiesStep';
import SquadCategoryStep from '@/views/team/createSquad/steps/SquadCategoryStep';
import SquadImageStep from '@/views/team/createSquad/steps/SquadImageStep';
import SquadLevelStep from '@/views/team/createSquad/steps/SquadLevelStep';
import SquadLocationStep from '@/views/team/createSquad/steps/SquadLocationStep';
import SquadNameStep from '@/views/team/createSquad/steps/SquadNameStep';
import SquadSectionStep from '@/views/team/createSquad/steps/SquadSectionStep';
import SquadSourceTeamStep from '@/views/team/createSquad/steps/SquadSourceTeamStep';
import SquadSportStep from '@/views/team/createSquad/steps/SquadSportStep';
import SquadSummaryStep from '@/views/team/createSquad/steps/SquadSummaryStep';

import { RouteNames } from '@/navigation/routeNames';

import { createLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { createTeamSlot } from '@/services/teamSlot/teamSlotService';

import { isFootballElevenSport } from '@/utils/leagueSportConfig';
import { buildHomeBasePayload, normalizeLocationInput } from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';

const CREATE_SQUAD_STORAGE_KEY = 'fc:web:create-squad-wizard';

const canUseWizardStorage = () => (
  typeof globalThis !== 'undefined'
  && typeof globalThis.sessionStorage !== 'undefined'
);

/**
 * @typedef {object} AddressProperties
 * @property {string} [city]
 * @property {string} [label]
 */

/**
 * @typedef {object} AddressObject
 * @property {AddressProperties} [properties]
 */

/**
 * @typedef {object} SelectOption
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {object} TimeSlot
 * @property {string} day
 * @property {Date} startTime
 * @property {Date} endTime
 */

/**
 * @typedef {object} SquadData
 * @property {string} name
 * @property {SelectOption|null} sport
 * @property {SelectOption|null} level
 * @property {AddressObject|null} address
 * @property {string} city
 * @property {TimeSlot[]} slots
 * @property {number} [radius]
 * @property {SelectOption|null} category
 * @property {SelectOption|null} section
 * @property {any} [logo]
 * @property {any} [cover]
 * @property {SelectOption|null} [sourceTeam]
 * @property {any} [sourceTeamDetails]
 */

/**
 * Squad creation wizard component
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
const createInitialSquadData = () => /** @type {SquadData} */ ({
  address: null,
  category: { label: 'Senior', value: 'Senior' },
  city: '',
  cover: null,
  level: null,
  logo: null,
  name: '',
  radius: 50,
  section: null,
  slots: [],
  sourceTeam: null,
  sourceTeamDetails: null,
  sport: null,
});

const withSeniorCategory = (data) => ({
  ...data,
  category: { label: 'Senior', value: 'Senior' },
});

const loadPersistedWizardState = () => {
  const initialState = {
    squadData: createInitialSquadData(),
    step: 1,
  };

  if (!canUseWizardStorage()) {
    return initialState;
  }

  try {
    const raw = globalThis.sessionStorage.getItem(CREATE_SQUAD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') return initialState;

    return {
      squadData: withSeniorCategory({
        ...initialState.squadData,
        ...(parsed.squadData && typeof parsed.squadData === 'object' ? parsed.squadData : {}),
      }),
      step: Number.isInteger(parsed.step) && parsed.step > 0 ? parsed.step : 1,
    };
  } catch (_error) {
    return initialState;
  }
};

const clearPersistedWizardState = () => {
  if (!canUseWizardStorage()) return;

  try {
    globalThis.sessionStorage.removeItem(CREATE_SQUAD_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage failures and keep the in-memory flow working.
  }
};

function CreateSquadWizard({ navigation }) {
  // @ts-ignore - useAuth returns extended user object
  const { userData: user } = useAuth();
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const persistedState = loadPersistedWizardState();

  const [step, setStep] = useState(persistedState.step);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  /** @type {[SquadData, React.Dispatch<React.SetStateAction<SquadData>>]} */
  const [squadData, setSquadData] = useState(persistedState.squadData);
  const isFootball11 = isFootballElevenSport(squadData?.sport);
  const stepKeys = isFootball11
    ? ['sport', 'sourceTeam', 'name', 'level', 'category', 'section', 'location', 'image', 'availabilities', 'summary']
    : ['sport', 'name', 'level', 'category', 'section', 'location', 'image', 'availabilities', 'summary'];
  const maxStep = stepKeys.length;

  useEffect(() => {
    if (!canUseWizardStorage()) return;

    try {
      globalThis.sessionStorage.setItem(
        CREATE_SQUAD_STORAGE_KEY,
        JSON.stringify({
          squadData,
          step,
        }),
      );
    } catch (_error) {
      // Ignore storage failures and keep the in-memory flow working.
    }
  }, [squadData, step]);

  useEffect(() => {
    if (step > maxStep) {
      setStep(maxStep);
    }
  }, [maxStep, step]);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, maxStep));
  const prevStep = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  /**
   * @param {keyof SquadData} key
   * @param {any} value
   */
  const updateSquadData = (key, value) => {
    setSquadData((prev) => {
      if (key === 'sport') {
        const nextIsFootball11 = isFootballElevenSport(value);
        return {
          ...prev,
          [key]: value,
          ...(nextIsFootball11
            ? {}
            : {
              slots: Array.isArray(prev?.slots)
                ? prev.slots.map((slot) => {
                  const { locationMode, ...rest } = slot;
                  return rest;
                })
                : [],
              sourceTeam: null,
              sourceTeamDetails: null,
            }),
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = async () => {
    setSubmitError('');
    try {
      if (!user?.documentId) {
        throw new Error('Session introuvable. Recharge la page avant de créer une squad.');
      }
      console.log('DEBUG: User object:', user);
      console.log('DEBUG: User DocumentId:', user?.documentId);

      // 1. Prepare League Team Payload
      // Ensure Enums match Schema exactly
      const sportEnumMap = {
        Football: 'Football à 5',
        'Football à 5': 'Football à 5',
        Padel: 'Padel',
        // Default fallback if label differs slightly, though Autocomplete usage suggests direct mapping
        Five: 'Football à 5',
        Foot: 'Football à 5',
        Futsal: 'Football à 5',
        'Urban Soccer': 'Football à 5',
      };
      const genderEnumMap = {
        female: 'Female',
        male: 'Male',
        mixed: 'Mixed',
      };
      const selectedSourceTeamId = squadData?.sourceTeam?.value || null;

      if (isFootball11 && !selectedSourceTeamId) {
        throw new Error("Sélectionne l'équipe source pour créer une squad Football a 11.");
      }

      // Level to ELO/Division Mapping
      const levelValue = squadData.level?.value || 'beginner';
      let elo = 900;
      let division = 5;

      switch (levelValue) {
        case 'advanced': elo = 1100; division = 5; break;
        case 'beginner': elo = 900; division = 5; break;
        case 'expert': elo = 1200; division = 5; break;
        case 'intermediate': elo = 1000; division = 5; break;
        default: elo = 900; division = 5;
      }

      const homeBasePayload = buildHomeBasePayload(squadData.address, squadData.radius);
      if (!homeBasePayload && !isFootball11) {
        throw new Error('Adresse invalide: sélectionne une adresse avec des coordonnées.');
      }

      const normalizedAddress = normalizeLocationInput(squadData.address);

      const leagueTeamPayload = {
        captain: user?.documentId ? { connect: [{ documentId: user.documentId }] } : undefined,
        category: 'Senior',
        name: squadData.name,
        roster: user?.documentId ? { connect: [{ documentId: user.documentId }] } : [],
        section: genderEnumMap[squadData.section?.value] || 'Male',
        sport: sportEnumMap[squadData.sport?.label] || squadData.sport?.label || 'Football à 5', // Fallback
        // level: levelValue, // REMOVED to avoid 400 Invalid Key
        cover: squadData.cover,
        division,
        elo,
        logo: squadData.logo,
        ...(homeBasePayload
          ? {
            home_base: {
              ...homeBasePayload,
              city: homeBasePayload.city || normalizedAddress?.city || '',
            },
          }
          : {}),
        ...(isFootball11 && selectedSourceTeamId
          ? {
            source_team: {
              connect: [{ documentId: String(selectedSourceTeamId) }],
            },
          }
          : {}),
      };

      console.log('DEBUG: League Team Payload:', JSON.stringify(leagueTeamPayload, null, 2));

      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          teamName: leagueTeamPayload.name,
        },
        scope: LEAGUE_LEGAL_SCOPES.TEAM_CREATE,
        sourceScreen: 'create_squad_wizard',
        targetLabel: leagueTeamPayload.name,
        targetType: 'league_team',
      });
      if (!legalAcceptance) return;

      setIsLoading(true);

      // 2. Create League Team
      const createdTeam = await createLeagueTeam(leagueTeamPayload, { legalAcceptance });
      const teamId = createdTeam?.documentId || createdTeam?.id;

      if (!teamId) throw new Error('Failed to create league team');

      // 3. Create Slots linked to League Team
      if (squadData.slots && squadData.slots.length > 0) {
        const slotPromises = squadData.slots.map((slot) => {
          /**
           * @param {Date|string} time
           * @returns {string}
           */
          const formatForStrapiTime = (time) => {
            if (time instanceof Date) {
              const hours = time.getHours().toString().padStart(2, '0');
              const minutes = time.getMinutes().toString().padStart(2, '0');
              return `${hours}:${minutes}:00`;
            }
            if (typeof time === 'string') {
              // Check if already HH:mm or HH:mm:ss
              if (time.includes(':')) {
                const parts = time.split(':');
                if (parts.length === 2) return `${time}:00`;
                return time;
              }
            }
            return '00:00:00';
          };

          return createTeamSlot({
            end_hour: formatForStrapiTime(slot.endTime),
            league_team: { connect: [{ documentId: teamId }] }, // Link to LeagueTeam
            ...(slot?.locationMode ? { location_mode: slot.locationMode } : {}),
            recurrence_day: slot.day,
            start_hour: formatForStrapiTime(slot.startTime),
            status: 'open',
          });
        });
        await Promise.all(slotPromises);
      }

      // 4. Navigate to League Squad Tab
      clearPersistedWizardState();
      navigation.navigate(RouteNames.LeagueHomeTab, {
        screen: RouteNames.LeagueSquadTab,
      });
    } catch (error) {
      console.error('Error creating league squad:', error);

      const errorData = error?.response?.data;
      const errorMessage = errorData?.error?.message || error.message;
      const errorDetails = errorData?.error?.details ? JSON.stringify(errorData.error.details) : '';

      console.error('Full Error:', JSON.stringify(errorData, null, 2));

      if (errorMessage?.includes('unique') || errorMessage?.includes('already taken')) {
        setSubmitError("Ce nom d'équipe est déjà pris. Merci de en choisir un autre.");
        alert("Ce nom d'équipe est déjà pris. Merci de en choisir un autre.");
      } else {
        setSubmitError(`Erreur: ${errorMessage}`);
        alert(`Erreur: ${errorMessage}\n${errorDetails}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <LeagueStateView
        description="Recharge la page pour recuperer ta session avant de créer une squad."
        isLoading
        title="Préparation du wizard"
      />
    );
  }

  const renderStep = () => {
    const currentStepKey = stepKeys[step - 1];

    if (currentStepKey === 'sport') {
      return (
        <SquadSportStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
          user={user}
        />
      );
    }

    if (currentStepKey === 'sourceTeam') {
      return (
        <SquadSourceTeamStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
          user={user}
        />
      );
    }

    if (currentStepKey === 'name') {
      return (
        <SquadNameStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'level') {
      return (
        <SquadLevelStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'category') {
      return (
        <SquadCategoryStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'section') {
      return (
        <SquadSectionStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'location') {
      return (
        <SquadLocationStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'image') {
      return (
        <SquadImageStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'availabilities') {
      return (
        <SquadAvailabilitiesStep
          data={squadData}
          onNext={nextStep}
          onPrev={prevStep}
          updateData={updateSquadData}
        />
      );
    }

    if (currentStepKey === 'summary') {
      return (
        <SquadSummaryStep
          data={squadData}
          isLoading={isLoading}
          onPrev={prevStep}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      );
    }

    return null;
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ flex: 1, paddingBottom: 20, paddingTop: 60 }}>
        {renderStep()}
      </View>
      {leagueLegalAcceptanceModal}
    </ScreenContainer>
  );
}

export default CreateSquadWizard;
