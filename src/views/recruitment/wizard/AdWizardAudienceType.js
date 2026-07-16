import {
  useEffect,
} from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import SubscriptionQuotaBanner from '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';

function AudienceCard({
  description,
  isSelected,
  onPress,
  title,
}) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        ApplicationStyle.card,
        Spaces.padding[24],
        Spaces.gap[16],
        {
          backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.12)' : 'rgba(4, 31, 44, 0.82)',
          borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
        },
      ]}
    >
      <Text style={[Fonts.h4, isSelected ? Fonts.primary500 : Fonts.neutral00]}>{title}</Text>
      <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>{description}</Text>
    </TouchableOpacity>
  );
}

/**
 * @param {{ navigation: any; route: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardAudienceType({ navigation, route }) {
  const { Fonts, Spaces } = useTheme();
  const { dispatch, state } = useAdWizard();
  const hasDetectionEvent = Boolean(route?.params?.event);

  useEffect(() => {
    if (!route?.params?.event) return;

    dispatch({ payload: 'player', type: 'SET_AUDIENCE_TYPE' });
    dispatch({ payload: route.params.event, type: 'SET_EVENT' });
    navigation.replace(RouteNames.AdWizardTeam, route.params);
  }, [dispatch, navigation, route.params]);

  const handleSelect = (audienceType) => {
    dispatch({ payload: audienceType, type: 'SET_AUDIENCE_TYPE' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardTeam, route?.params);
  };

  if (hasDetectionEvent) {
    return null;
  }

  return (
    <WizardStepLayout
      isNextDisabled={!state?.audienceType}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={1}
      subtitle="Choisissez si vous publiez une annonce pour recruter des joueurs ou un entraineur."
      title="Type d'annonce"
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[32]]}>
        <SubscriptionQuotaBanner label="Annonces" quotaType="RECRUITMENT_AD_PUBLISH" />

        <AudienceCard
          description="Publiez une annonce par poste recherche, avec le volume de recrutement et les informations sportives de l&rsquo;equipe."
          isSelected={state.audienceType === 'player'}
          onPress={() => handleSelect('player')}
          title="Je recrute des joueurs"
        />

        <AudienceCard
          description="Publiez une annonce dediee a un role d'encadrement: entraineur principal, adjoint, preparateur physique ou autre besoin staff."
          isSelected={state.audienceType === 'coach'}
          onPress={() => handleSelect('coach')}
          title="Je recrute un entraineur"
        />

        <View style={[Spaces.paddingHorizontal[4], Spaces.marginTop[12]]}>
          <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 22 }]}>
            Le tunnel adapte ensuite automatiquement les etapes, les libelles et l&rsquo;affichage final de l&rsquo;annonce.
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardAudienceType;
