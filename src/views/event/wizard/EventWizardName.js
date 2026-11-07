import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import {
  EVENT_CUSTOM_NAME_MAX_LENGTH,
  isEventCustomNameValid,
  normalizeEventCustomName,
} from '@/domains/event/eventDisplayName';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardNameStepIndex,
  getEventWizardNextRoute,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';

/**
 * EVT-AUTRE-NOM (07/11) — « QUEL EST LE NOM DE VOTRE EVENEMENT ? »
 *
 * 🎯 Demande d'Adel : apres la tuile « Autre », l'etape suivante demande un nom,
 * et l'evenement s'affiche ensuite sous ce nom. La tuile reste : le TYPE sert
 * aux filtres, icones, statistiques et quotas ; le nom ne fait que l'habiller.
 *
 * ⛔ Obligatoire, donc sans « Passer » : 3 a 60 caracteres une fois les blancs
 * retires. Le serveur refuse aussi une longueur hors bornes, mais accepte un
 * « Autre » sans nom (les anciennes versions de l'app n'envoient rien).
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardName({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [customName, setCustomName] = useState(state.customName || '');
  const nomNettoye = normalizeEventCustomName(customName);
  const estValide = isEventCustomNameValid(customName);
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
  };

  const handleNext = () => {
    if (!estValide) return;
    dispatch({ payload: { customName: nomNettoye }, type: 'SET_META' });
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardName, state),
      route?.params,
    ));
  };

  const title = t('eventWizard.steps.name.title', 'Quel est le nom de votre événement ?');
  const hint = t('eventWizard.steps.name.hint', 'De 3 à 60 caractères.');

  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextDisabled={!estValide}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardNameStepIndex(state)}
      subtitle={t(
        'eventWizard.steps.name.subtitle',
        'Il s’affichera à la place de « Autre » sur le planning, la fiche et les messages.',
      )}
      title={title}
    >
      <View style={[Spaces.gap[12], Alignments.fill]}>
        <TextInput
          accessibilityHint={hint}
          accessibilityLabel={title}
          autoCapitalize="sentences"
          autoFocus
          // ui-ux-pro-max (keyboard) : un nom encore trop court garde le clavier ouvert.
          blurOnSubmit={estValide}
          maxLength={EVENT_CUSTOM_NAME_MAX_LENGTH}
          onChangeText={setCustomName}
          onSubmitEditing={handleNext}
          placeholder={t('eventWizard.steps.name.placeholder', 'Ex. Repas de fin de saison')}
          placeholderTextColor={Colors.neutral500}
          returnKeyType="next"
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Fonts.p1,
            fieldSurfaceStyle,
            { color: Colors.neutral00, minHeight: 56 },
          ]}
          testID="event-wizard-name-input"
          value={customName}
        />
        <View style={[Alignments.row, Alignments.justifyBetween]}>
          <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
            {hint}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}
          >
            {t('eventWizard.steps.name.counter', {
              count: nomNettoye.length,
              defaultValue: '{{count}}/{{max}}',
              max: EVENT_CUSTOM_NAME_MAX_LENGTH,
            })}
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardName;
