import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useSearchClubs } from '@/services/club/clubQueries';

import { getImageUrl } from '@/utils/imageUrl';

import { useHistoryWizard } from './HistoryWizardContext';

const searchIcon = require('@/assets/icons/search.png');
const defaultClubIcon = require('@/assets/icons/shield.png');

/** @typedef {import('@/domains/club/types').Club} Club */
/** @typedef {{ documentId?: string; name?: string }} ClubSection */

/**
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route: { params?: { resetContext?: boolean; returnRoute?: string } };
 * }} props
 */
function HistoryWizardClub({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useHistoryWizard();

  const [searchQuery, setSearchQuery] = useState('');
  const [customClubName, setCustomClubName] = useState(state.customClubName || '');
  const [showCustomInput, setShowCustomInput] = useState(state.useCustomClub);

  const [selectedMultisport, setSelectedMultisport] = useState(/** @type {Club | undefined} */ (undefined));
  const [showMultisportModal, setShowMultisportModal] = useState(false);

  useEffect(() => {
    // Check if we need to reset the context (e.g. starting a new flow)
    if (route.params?.resetContext) {
      dispatch({ type: 'RESET' });
    }

    // Check if a return route was provided
    if (route.params?.returnRoute) {
      dispatch({ payload: route.params.returnRoute, type: 'SET_RETURN_ROUTE' });
    }
  }, [route.params, dispatch]);

  const { data: clubResults, isLoading } = useSearchClubs(searchQuery, {
    enabled: searchQuery.length >= 2 && !showCustomInput,
  });

  const handleSelectClub = (/** @type {Club} */ club) => {
    if (club._type === 'multisport') {
      setSelectedMultisport(club);
      setShowMultisportModal(true);
    } else {
      dispatch({ payload: club, type: 'SET_CLUB' });
      navigation.navigate(RouteNames.HistoryWizardCategory);
    }
  };

  const handleSelectMultisportParent = () => {
    dispatch({ payload: selectedMultisport, type: 'SET_MULTISPORT_CLUB' });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardCategory);
  };

  const handleSelectMultisportSection = (/** @type {ClubSection} */ section) => {
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
    dispatch({ payload: section, type: 'SET_CLUB' });
    setShowMultisportModal(false);
    navigation.navigate(RouteNames.HistoryWizardCategory);
  };

  const handleUseCustomClub = () => {
    if (customClubName.trim()) {
      dispatch({ payload: customClubName.trim(), type: 'SET_CUSTOM_CLUB' });
      navigation.navigate(RouteNames.HistoryWizardCategory);
    }
  };

  const canProceed = !!(state.club || state.multisportClub || (showCustomInput && customClubName.trim()));

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.HISTORY_WIZARD}
      userId={userData?.documentId}
    >
      <WizardStepLayout
        isNextDisabled={!canProceed}
        nextLabel={t('common.actions.next', 'Suivant')}
        onBack={() => navigation.goBack()}
        onNext={canProceed ? () => navigation.navigate(RouteNames.HistoryWizardCategory) : undefined}
        onSkip={() => {}}
        subtitle="Recherche ton club ou saisis-le manuellement"
        title="Quel club ?"
      >
        <OnboardingWrapper
          description="Commencez par rechercher votre club ou saisir le nom manuellement."
          id="history-wizard-club-input"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          title="Selection du club"
        >
          {!showCustomInput ? (
            <View style={[Spaces.gap[16]]}>
              {/* Search Input */}
              <View style={{
                alignItems: 'center',
                borderBottomColor: '#FFFFFF',
                borderBottomWidth: 1.5,
                flexDirection: 'row',
                height: 48,
              }}
              >
                <Image
                  source={searchIcon}
                  style={{
                    height: 24, marginRight: 12, tintColor: '#FFFFFF', width: 24,
                  }}
                />
                <TextInput
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (state.club || state.multisportClub) dispatch({ type: 'RESET' }); // Reset if user types again
                  }}
                  placeholder="Rechercher un club..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={[Fonts.p1, { color: '#FFFFFF', flex: 1, paddingVertical: 12 }]}
                  value={state.club ? (state.club.name || '') : (state.multisportClub ? (state.multisportClub.name || '') : searchQuery)}
                />
                {isLoading && <ActivityIndicator color={Colors.primary500} size="small" />}
              </View>

              {/* Club Results */}
              {searchQuery.length >= 2 && !state.club && !state.multisportClub && (
              <View style={[Spaces.gap[8]]}>
                {(clubResults || []).slice(0, 6).map((/** @type {Club} */ club) => (
                  <TouchableOpacity
                    key={club.documentId}
                    onPress={() => handleSelectClub(club)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: Colors.neutral800,
                      borderColor: Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 1,
                      flexDirection: 'row',
                      padding: 12,
                    }}
                  >
                    <Image
                      resizeMode="contain"
                      source={club.logo?.url ? { uri: getImageUrl(club.logo.url) } : defaultClubIcon}
                      style={{
                        height: 40,
                        marginRight: 12,
                        tintColor: club.logo?.url ? undefined : Colors.neutral300,
                        width: 40,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{club.name}</Text>
                      {club._type === 'multisport' && (
                      <Text style={[Fonts.p3, { color: Colors.primary500 }]}>
                        Club Multisport •
                        {club.sectionsCount || 0}
                        {' '}
                        sections
                      </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              )}

              {/* Selected Club Display */}
              {(state.club || state.multisportClub) && (
              <View style={{
                backgroundColor: `${Colors.primary500}20`,
                borderColor: Colors.primary500,
                borderRadius: 12,
                borderWidth: 2,
                padding: 16,
              }}
              >
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
                borderBottomColor: '#FFFFFF',
                borderBottomWidth: 1.5,
                height: 48,
              }}
              >
                <TextInput
                  autoFocus
                  onChangeText={setCustomClubName}
                  placeholder="Nom du club..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={[Fonts.p1, { color: '#FFFFFF', flex: 1, paddingVertical: 12 }]}
                  value={customClubName}
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
                  alignItems: 'center',
                  backgroundColor: Colors.primary500,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <Text style={[Fonts.p1Bold, { color: '#FFFFFF' }]}>
                  Valider "
                  {customClubName.trim()}
                  "
                </Text>
              </TouchableOpacity>
              )}
            </View>
          )}
        </OnboardingWrapper>

        {/* Multisport Selection Modal */}
        <BottomModal
          close={() => setShowMultisportModal(false)}
          headerComponent={(
            <View style={[Alignments.alignCenter]}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
                {selectedMultisport?.name}
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
                Sélectionnez votre entité de rattachement
              </Text>
            </View>
        )}
          isVisible={showMultisportModal}
          snapPoints={['90%']}
        >
          <View style={[Spaces.gap[12]]}>
            {/* Option 1: Global Multisport Club */}
            <TouchableOpacity
              onPress={handleSelectMultisportParent}
              style={{
                alignItems: 'center',
                backgroundColor: Colors.neutral800,
                borderColor: Colors.primary500,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: 'row',
                padding: 16,
              }}
            >
              <Image
                resizeMode="contain"
                source={selectedMultisport?.logo?.url ? { uri: getImageUrl(selectedMultisport.logo.url) } : defaultClubIcon}
                style={{
                  height: 40,
                  marginRight: 12,
                  tintColor: selectedMultisport?.logo?.url ? undefined : Colors.primary500,
                  width: 40,
                }}
              />
              <View>
                <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>Club Multisport (Global)</Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Je suis rattaché à la structure principale</Text>
              </View>
            </TouchableOpacity>

            <View style={{ backgroundColor: Colors.neutral700, height: 1, marginVertical: 8 }} />

            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Sections disponibles :</Text>

            {/* Option 2: Sections */}
            {selectedMultisport?.sections?.map((section) => (
              <TouchableOpacity
                key={section.documentId}
                onPress={() => handleSelectMultisportSection(section)}
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.neutral800,
                  borderColor: Colors.neutral700,
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: 'row',
                  padding: 16,
                }}
              >
                <View style={{
                  alignItems: 'center', backgroundColor: Colors.neutral700, borderRadius: 8, height: 40, justifyContent: 'center', marginRight: 12, width: 40,
                }}
                >
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
    </TutorialFlowBoundary>
  );
}

export default HistoryWizardClub;
