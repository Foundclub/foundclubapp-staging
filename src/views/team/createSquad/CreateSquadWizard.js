import React, { useState } from 'react';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import SquadAvailabilitiesStep from '@/views/team/createSquad/steps/SquadAvailabilitiesStep';
import SquadCategoryStep from '@/views/team/createSquad/steps/SquadCategoryStep';
import SquadImageStep from '@/views/team/createSquad/steps/SquadImageStep';
import SquadLevelStep from '@/views/team/createSquad/steps/SquadLevelStep';
import SquadLocationStep from '@/views/team/createSquad/steps/SquadLocationStep';
import SquadNameStep from '@/views/team/createSquad/steps/SquadNameStep';
import SquadSectionStep from '@/views/team/createSquad/steps/SquadSectionStep';
import SquadSportStep from '@/views/team/createSquad/steps/SquadSportStep';
import SquadSummaryStep from '@/views/team/createSquad/steps/SquadSummaryStep';

import { RouteNames } from '@/navigation/routeNames';

import { createLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { createTeamSlot } from '@/services/teamSlot/teamSlotService';

import { buildHomeBasePayload, normalizeLocationInput } from '@/utils/location';

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
 */

/**
 * Squad creation wizard component
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function CreateSquadWizard({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  // @ts-ignore - useAuth returns extended user object
  const { userData: user } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  /** @type {[SquadData, React.Dispatch<React.SetStateAction<SquadData>>]} */
  const [squadData, setSquadData] = useState(/** @type {SquadData} */ ({
    address: null,
    category: null,
    city: '',
    cover: null,
    level: null,
    logo: null,
    name: '',
    radius: 50, // Default radius if needed
    section: null,
    slots: [],
    sport: null,
  }));

  const nextStep = () => setStep((prev) => prev + 1);
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
    setSquadData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
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
      if (!homeBasePayload) {
        throw new Error('Adresse invalide: sélectionnez une adresse avec des coordonnées.');
      }

      const normalizedAddress = normalizeLocationInput(squadData.address);

      const leagueTeamPayload = {
        captain: user?.documentId ? { connect: [{ documentId: user.documentId }] } : undefined,
        category: squadData.category?.label || 'Senior',
        name: squadData.name,
        roster: user?.documentId ? { connect: [{ documentId: user.documentId }] } : [],
        section: genderEnumMap[squadData.section?.value] || 'Male',
        sport: sportEnumMap[squadData.sport?.label] || squadData.sport?.label || 'Football à 5', // Fallback
        // level: levelValue, // REMOVED to avoid 400 Invalid Key
        cover: squadData.cover,
        division,
        elo,
        home_base: {
          ...homeBasePayload,
          city: homeBasePayload.city || normalizedAddress?.city || '',
        },
        logo: squadData.logo,
      };

      console.log('DEBUG: League Team Payload:', JSON.stringify(leagueTeamPayload, null, 2));

      // 2. Create League Team
      const createdTeam = await createLeagueTeam(leagueTeamPayload);
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
            recurrence_day: slot.day,
            start_hour: formatForStrapiTime(slot.startTime),
            status: 'open',
          });
        });
        await Promise.all(slotPromises);
      }

      // 4. Navigate to League Squad Tab
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
        alert("Ce nom d'équipe est déjà pris. Veuillez en choisir un autre.");
      } else {
        alert(`Erreur: ${errorMessage}\n${errorDetails}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <SquadNameStep
            data={squadData}
            onNext={nextStep}
            updateData={updateSquadData}
          />
        );
      case 2:
        return (
          <SquadSportStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 3:
        return (
          <SquadLevelStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 4:
        return (
          <SquadCategoryStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 5:
        return (
          <SquadSectionStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 6:
        return (
          <SquadLocationStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 7:
        return (
          <SquadImageStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 8:
        return (
          <SquadAvailabilitiesStep
            data={squadData}
            onNext={nextStep}
            onPrev={prevStep}
            updateData={updateSquadData}
          />
        );
      case 9:
        return (
          <SquadSummaryStep
            data={squadData}
            isLoading={isLoading}
            onPrev={prevStep}
            onSubmit={handleSubmit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ flex: 1, paddingBottom: 20, paddingTop: 60 }}>
        {renderStep()}
      </View>
    </ScreenContainer>
  );
}

export default CreateSquadWizard;
