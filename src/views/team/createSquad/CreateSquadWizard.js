import React, { useState } from 'react';
import { View, Text } from 'react-native';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useTheme from '@/theme/themeContext';
import SquadNameStep from '@/views/team/createSquad/steps/SquadNameStep';
import SquadSportStep from '@/views/team/createSquad/steps/SquadSportStep';
import SquadLevelStep from '@/views/team/createSquad/steps/SquadLevelStep';
import SquadCategoryStep from '@/views/team/createSquad/steps/SquadCategoryStep';
import SquadSectionStep from '@/views/team/createSquad/steps/SquadSectionStep';
import SquadLocationStep from '@/views/team/createSquad/steps/SquadLocationStep';
import SquadImageStep from '@/views/team/createSquad/steps/SquadImageStep';
import SquadAvailabilitiesStep from '@/views/team/createSquad/steps/SquadAvailabilitiesStep';
import SquadSummaryStep from '@/views/team/createSquad/steps/SquadSummaryStep';

import { createLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { createTeamSlot } from '@/services/teamSlot/teamSlotService';
import useAuth from '@/domains/auth/useAuth';
import { RouteNames } from '@/navigation/routeNames';
import { buildHomeBasePayload, normalizeLocationInput } from '@/utils/location';

/**
 * @typedef {Object} AddressProperties
 * @property {string} [city]
 * @property {string} [label]
 */

/**
 * @typedef {Object} AddressObject
 * @property {AddressProperties} [properties]
 */

/**
 * @typedef {Object} SelectOption
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {Object} TimeSlot
 * @property {string} day
 * @property {Date} startTime
 * @property {Date} endTime
 */

/**
 * @typedef {Object} SquadData
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
const CreateSquadWizard = ({ navigation }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  // @ts-ignore - useAuth returns extended user object
  const { userData: user } = useAuth();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  /** @type {[SquadData, React.Dispatch<React.SetStateAction<SquadData>>]} */
  const [squadData, setSquadData] = useState(/** @type {SquadData} */ ({
    name: '',
    sport: null,
    level: null,
    address: null,
    city: '',
    slots: [],
    category: null,
    section: null,
    radius: 50, // Default radius if needed
    logo: null,
    cover: null,
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
            'Football': 'Football à 5',
            'Football à 5': 'Football à 5',
            'Padel': 'Padel',
            // Default fallback if label differs slightly, though Autocomplete usage suggests direct mapping
            'Five': 'Football à 5',
            'Urban Soccer': 'Football à 5',
            'Foot': 'Football à 5',
            'Futsal': 'Football à 5'
        };
        const genderEnumMap = {
            'male': 'Male',
            'female': 'Female',
            'mixed': 'Mixed'
        };

        // Level to ELO/Division Mapping
        const levelValue = squadData.level?.value || 'beginner';
        let elo = 900;
        let division = 5;
        
        switch (levelValue) {
            case 'beginner': elo = 900; division = 5; break;
            case 'intermediate': elo = 1000; division = 5; break;
            case 'advanced': elo = 1100; division = 5; break;
            case 'expert': elo = 1200; division = 5; break;
            default: elo = 900; division = 5;
        }

        const homeBasePayload = buildHomeBasePayload(squadData.address, squadData.radius);
        if (!homeBasePayload) {
            throw new Error('Adresse invalide: selectionnez une adresse avec des coordonnees.');
        }

        const normalizedAddress = normalizeLocationInput(squadData.address);

        const leagueTeamPayload = {
            name: squadData.name,
            captain: user?.documentId ? { connect: [{ documentId: user.documentId }] } : undefined,
            roster: user?.documentId ? { connect: [{ documentId: user.documentId }] } : [],
            sport: sportEnumMap[squadData.sport?.label] || squadData.sport?.label || 'Football à 5', // Fallback
            section: genderEnumMap[squadData.section?.value] || 'Male',
            category: squadData.category?.label || 'Senior',
            // level: levelValue, // REMOVED to avoid 400 Invalid Key
            elo: elo,
            division: division,
            home_base: {
                ...homeBasePayload,
                city: homeBasePayload.city || normalizedAddress?.city || '',
            },
            logo: squadData.logo,
            cover: squadData.cover,
        };

        console.log('DEBUG: League Team Payload:', JSON.stringify(leagueTeamPayload, null, 2));

        // 2. Create League Team
        const createdTeam = await createLeagueTeam(leagueTeamPayload);
        const teamId = createdTeam?.documentId || createdTeam?.id;

        if (!teamId) throw new Error('Failed to create league team');

        // 3. Create Slots linked to League Team
        if (squadData.slots && squadData.slots.length > 0) {
            const slotPromises = squadData.slots.map(slot => {
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
                    league_team: { connect: [{ documentId: teamId }] }, // Link to LeagueTeam
                    recurrence_day: slot.day,
                    start_hour: formatForStrapiTime(slot.startTime),
                    end_hour: formatForStrapiTime(slot.endTime),
                    status: 'open'
                });
            });
            await Promise.all(slotPromises);
        }
        
        // 4. Navigate to League Squad Tab
        navigation.navigate(RouteNames.LeagueHomeTab, {
            screen: RouteNames.LeagueSquadTab
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
            updateData={updateSquadData} 
            onNext={nextStep} 
          />
        );
      case 2:
        return (
          <SquadSportStep 
            data={squadData} 
            updateData={updateSquadData} 
            onNext={nextStep}
            onPrev={prevStep} 
          />
        );
      case 3:
        return (
          <SquadLevelStep
            data={squadData}
            updateData={updateSquadData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        );
      case 4:
        return (
          <SquadCategoryStep
            data={squadData}
            updateData={updateSquadData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        );
      case 5:
        return (
          <SquadSectionStep
            data={squadData}
            updateData={updateSquadData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        );
      case 6:
        return (
          <SquadLocationStep 
            data={squadData} 
            updateData={updateSquadData} 
            onNext={nextStep}
            onPrev={prevStep} 
          />
        );
      case 7:
        return (
          <SquadImageStep 
            data={squadData} 
            updateData={updateSquadData} 
            onNext={nextStep} 
            onPrev={prevStep}
          />
        );
      case 8:
        return (
          <SquadAvailabilitiesStep 
            data={squadData} 
            updateData={updateSquadData} 
            onNext={nextStep} 
            onPrev={prevStep}
          />
        );
      case 9:
        return (
          <SquadSummaryStep 
            data={squadData} 
            onPrev={prevStep}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ flex: 1, paddingTop: 60, paddingBottom: 20 }}>
        {renderStep()}
      </View>
    </ScreenContainer>
  );
};

export default CreateSquadWizard;

