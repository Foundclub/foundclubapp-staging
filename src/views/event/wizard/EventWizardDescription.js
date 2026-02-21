import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const EventWizardDescription = ({ navigation }) => {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();
  const [description, setDescription] = useState(state.description || '');
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
  };

  const handleNext = () => {
    dispatch({
      type: 'SET_META',
      payload: { description },
    });
    navigation.navigate(RouteNames.EventWizardVisibility);
  };

  return (
    <WizardStepLayout
      stepCount={10}
      stepIndex={7}
      title={t('eventWizard.steps.description.title')}
      subtitle={t('eventWizard.steps.description.subtitle')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleNext}
      showSkip
    >
      <View style={[Spaces.gap[16], Alignments.fill]}>
        <View style={[Alignments.fill]}>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>
            {t('eventWizard.steps.description.label')}
          </Text>
          <TextInput
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Fonts.p1,
              fieldSurfaceStyle,
              {
                color: Colors.neutral00,
                minHeight: 150,
                textAlignVertical: 'top',
              },
            ]}
            placeholder={t('eventWizard.steps.description.placeholder')}
            placeholderTextColor={Colors.neutral500}
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
          />
        </View>
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardDescription;
