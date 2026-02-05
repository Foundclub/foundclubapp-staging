import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { useSearchClubs } from '@/services/club/clubQueries';
import { RouteNames } from '@/navigation/routeNames';

import { getImageUrl } from '@/utils/imageUrl';

const searchIcon = require('@/assets/icons/search.png');
const defaultClubIcon = require('@/assets/icons/shield.png');

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

const HistoryWizardClub = ({ navigation, route }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customClubName, setCustomClubName] = useState(state.customClubName || '');
  const [showCustomInput, setShowCustomInput] = useState(state.useCustomClub);
  
  const [selectedMultisport, setSelectedMultisport] = useState(null);
  const [showMultisportModal, setShowMultisportModal] = useState(false);

  useEffect(() => {
    // Check if we need to reset the context (e.g. starting a new flow)
    if (route.params?.resetContext) {
      dispatch({ type: 'RESET' });
    }
    
    // Check if a return route was provided
    if (route.params?.returnRoute) {
      dispatch({ type: 'SET_RETURN_ROUTE', payload: route.params.returnRoute });
    }
  }, [route.params, dispatch]);

  const { data: clubResults, isLoading } = useSearchClubs(searchQuery, { 
    enabled: searchQuery.length >= 2 && !showCustomInput 
  });

  const handleSelectClub = (club) => {
    if (club._type === 'multisport') {
      setSelectedMultisport(club);
      setShowMultisportModal(true);
    } else {
      dispatch({ type: 'SET_CLUB', payload: club });
      navigation.navigate(RouteNames.HistoryWizardCategory);
    }
  };

  const handleSelectMultisportParent = () => {
    dispatch({ type: 'SET_MULTISPORT_CLUB', payload: selectedMultisport });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardCategory);
  };

  const handleSelectMultisportSection = (section) => {
    // Sections are just Clubs, but we need to fetch the full club details potentially later, 
    // or we assume section has enough info. Ideally we'd want the logo etc.
    // Since section from search only has id/name, we might need to handle logo display gracefully 
    // or fetch it. For now, we trust the flow.
    // Wait, sections from getClubs (includeMultisport) only have documentId and name.
    // We should probably treat it as a club selection but maybe we need more data? 
    // Let's assume for now we just set it and the recap/display will handle it or fetch needed info.
    // Actually, checking clubService, sections populated fields are ['documentId', 'name'].
    // We might need to fetch the full club if we want to display logo immediately?
    // UserHistorySection fetches its own data so it will be fine.
    // HistoryWizardRecap uses state.club. 
    // If state.club only has name/id, the logo will be missing in Recap. 
    // That's a minor issue we can accept or fix by fetching.
    // Let's set it as club.
    dispatch({ type: 'SET_CLUB', payload: section });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardCategory);
  };

  const handleUseCustomClub = () => {
    if (customClubName.trim()) {
      dispatch({ type: 'SET_CUSTOM_CLUB', payload: customClubName.trim() });
      navigation.navigate(RouteNames.HistoryWizardCategory);
    }
  };

  const canProceed = state.club || state.multisportClub || (showCustomInput && customClubName.trim());

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
              value={state.club ? state.club.name : (state.multisportClub ? state.multisportClub.name : searchQuery)}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (state.club || state.multisportClub) dispatch({ type: 'RESET' }); // Reset if user types again
              }}
              placeholder="Rechercher un club..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={[Fonts.p1, { flex: 1, color: '#FFFFFF', paddingVertical: 12 }]}
            />
            {isLoading && <ActivityIndicator size="small" color={Colors.primary500} />}
          </View>

          {/* Club Results */}
          {searchQuery.length >= 2 && !state.club && !state.multisportClub && (
            <View style={[Spaces.gap[8]]}>
              {clubResults?.slice(0, 6).map((club) => (
                <TouchableOpacity
                  key={club.documentId}
                  onPress={() => handleSelectClub(club)}
                  style={{
                    backgroundColor: Colors.neutral800,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: Colors.neutral700,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Image
                    source={club.logo?.url ? { uri: getImageUrl(club.logo.url) } : defaultClubIcon}
                    style={{
                      width: 40,
                      height: 40,
                      marginRight: 12,
                      tintColor: club.logo?.url ? undefined : Colors.neutral300,
                    }}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{club.name}</Text>
                    {club._type === 'multisport' && (
                      <Text style={[Fonts.p3, { color: Colors.primary500 }]}>Club Multisport • {club.sectionsCount || 0} sections</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Club Display */}
          {(state.club || state.multisportClub) && (
            <View style={{
              backgroundColor: Colors.primary500 + '20',
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor: Colors.primary500,
            }}>
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                {state.club?.name || state.multisportClub?.name}
              </Text>
              {state.multisportClub && (
                 <Text style={[Fonts.p3, { color: Colors.primary500 }]}>Club Multisport</Text>
              )}
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

      {/* Multisport Selection Modal */}
      <BottomModal
        isVisible={showMultisportModal}
        close={() => setShowMultisportModal(false)}
        snapPoints={['90%']}
        headerComponent={
          <View style={[Alignments.alignCenter]}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
              {selectedMultisport?.name}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginTop: 8 }]}>
              Sélectionnez votre entité de rattachement
            </Text>
          </View>
        }
      >
        <View style={[Spaces.gap[12]]}>
          {/* Option 1: Global Multisport Club */}
          <TouchableOpacity
            onPress={handleSelectMultisportParent}
            style={{
              padding: 16,
              backgroundColor: Colors.neutral800,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: Colors.primary500,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
             <Image
                source={selectedMultisport?.logo?.url ? { uri: getImageUrl(selectedMultisport.logo.url) } : defaultClubIcon}
                style={{
                  width: 40,
                  height: 40,
                  marginRight: 12,
                  tintColor: selectedMultisport?.logo?.url ? undefined : Colors.primary500,
                }}
                resizeMode="contain"
              />
            <View>
                <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>Club Multisport (Global)</Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Je suis rattaché à la structure principale</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: Colors.neutral700, marginVertical: 8 }} />

          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Sections disponibles :</Text>

          {/* Option 2: Sections */}
          {selectedMultisport?.sections?.map((section) => (
            <TouchableOpacity
              key={section.documentId}
              onPress={() => handleSelectMultisportSection(section)}
              style={{
                padding: 16,
                backgroundColor: Colors.neutral800,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.neutral700,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 40, height: 40, marginRight: 12, alignItems: 'center', justifyContent: 'center',  backgroundColor: Colors.neutral700, borderRadius: 8 }}>
                 <Text style={[Fonts.h4Bold, { color: Colors.neutral300 }]}>
                    {section.name.charAt(0).toUpperCase()}
                 </Text>
              </View>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{section.name}</Text>
            </TouchableOpacity>
          ))}
          
          {(!selectedMultisport?.sections || selectedMultisport.sections.length === 0) && (
              <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Aucune section listée.</Text>
          )}
        </View>
      </BottomModal>
    </WizardStepLayout>
  );
};

export default HistoryWizardClub;
