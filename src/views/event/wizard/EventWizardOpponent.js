import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { OPPONENT_NAME_MAX_LENGTH } from '@/domains/event/eventDisplayName';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardOpponentStepIndex,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';

/**
 * Y02 — L'ETAPE « CONTRE QUI ? », et elle n'existe QUE pour un match.
 *
 * 🎯 Adel, le 2026-08-19 : « si on ajoute manuellement un evenement match, on
 * rajoute une etape : on demande le nom de l'equipe adverse ».
 *
 * ⛔ C'EST UN CHAMP LIBRE, PAS UNE LISTE. L'adversaire n'est presque jamais dans
 * FoundClub — 7 clubs sur 222 294 ont une equipe (mesure du 2026-08-13).
 * Obliger a choisir une equipe existante fermerait l'etape a presque tout le
 * monde.
 *
 * ✅ ELLE SE SAUTE. On ne connait pas toujours son adversaire a la creation, et
 * le tunnel a deja paye deux fois le defaut du cul-de-sac : « Passer » et
 * « Suivant » menent au meme endroit, et un champ vide n'empeche jamais rien.
 * L'adversaire se rajoute plus tard depuis la fiche.
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardOpponent({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [opponentName, setOpponentName] = useState(state.opponentName || '');
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
  };

  const goNext = (valeur) => {
    dispatch({
      payload: { opponentName: valeur },
      type: 'SET_META',
    });
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardOpponent, state),
      route?.params,
    ));
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      onBack={() => navigation.goBack()}
      onNext={() => goNext(opponentName)}
      // « Passer » n'efface pas ce qui a deja ete saisi a un passage precedent :
      // il avance, c'est tout. Effacer serait une surprise, pas un raccourci.
      onSkip={() => goNext(opponentName)}
      showSkip
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardOpponentStepIndex(state)}
      subtitle={t(
        'eventWizard.steps.opponent.subtitle',
        "Le match s'appellera « Match vs » suivi de ce nom.",
      )}
      title={t('eventWizard.steps.opponent.title', 'Contre qui ?')}
    >
      <View style={[Spaces.gap[12], Alignments.fill]}>
        <TextInput
          autoCapitalize="words"
          maxLength={OPPONENT_NAME_MAX_LENGTH}
          onChangeText={setOpponentName}
          placeholder={t(
            'eventWizard.steps.opponent.placeholder',
            'Ex. : US Blaisoise U15',
          )}
          placeholderTextColor={Colors.neutral500}
          style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Fonts.p1,
            fieldSurfaceStyle,
            { color: Colors.neutral00 },
          ]}
          value={opponentName}
        />
        <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
          {t(
            'eventWizard.steps.opponent.hint',
            'Tu ne le connais pas encore ? Passe cette étape, tu pourras l’ajouter plus tard.',
          )}
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardOpponent;
