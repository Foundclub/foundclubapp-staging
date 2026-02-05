import React, { useMemo } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';
import { getShortAddress } from '@/utils/location';

const AdWizardRecap = ({ navigation }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();
  const queryClient = useQueryClient();

  // Calculate total players
  const totalPlayers = useMemo(() => {
    return state.positions.reduce((sum, p) => sum + p.quantity, 0);
  }, [state.positions]);

  // Mutation
  const createAdMutation = useMutation({
    mutationFn: createRecruitmentAd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      
      // Android Fabric issue: Alert.alert fails if not attached to Activity.
      // We navigate immediately instead of showing an alert.
      
      // Reset wizard state
      dispatch({ type: 'RESET' });
      
      // Navigate to Home Tab -> Recruitment -> Ads with timestamp to force refresh
      navigation.navigate(RouteNames.HomeTab, {
        screen: RouteNames.Search,
        params: {
          initialSearchType: 'recrutement',
          initialRecruitmentTab: 'annonces',
          timestamp: Date.now(), // Unique value to force useEffect in RecrutementListContent
        } 
      });
    },
    onError: (error) => {
      console.error('[AdWizardRecap] Creation error:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'annonce. Veuillez réessayer.');
    },
  });

  const handleSubmit = async () => {
    if (!state.positions?.length) {
      Alert.alert('Erreur', 'Aucun poste sélectionné');
      return;
    }

    const promises = state.positions.map(pos => {
      // Use numeric IDs for relations if available, fallback to documentId or undefined
      const adData = {
        // Required fields
        team: state.team?.documentId || state.team?.id, 
        position: pos.name,
        quantity: pos.quantity,
        type: state.event ? 'ponctuel' : 'saison',
        
        // Optional fields
        description: state.description || undefined,
        validationMode: state.event ? state.validationMode : 'auto',
        address: state.address || undefined,
        
        // Relations
        event: state.event?.documentId || state.event?.id,
        section: state.section?.documentId || state.section?.id,
        category: state.category?.documentId || state.category?.id,
        level: state.minLevel?.documentId || state.minLevel?.id,
      };
      
      // Fallback log if IDs are missing (should not happen if flow works)
      if (!adData.team) console.warn('[AdWizardRecap] Missing team ID', state.team);
      
      return createAdMutation.mutateAsync(adData);
    });

    try {
      await Promise.all(promises);
    } catch (e) {
      console.error('[AdWizardRecap] Promise.all failed:', e);
      // Handled by mutation onError
    }
  };

  // Render grid item for info
  const GridItem = ({ label, value, icon }) => (
    <View style={{ width: '50%', marginBottom: 24, paddingRight: 8 }}>
      <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon && (
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle background for icon
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10
          }}>
            <Text style={{ fontSize: 13 }}>{icon}</Text>
          </View>
        )}
        <Text style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, fontSize: 15 }]} numberOfLines={1}>
          {value || 'Non défini'}
        </Text>
      </View>
    </View>
  );

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non défini';
  
  // Display address logic: Manual address > Team address > Club address
  const displayAddress = state.address 
    ? (state.address.label || getShortAddress(state.address))
    : getShortAddress(state.team?.club?.address || state.team?.club?.addressDetails);

  return (
    <WizardStepLayout
      title="Tout est bon ?"
      subtitle="Vérifiez les détails avant de publier"
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      nextLabel="Créer l'annonce"
      isNextLoading={createAdMutation.isPending}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Main recap card */}
        <View style={[
          Spaces.padding[24],
          {
            backgroundColor: '#1A1A1A',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: Colors.neutral700,
          }
        ]}>
          {/* Team Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={[Fonts.p3, { color: Colors.primary500, marginBottom: 4 }]}>
              Équipe qui recrute
            </Text>
            <Text style={[Fonts.h2, { color: Colors.neutral00, fontSize: 22, fontWeight: '700' }]}>
              {state.team?.name || 'Non définie'}
            </Text>
            {state.team?.club?.name && (
              <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 4 }]}>
                {state.team.club.name}
              </Text>
            )}
          </View>

          {/* Key Info Grid Separator */}
          <View style={{ height: 1, backgroundColor: Colors.neutral700, marginBottom: 24 }} />

          {/* Key Info Grid */}
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            marginBottom: 8,
          }}>
            <GridItem 
              label="Sport" 
              value={sportName}
              icon="⚽"
            />
            <GridItem 
              label="Section" 
              value={state.section?.name}
              icon="👥"
            />
            <GridItem 
              label="Catégorie" 
              value={state.category?.name}
              icon="🏷️"
            />
            <GridItem 
              label="Niveau" 
              value={state.minLevel?.name} 
              icon="📊"
            />
            <GridItem 
              label="Lieu" 
              value={displayAddress}
              icon="📍"
            />
          </View>

          {/* Positions Section */}
          <View style={{ 
            backgroundColor: '#252525', // Slightly lighter inner card
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                Postes recherchés
              </Text>
              <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                Total : {totalPlayers}
              </Text>
            </View>

            <View style={[Spaces.gap[10]]}>
              {state.positions.map((pos, index) => (
                <View 
                  key={index}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#333333',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 12,
                  }}
                >
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00, fontSize: 15 }]}>
                    {pos.name}
                  </Text>
                  <View style={{
                    backgroundColor: Colors.primary500,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                  }}>
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
                      x{pos.quantity}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Event Linked (Optional) */}
          {state.event && (
            <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colors.neutral700 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>📅</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                  Lié à l'événement
                </Text>
              </View>
              <Text style={[Fonts.h4, { color: Colors.neutral00, marginLeft: 30 }]}>
                {state.event.name || state.event.type?.name || 'Événement'}
              </Text>
            </View>
          )}

          {/* Description (Optional) */}
          {state.description && (
            <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colors.neutral700 }}>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
                Description
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200, lineHeight: 22 }]}>
                {state.description}
              </Text>
            </View>
          )}
        </View>

        {/* Info Notification */}
        <View style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: '#0F292E',
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.primary900
        }}>
          <View style={{ 
            width: 24, height: 24, backgroundColor: Colors.neutral400, borderRadius: 4, 
            alignItems: 'center', justifyContent: 'center', marginRight: 12 
          }}>
             <Text style={{ fontSize: 14, color: Colors.neutral900, fontWeight: 'bold' }}>i</Text>
          </View>
          <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1, lineHeight: 18 }]}>
            L'annonce sera visible par tous les joueurs correspondant à ce profil.
          </Text>
        </View>
      </ScrollView>
    </WizardStepLayout>
  );
};

export default AdWizardRecap;
