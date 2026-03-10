import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardDescription({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [description, setDescription] = useState(state.description || '');
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
  };

  const handleNext = () => {
    dispatch({
      payload: { description },
      type: 'SET_META',
    });
    navigation.navigate(RouteNames.EventWizardRecap);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleNext}
      showSkip
      stepCount={10}
      stepIndex={9}
      subtitle={t('eventWizard.steps.description.subtitle')}
      title={t('eventWizard.steps.description.title')}
    >
      <View style={[Spaces.gap[16], Alignments.fill]}>
        <View style={[Alignments.fill]}>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>
            {t('eventWizard.steps.description.label')}
          </Text>
          <TextInput
            multiline
            numberOfLines={6}
            onChangeText={setDescription}
            placeholder={t('eventWizard.steps.description.placeholder')}
            placeholderTextColor={Colors.neutral500}
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
            value={description}
          />
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardDescription;
