import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { useSearchClubs } from '@/services/club/clubQueries';
import { RouteNames } from '@/navigation/routeNames';

const searchIcon = require('@/assets/icons/search.png');

const HistoryWizardClub = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customClubName, setCustomClubName] = useState(state.customClubName || '');
  const [showCustomInput, setShowCustomInput] = useState(state.useCustomClub);

  const { data: clubResults, isLoading } = useSearchClubs(searchQuery, { 
    enabled: searchQuery.length >= 2 && !showCustomInput 
  });

  const handleSelectClub = (club) => {
    dispatch({ type: 'SET_CLUB', payload: club });
    navigation.navigate(RouteNames.HistoryWizardCategory);
  };

  const handleUseCustomClub = () => {
    if (customClubName.trim()) {
      dispatch({ type: 'SET_CUSTOM_CLUB', payload: customClubName.trim() });
      navigation.navigate(RouteNames.HistoryWizardCategory);
    }
  };

  const canProceed = state.club || (showCustomInput && customClubName.trim());

  return (
    <WizardStepLayout
      title="Quel club ?"
      subtitle="Recherche ton club ou saisis-le manuellement"
      onBack={() => navigation.goBack()}
      onNext={canProceed ? () => navigation.navigate(RouteNames.HistoryWizardCategory) : undefined}
      isNextDisabled={!canProceed}
    >
      {!showCustomInput ? (
        <View style={[Spaces.gap[16]]}>
          {/* Search Input */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1.5,
            borderBottomColor: '#FFFFFF',
            height: 48,
          }}>
            <Image source={searchIcon} style={{ width: 24, height: 24, tintColor: '#FFFFFF', marginRight: 12 }} />
            <TextInput
              value={state.club ? state.club.name : searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (state.club) dispatch({ type: 'SET_CLUB', payload: null });
              }}
              placeholder="Rechercher un club..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={[Fonts.p1, { flex: 1, color: '#FFFFFF', paddingVertical: 12 }]}
            />
            {isLoading && <ActivityIndicator size="small" color={Colors.primary500} />}
          </View>

          {/* Club Results */}
          {searchQuery.length >= 2 && !state.club && (
            <View style={[Spaces.gap[8]]}>
              {clubResults?.slice(0, 6).map((club) => (
                <TouchableOpacity
                  key={club.documentId}
                  onPress={() => handleSelectClub(club)}
                  style={{
                    backgroundColor: Colors.neutral800,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: Colors.neutral700,
                  }}
                >
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{club.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Club Display */}
          {state.club && (
            <View style={{
              backgroundColor: Colors.primary500 + '20',
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor: Colors.primary500,
            }}>
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{state.club.name}</Text>
            </View>
          )}

          {/* Custom Club Option */}
          <TouchableOpacity onPress={() => setShowCustomInput(true)}>
            <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
              Club non trouvé ? Saisir manuellement →
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[Spaces.gap[16]]}>
          {/* Custom Club Input */}
          <View style={{
            borderBottomWidth: 1.5,
            borderBottomColor: '#FFFFFF',
            height: 48,
          }}>
            <TextInput
              value={customClubName}
              onChangeText={setCustomClubName}
              placeholder="Nom du club..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={[Fonts.p1, { flex: 1, color: '#FFFFFF', paddingVertical: 12 }]}
              autoFocus
            />
          </View>

          {/* Back to search option */}
          <TouchableOpacity onPress={() => { setShowCustomInput(false); setCustomClubName(''); }}>
            <Text style={[Fonts.p2, { color: Colors.primary500, textAlign: 'center' }]}>
              ← Revenir à la recherche
            </Text>
          </TouchableOpacity>

          {customClubName.trim() && (
            <TouchableOpacity
              onPress={handleUseCustomClub}
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text style={[Fonts.p1Bold, { color: '#FFFFFF' }]}>
                Valider "{customClubName.trim()}"
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </WizardStepLayout>
  );
};

export default HistoryWizardClub;
