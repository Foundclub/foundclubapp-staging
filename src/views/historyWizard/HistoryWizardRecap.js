import React from 'react';
import { View, Text, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { useCreateHistory, useUpdateHistory } from '@/services/userHistory/userHistoryQueries';
import { RouteNames } from '@/navigation/routeNames';

const defaultClubIcon = require('@/assets/icons/shield.png');
const calendarIcon = require('@/assets/icons/calendar.png');

const HistoryWizardRecap = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();
  
  const createHistoryMutation = useCreateHistory();
  const updateHistoryMutation = useUpdateHistory();
  
  const isEditing = !!state.editingEntry;
  const isLoading = createHistoryMutation.isPending || updateHistoryMutation.isPending;

  const getClubName = () => {
    if (state.club?.name) return state.club.name;
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
    const data = {
      club: state.club?.documentId || null,
      customClubName: state.useCustomClub ? state.customClubName : null,
      category: state.category?.documentId || null,
      level: state.level?.documentId || null,
      startYear: state.startYear,
      endYear: state.isCurrentlyActive ? null : state.endYear,
      isCurrentlyActive: state.isCurrentlyActive,
    };

    const onSuccess = () => {
      dispatch({ type: 'RESET' });
      // Reset navigation to profile, clearing the wizard screens from the stack
      navigation.reset({
        index: 0,
        routes: [{ name: RouteNames.Profile }],
      });
    };

    if (isEditing) {
      updateHistoryMutation.mutate({ id: state.editingEntry.documentId, data }, { onSuccess });
    } else {
      createHistoryMutation.mutate(data, { onSuccess });
    }
  };

  return (
    <WizardStepLayout
      title="Récapitulatif"
      subtitle="Vérifie les informations avant de valider"
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      nextLabel={isEditing ? 'Enregistrer' : 'Valider'}
      isNextLoading={isLoading}
    >
      <View style={[Spaces.gap[32]]}>
        {/* Club Card - Premium Design */}
        <View style={{
          backgroundColor: Colors.neutral800,
          borderRadius: 20,
          padding: 24,
          borderWidth: 1,
          borderColor: Colors.primary500 + '40',
          shadowColor: Colors.primary500,
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        }}>
          {/* Club Logo - Centered Top */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: Colors.neutral700,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: Colors.primary500 + '50',
            }}>
              <Image
                source={state.club?.logo?.url ? { uri: state.club.logo.url } : defaultClubIcon}
                style={{
                  width: 56,
                  height: 56,
                  tintColor: state.club?.logo?.url ? undefined : Colors.primary500,
                }}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Club Name - Centered */}
          <Text 
            style={[
              Fonts.h3Bold, 
              { 
                color: Colors.neutral00, 
                textAlign: 'center',
                marginBottom: 16,
              }
            ]}
            numberOfLines={2}
          >
            {getClubName()}
          </Text>

          {/* Tags Row - Centered */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
          }}>
            {state.category && (
              <View style={{
                backgroundColor: Colors.primary500,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
              }}>
                <Text style={[Fonts.p2Bold, { color: '#FFFFFF' }]}>{state.category.name}</Text>
              </View>
            )}
            {state.level && (
              <View style={{
                backgroundColor: 'transparent',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: Colors.neutral500,
              }}>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{state.level.name}</Text>
              </View>
            )}
          </View>

          {/* Period - Centered with Icon */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: Colors.neutral900,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
          }}>
            <Image 
              source={calendarIcon} 
              style={{ width: 18, height: 18, marginRight: 8, tintColor: Colors.primary500 }} 
            />
            <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
              {getPeriodText()}
            </Text>
            {state.isCurrentlyActive && (
              <View style={{
                backgroundColor: '#10B981',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                marginLeft: 10,
              }}>
                <Text style={[Fonts.p3, { color: '#FFFFFF', fontWeight: 'bold' }]}>ACTIF</Text>
              </View>
            )}
          </View>
        </View>

        {/* Warning Declaration - Compact */}
        <View style={{
          backgroundColor: Colors.neutral800,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: '#F59E0B' + '40',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
};

export default HistoryWizardRecap;
