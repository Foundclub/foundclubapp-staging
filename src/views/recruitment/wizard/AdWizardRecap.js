import { CommonActions } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { getShortAddress } from '@/utils/location';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardRecapStepIndex,
  getAdWizardStepCount,
} from './adWizardStepUtils';

/**
 *
 * @param root0
 * @param root0.Colors
 * @param root0.Fonts
 * @param root0.icon
 * @param root0.label
 * @param root0.value
 */
function GridItem({
  Colors,
  Fonts,
  icon,
  label,
  value,
}) {
  return (
    <View style={{ marginBottom: 24, paddingRight: 8, width: '50%' }}>
      <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
        {label}
      </Text>
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        {icon ? (
          <View style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            height: 24,
            justifyContent: 'center',
            marginRight: 10,
            width: 24,
          }}
          >
            <Text style={{ fontSize: 13 }}>{icon}</Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={[Fonts.p1Bold, {
          color: Colors.neutral00,
          flex: 1,
          fontSize: 15,
        }]}
        >
          {value || 'Non defini'}
        </Text>
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardRecap({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useAdWizard();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createAdMutation = useMutation({
    mutationFn: createRecruitmentAd,
  });

  const totalPlayers = useMemo(
    () => state.positions.reduce((sum, position) => sum + position.quantity, 0),
    [state.positions],
  );

  const displayAddress = state.address
    ? (state.address.label || getShortAddress(state.address))
    : getShortAddress(state.team?.club?.address || state.team?.club?.addressDetails);

  const missingRequiredItems = useMemo(() => {
    const items = [];

    if (!state.team) items.push('une equipe');
    if (!displayAddress) items.push('un lieu');
    if (!state.positions?.length) items.push('au moins un poste');

    return items;
  }, [displayAddress, state.positions, state.team]);

  const isReadyToSubmit = missingRequiredItems.length === 0;

  const resetToHome = () => {
    const parentNavigation = navigation.getParent?.();

    if (parentNavigation?.dispatch) {
      parentNavigation.dispatch(CommonActions.reset({
        index: 0,
        routes: [{ name: RouteNames.HomeTab }],
      }));
      return;
    }

    navigation.navigate(RouteNames.HomeTab);
  };

  const handleSubmit = async () => {
    if (!isReadyToSubmit) {
      Alert.alert('Erreur', 'Le recapitulatif est incomplet.');
      return;
    }

    try {
      setIsSubmitting(true);
      createAdMutation.reset();

      await Promise.all(state.positions.map((position) => {
        const adData = {
          address: state.address || undefined,
          category: state.category?.documentId || state.category?.id,
          description: state.description || undefined,
          event: state.event?.documentId || state.event?.id,
          level: state.minLevel?.documentId || state.minLevel?.id,
          position: position.name,
          quantity: position.quantity,
          section: state.section?.documentId || state.section?.id,
          team: state.team?.documentId || state.team?.id,
          type: state.event ? 'ponctuel' : 'saison',
          validationMode: state.event ? state.validationMode : 'auto',
        };

        if (!adData.team) {
          console.warn('[AdWizardRecap] Missing team ID', state.team);
        }

        return createAdMutation.mutateAsync(adData);
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] }),
        queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] }),
      ]);

      dispatch({ type: 'RESET' });
      resetToHome();
    } catch (error) {
      console.error('[AdWizardRecap] Creation error:', error);
      Alert.alert('Erreur', 'Impossible de creer l annonce. Veuillez reessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non defini';

  return (
    <WizardStepLayout
      isNextDisabled={!isReadyToSubmit || isSubmitting}
      isNextLoading={isSubmitting}
      nextLabel="Creer l'annonce"
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardRecapStepIndex(state)}
      subtitle="Verifiez les details avant de publier"
      title="Tout est bon ?"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!isReadyToSubmit ? (
          <View style={[Spaces.marginBottom[20], Spaces.padding[16], {
            backgroundColor: '#2A1A1A',
            borderColor: Colors.error500,
            borderRadius: 16,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
              Resume incomplet
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
              Il manque encore
              {' '}
              {missingRequiredItems.join(', ')}
              {' '}
              avant de publier cette annonce.
            </Text>
          </View>
        ) : null}

        {createAdMutation.isError ? (
          <View style={[Spaces.marginBottom[20], Spaces.padding[16], {
            backgroundColor: '#2A1A1A',
            borderColor: Colors.error500,
            borderRadius: 16,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
              Publication impossible
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
              {createAdMutation.error?.message || 'La creation de l annonce a echoue. Verifiez les informations puis reessayez.'}
            </Text>
          </View>
        ) : null}

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
          <View style={{ marginBottom: 24 }}>
            <Text style={[Fonts.p3, { color: Colors.primary500, marginBottom: 4 }]}>
              Equipe qui recrute
            </Text>
            <Text style={[Fonts.h2, { color: Colors.neutral00, fontSize: 22, fontWeight: '700' }]}>
              {state.team?.name || 'Non definie'}
            </Text>
            {state.team?.club?.name ? (
              <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 4 }]}>
                {state.team.club.name}
              </Text>
            ) : null}
          </View>

          <View style={{ backgroundColor: Colors.neutral700, height: 1, marginBottom: 24 }} />

          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
          >
            <GridItem
              Colors={Colors}
              Fonts={Fonts}
              icon="S"
              label="Sport"
              value={sportName}
            />
            <GridItem
              Colors={Colors}
              Fonts={Fonts}
              icon="Se"
              label="Section"
              value={state.section?.name}
            />
            <GridItem
              Colors={Colors}
              Fonts={Fonts}
              icon="C"
              label="Categorie"
              value={state.category?.name}
            />
            <GridItem
              Colors={Colors}
              Fonts={Fonts}
              icon="N"
              label="Niveau"
              value={state.minLevel?.name}
            />
            <GridItem
              Colors={Colors}
              Fonts={Fonts}
              icon="L"
              label="Lieu"
              value={displayAddress}
            />
          </View>

          <View style={{
            backgroundColor: '#252525',
            borderRadius: 16,
            marginTop: 8,
            padding: 16,
          }}
          >
            <View style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                Postes recherches
              </Text>
              <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                Total :
                {' '}
                {totalPlayers}
              </Text>
            </View>

            <View style={[Spaces.gap[10]]}>
              {state.positions.map((position) => (
                <View
                  key={`${position.name}-${position.quantity}`}
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
                    {position.name}
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
                      {position.quantity}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {state.event ? (
            <View style={{
              borderTopColor: Colors.neutral700,
              borderTopWidth: 1,
              marginTop: 24,
              paddingTop: 20,
            }}
            >
              <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>i</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                  Lie a l evenement
                </Text>
              </View>
              <Text style={[Fonts.h4, { color: Colors.neutral00, marginLeft: 30 }]}>
                {state.event.name || state.event.type?.name || 'Evenement'}
              </Text>
            </View>
          ) : null}

          {state.description ? (
            <View style={{
              borderTopColor: Colors.neutral700,
              borderTopWidth: 1,
              marginTop: 24,
              paddingTop: 20,
            }}
            >
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 8 }]}>
                Description
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200, lineHeight: 22 }]}>
                {state.description}
              </Text>
            </View>
          ) : null}
        </View>

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
            L'annonce sera visible par tous les joueurs correspondant a ce profil.
          </Text>
        </View>
      </ScrollView>
    </WizardStepLayout>
  );
}

export default AdWizardRecap;
