import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardDescriptionStepIndex,
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';

/**
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardDescription({ navigation, route }) {
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
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardDescription, state),
      route?.params,
    ));
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleNext}
      showSkip
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardDescriptionStepIndex(state)}
      // ⚠️ CLES NEUVES : `…description.subtitle` et `…description.placeholder`
      // existent deja dans `fr.js` avec l'ancienne copy, et `fr.js` gagne
      // toujours sur le repli. Les modifier compterait comme une SUPPRESSION.
      subtitle={t(
        'eventWizard.steps.description.subtitleShort',
        "Ce que les joueurs liront avant de s'inscrire.",
      )}
      title={t('eventWizard.steps.description.title')}
    >
      <View style={[Spaces.gap[12], Alignments.fill]}>
        {/* Le libelle « Description » au-dessus du champ disparait : il
            repetait mot pour mot le titre de l'etape, a 8 pt au-dessus. */}
        <TextInput
          blurOnSubmit={false}
          multiline
          numberOfLines={6}
          onChangeText={setDescription}
          // L'exemple concret remplace la consigne. Le pack le pose comme sa
          // regle : montrer ce qu'on attend coute moins qu'expliquer.
          placeholder={t(
            'eventWizard.steps.description.placeholderExample',
            'Ex. : viens essayer le foot avec les U15 — prévois une tenue de sport, '
            + "l'essai est gratuit.",
          )}
          placeholderTextColor={Colors.neutral500}
          scrollEnabled
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Fonts.p1,
            fieldSurfaceStyle,
            {
              color: Colors.neutral00,
              maxHeight: 260,
              minHeight: 190,
              textAlignVertical: 'top',
            },
          ]}
          value={description}
        />
        <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
          {t(
            'eventWizard.steps.description.valueHint',
            'Une description claire double les inscriptions sur une détection.',
          )}
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardDescription;
