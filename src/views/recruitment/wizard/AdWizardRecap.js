import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { getShortAddress } from '@/utils/location';

import { useAdWizard } from './AdWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardRecap({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();
  const queryClient = useQueryClient();

  // Calculate total players
  const totalPlayers = useMemo(() => state.positions.reduce((sum, p) => sum + p.quantity, 0), [state.positions]);

  // Mutation
  const createAdMutation = useMutation({
    mutationFn: createRecruitmentAd,
    onError: (error) => {
      console.error('[AdWizardRecap] Creation error:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'annonce. Veuillez réessayer.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });

      // Android Fabric issue: Alert.alert fails if not attached to Activity.
      // We navigate immediately instead of showing an alert.

      // Reset wizard state
      dispatch({ type: 'RESET' });

      // Navigate to dedicated recruitment search -> ads with timestamp to force refresh
      navigation.navigate(RouteNames.SearchRecruitment, {
        initialRecruitmentTab: 'annonces',
        timestamp: Date.now(), // Unique value to force useEffect in RecrutementListContent
      });
    },
  });

  const handleSubmit = async () => {
    if (!state.positions?.length) {
      Alert.alert('Erreur', 'Aucun poste sélectionné');
      return;
    }

    const promises = state.positions.map((pos) => {
      // Use numeric IDs for relations if available, fallback to documentId or undefined
      const adData = {
        // Required fields
        position: pos.name,
        quantity: pos.quantity,
        team: state.team?.documentId || state.team?.id,
        type: state.event ? 'ponctuel' : 'saison',

        // Optional fields
        address: state.address || undefined,
        description: state.description || undefined,
        validationMode: state.event ? state.validationMode : 'auto',

        // Relations
        category: state.category?.documentId || state.category?.id,
        event: state.event?.documentId || state.event?.id,
        level: state.minLevel?.documentId || state.minLevel?.id,
        section: state.section?.documentId || state.section?.id,
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
  /**
   *
   * @param root0
   * @param root0.icon
   * @param root0.label
   * @param root0.value
   */
  function GridItem({ icon, label, value }) {
    return (
      <View style={{ marginBottom: 24, paddingRight: 8, width: '50%' }}>
        <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
          {label}
        </Text>
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          {icon && (
          <View style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle background for icon
            borderRadius: 8,
            height: 24,
            justifyContent: 'center',
            marginRight: 10,
            width: 24,
          }}
          >
            <Text style={{ fontSize: 13 }}>{icon}</Text>
          </View>
          )}
          <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, fontSize: 15 }]}>
            {value || 'Non défini'}
          </Text>
        </View>
      </View>
    );
  }

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non défini';

  // Display address logic: Manual address > Team address > Club address
  const displayAddress = state.address
    ? (state.address.label || getShortAddress(state.address))
    : getShortAddress(state.team?.club?.address || state.team?.club?.addressDetails);

  return (
    <WizardStepLayout
      isNextLoading={createAdMutation.isPending}
      nextLabel="Créer l'annonce"
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      subtitle="Vérifiez les détails avant de publier"
      title="Tout est bon ?"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Main recap card */}
        <View style={[
          Spaces.padding[24],
          {
            backgroundColor: '#1A1A1A',
            borderColor: Colors.neutral700,
            borderRadius: 24,
            borderWidth: 1,
          },
        ]}
        >
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
          <View style={{ backgroundColor: Colors.neutral700, height: 1, marginBottom: 24 }} />

          {/* Key Info Grid */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
          >
            <GridItem
              icon="⚽"
              label="Sport"
              value={sportName}
            />
            <GridItem
              icon="👥"
              label="Section"
              value={state.section?.name}
            />
            <GridItem
              icon="🏷️"
              label="Catégorie"
              value={state.category?.name}
            />
            <GridItem
              icon="📊"
              label="Niveau"
              value={state.minLevel?.name}
            />
            <GridItem
              icon="📍"
              label="Lieu"
              value={displayAddress}
            />
          </View>

          {/* Positions Section */}
          <View style={{
            backgroundColor: '#252525', // Slightly lighter inner card
            borderRadius: 16,
            marginTop: 8,
            padding: 16,
          }}
          >
            <View style={{
              alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16,
            }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                Postes recherchés
              </Text>
              <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                Total :
                {' '}
                {totalPlayers}
              </Text>
            </View>

            <View style={[Spaces.gap[10]]}>
              {state.positions.map((pos, index) => (
                <View
                  key={index}
                  style={{
                    alignItems: 'center',
                    backgroundColor: '#333333',
                    borderRadius: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00, fontSize: 15 }]}>
                    {pos.name}
                  </Text>
                  <View style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
                      x
                      {pos.quantity}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Event Linked (Optional) */}
          {state.event && (
            <View style={{
              borderTopColor: Colors.neutral700, borderTopWidth: 1, marginTop: 24, paddingTop: 20,
            }}
            >
              <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 12 }}>
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
            <View style={{
              borderTopColor: Colors.neutral700, borderTopWidth: 1, marginTop: 24, paddingTop: 20,
            }}
            >
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
          alignItems: 'center',
          backgroundColor: '#0F292E',
          borderColor: Colors.primary900,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          marginTop: 20,
          padding: 16,
        }}
        >
          <View style={{
            alignItems: 'center',
            backgroundColor: Colors.neutral400,
            borderRadius: 4,
            height: 24,
            justifyContent: 'center',
            marginRight: 12,
            width: 24,
          }}
          >
            <Text style={{ color: Colors.neutral900, fontSize: 14, fontWeight: 'bold' }}>i</Text>
          </View>
          <Text style={[Fonts.p3, { color: Colors.neutral200, flex: 1, lineHeight: 18 }]}>
            L'annonce sera visible par tous les joueurs correspondant à ce profil.
          </Text>
        </View>
      </ScrollView>
    </WizardStepLayout>
  );
}

export default AdWizardRecap;
