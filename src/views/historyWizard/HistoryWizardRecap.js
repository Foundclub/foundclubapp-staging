import {
  Alert,
  Image,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from '@/views/historyWizard/HistoryWizardContext';

import { RouteNames } from '@/navigation/routeNames';

import { useCreateHistory, useUpdateHistory } from '@/services/userHistory/userHistoryQueries';

// imports statiques (pas require) : require n'existe pas sur le rendu web ESM.
import calendarIcon from '@/assets/icons/calendar.png';

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function HistoryWizardRecap({ navigation }) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const { dispatch, state } = useHistoryWizard();

  const createHistoryMutation = useCreateHistory();
  const updateHistoryMutation = useUpdateHistory();

  const isEditing = Boolean(state.editingEntry);
  const isLoading = createHistoryMutation.isPending || updateHistoryMutation.isPending;

  const getClubName = () => {
    if (state.club?.name) return state.club.name;
    if (state.multisportClub?.name) return state.multisportClub.name;
    if (state.customClubName) return state.customClubName;
    return 'Club non défini';
  };

  const getPeriodText = () => {
    if (state.isCurrentlyActive) {
      return `${state.startYear} - Aujourd hui`;
    }

    if (state.startYear === state.endYear) {
      return `${state.startYear}`;
    }

    return `${state.startYear} - ${state.endYear}`;
  };

  const buildPayloads = () => {
    const basePayload = {
      club: state.club?.documentId || null,
      customClubName: state.useCustomClub ? state.customClubName : null,
      endYear: state.isCurrentlyActive ? null : state.endYear,
      isCurrentlyActive: state.isCurrentlyActive,
      level: state.level?.documentId || null,
      multisport_club: state.multisportClub?.documentId || null,
      startYear: state.startYear,
    };

    const categoryIds = state.categories
      .map((category) => category?.documentId)
      .filter(Boolean);

    if (isEditing) {
      return [{
        ...basePayload,
        category: categoryIds[0] || null,
      }];
    }

    if (categoryIds.length === 0) {
      return [{
        ...basePayload,
        category: null,
      }];
    }

    return categoryIds.map((categoryId) => ({
      ...basePayload,
      category: categoryId,
    }));
  };

  const handleSuccess = () => {
    dispatch({ type: 'RESET' });

    if (state.returnRoute) {
      navigation.navigate(state.returnRoute);
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: RouteNames.Profile }],
    });
  };

  const handleSubmit = async () => {
    const payloads = buildPayloads();

    try {
      if (isEditing) {
        await updateHistoryMutation.mutateAsync({
          data: payloads[0],
          id: state.editingEntry.documentId,
        });
      } else {
        await payloads.reduce(
          (promise, payload) => promise.then(() => createHistoryMutation.mutateAsync(payload)),
          Promise.resolve(),
        );
      }

      handleSuccess();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer cette expérience pour le moment.');
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
        <View
          style={{
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
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
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
              {/* L14 : logo reel s'il existe, sinon l'ECUSSON aux initiales du
                  club — l'icone generique teintee ne disait rien du club. */}
              <ClubLogoMark
                club={state.club || state.multisportClub}
                name={getClubName()}
                size={56}
              />
            </View>
          </View>

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

          <View
            style={{
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            {state.categories.map((category) => (
              <View
                key={category.documentId || category.name}
                style={{
                  backgroundColor: Colors.primary500,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text style={[Fonts.p2Bold, { color: '#FFFFFF' }]}>{category.name}</Text>
              </View>
            ))}
            {state.level ? (
              <View
                style={{
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
            ) : null}
          </View>

          <View
            style={{
              alignItems: 'center',
              backgroundColor: Colors.neutral900,
              borderRadius: 12,
              justifyContent: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Image
              source={calendarIcon}
              style={{
                height: 18,
                marginRight: 8,
                tintColor: Colors.primary500,
                width: 18,
              }}
            />
            <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
              {getPeriodText()}
            </Text>
            {state.isCurrentlyActive ? (
              <View
                style={{
                  backgroundColor: '#10B981',
                  borderRadius: 10,
                  marginLeft: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text style={[Fonts.p3, { color: '#FFFFFF', fontWeight: 'bold' }]}>ACTIF</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: Colors.neutral800,
            borderColor: '#F59E0B40',
            borderRadius: 16,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <View style={{ alignItems: 'flex-start', flexDirection: 'row' }}>
            <Text style={{ fontSize: 20, marginRight: 12 }}>!</Text>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, { color: '#F59E0B', marginBottom: 4 }]}>
                Déclaration sur l&apos;honneur
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
