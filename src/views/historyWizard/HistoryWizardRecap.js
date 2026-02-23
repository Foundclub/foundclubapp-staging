import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useCreateHistory, useUpdateHistory } from '@/services/userHistory/userHistoryQueries';

import { getImageUrl } from '@/utils/imageUrl';

import { useHistoryWizard } from './HistoryWizardContext';
const calendarIcon = require('@/assets/icons/calendar.png');
const defaultClubIcon = require('@/assets/icons/shield.png');

/**
 *
 * @param root0
 * @param root0.navigation
 */
function HistoryWizardRecap({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useHistoryWizard();

  const createHistoryMutation = useCreateHistory();
  const updateHistoryMutation = useUpdateHistory();

  const isEditing = !!state.editingEntry;
  const isLoading = createHistoryMutation.isPending || updateHistoryMutation.isPending;

  const getClubName = () => {
    if (state.club?.name) return state.club.name;
    if (state.multisportClub?.name) return state.multisportClub.name;
    if (state.customClubName) return state.customClubName;
    return 'Club non défini';
  };

  const getPeriodText = () => {
    if (state.isCurrentlyActive) {
      return `${state.startYear} - Aujourd'hui`;
    }
    if (state.startYear === state.endYear) {
      return `${state.startYear}`;
    }
    return `${state.startYear} - ${state.endYear}`;
  };

  const handleSubmit = () => {
    console.log('DEBUG: HistoryWizardRecap state:', JSON.stringify(state, null, 2));

    const data = {
      category: state.category?.documentId || null,
      club: state.club?.documentId || null,
      customClubName: state.useCustomClub ? state.customClubName : null,
      endYear: state.isCurrentlyActive ? null : state.endYear,
      isCurrentlyActive: state.isCurrentlyActive,
      level: state.level?.documentId || null,
      multisport_club: state.multisportClub?.documentId || null,
      startYear: state.startYear,
    };

    console.log('DEBUG: HistoryWizardRecap submitting data:', JSON.stringify(data, null, 2));

    const onSuccess = () => {
      dispatch({ type: 'RESET' });

      if (state.returnRoute) {
        // If a specific return route was asked (e.g. Onboarding), go there
        navigation.navigate(state.returnRoute);
      } else {
        // Default behavior: Reset navigation to profile
        navigation.reset({
          index: 0,
          routes: [{ name: RouteNames.Profile }],
        });
      }
    };

    if (isEditing) {
      updateHistoryMutation.mutate({ data, id: state.editingEntry.documentId }, { onSuccess });
    } else {
      createHistoryMutation.mutate(data, { onSuccess });
    }
  };

  return (
    <WizardStepLayout
      isNextLoading={isLoading}
      nextLabel={isEditing ? 'Enregistrer' : 'Valider'}
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      subtitle="Vérifie les informations avant de valider"
      title="Récapitulatif"
    >
      <View style={[Spaces.gap[32]]}>
        {/* Club Card - Premium Design */}
        <View style={{
          backgroundColor: Colors.neutral800,
          borderColor: `${Colors.primary500}40`,
          borderRadius: 20,
          borderWidth: 1,
          elevation: 4,
          padding: 24,
          shadowColor: Colors.primary500,
          shadowOpacity: 0.1,
          shadowRadius: 12,
        }}
        >
          {/* Club Logo - Centered Top */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderColor: Colors.primary500,
              borderRadius: 20,
              borderWidth: 2,
              height: 80,
              justifyContent: 'center',
              width: 80,
            }}
            >
              <Image
                resizeMode="contain"
                source={(state.club?.logo?.url || state.multisportClub?.logo?.url)
                  ? { uri: getImageUrl(state.club?.logo?.url || state.multisportClub?.logo?.url) }
                  : defaultClubIcon}
                style={{
                  height: 56,
                  tintColor: (state.club?.logo?.url || state.multisportClub?.logo?.url) ? undefined : Colors.primary500,
                  width: 56,
                }}
              />
            </View>
          </View>

          {/* Club Name - Centered */}
          <Text
            numberOfLines={2}
            style={[
              Fonts.h3Bold,
              {
                color: Colors.neutral00,
                marginBottom: 16,
                textAlign: 'center',
              },
            ]}
          >
            {getClubName()}
          </Text>

          {/* Tags Row - Centered */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 16,
          }}
          >
            {state.category && (
              <View style={{
                backgroundColor: Colors.primary500,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
              >
                <Text style={[Fonts.p2Bold, { color: '#FFFFFF' }]}>{state.category.name}</Text>
              </View>
            )}
            {state.level && (
              <View style={{
                backgroundColor: 'transparent',
                borderColor: Colors.neutral500,
                borderRadius: 20,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
              >
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{state.level.name}</Text>
              </View>
            )}
          </View>

          {/* Period - Centered with Icon */}
          <View style={{
            alignItems: 'center',
            backgroundColor: Colors.neutral900,
            borderRadius: 12,
            flexDirection: 'row',
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
          >
            <Image
              source={calendarIcon}
              style={{
                height: 18, marginRight: 8, tintColor: Colors.primary500, width: 18,
              }}
            />
            <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
              {getPeriodText()}
            </Text>
            {state.isCurrentlyActive && (
              <View style={{
                backgroundColor: '#10B981',
                borderRadius: 10,
                marginLeft: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
              >
                <Text style={[Fonts.p3, { color: '#FFFFFF', fontWeight: 'bold' }]}>ACTIF</Text>
              </View>
            )}
          </View>
        </View>

        {/* Warning Declaration - Compact */}
        <View style={{
          backgroundColor: Colors.neutral800,
          borderColor: '#F59E0B' + '40',
          borderRadius: 16,
          borderWidth: 1,
          padding: 16,
        }}
        >
          <View style={{ alignItems: 'flex-start', flexDirection: 'row' }}>
            <Text style={{ fontSize: 20, marginRight: 12 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, { color: '#F59E0B', marginBottom: 4 }]}>
                Déclaration sur l'honneur
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral00, lineHeight: 18 }]}>
                Ces informations peuvent être vérifiées par la communauté.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default HistoryWizardRecap;
