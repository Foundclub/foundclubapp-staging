import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { resolveLocationDisplayLabel } from '@/utils/facilityAddressLabel';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardDescriptionStepIndex,
  getAdWizardStepCount,
} from './adWizardStepUtils';

/**
 * Wizard step for the optional copy.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();
  const isCoachAd = state?.audienceType === 'coach';

  const handleChange = (text) => {
    dispatch({ payload: text.slice(0, 500), type: 'SET_DESCRIPTION' });
  };

  const handleMissionsChange = (text) => {
    dispatch({ payload: text.slice(0, 500), type: 'SET_MISSIONS' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const handleSkip = () => {
    dispatch({ payload: '', type: 'SET_DESCRIPTION' });
    if (isCoachAd) {
      dispatch({ payload: '', type: 'SET_MISSIONS' });
    }
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };
  const locationHighlight = resolveLocationDisplayLabel(state.address);
  const contextualHighlights = [
    state.team?.name ? t(
      'adWizardDescription.context.team',
      'Équipe : {{team}}',
      { team: state.team.name, ...SANS_ECHAPPEMENT },
    ) : null,
    state.positions.length > 0
      ? t('adWizardDescription.context.positions', {
        count: state.positions.length,
        defaultValue_one: '{{count}} poste sélectionné',
        defaultValue_other: '{{count}} postes sélectionnés',
      })
      : null,
    isCoachAd && state.coachRole ? t(
      'adWizardDescription.context.role',
      'Rôle : {{role}}',
      { role: state.coachRoleOther || state.coachRole, ...SANS_ECHAPPEMENT },
    ) : null,
    locationHighlight ? t(
      'adWizardDescription.context.location',
      'Lieu : {{location}}',
      { location: locationHighlight, ...SANS_ECHAPPEMENT },
    ) : null,
  ].filter(Boolean);
  const descriptionTips = isCoachAd
    ? [
      t(
        'adWizardDescription.tips.coach1',
        'Précise le projet sportif et la place du rôle dans le staff.',
      ),
      t(
        'adWizardDescription.tips.coach2',
        'Indique le rythme attendu des entraînements et des matchs.',
      ),
      t(
        'adWizardDescription.tips.coach3',
        'Explique le cadre de mission et les responsabilités principales.',
      ),
      t(
        'adWizardDescription.tips.coach4',
        'Mentionne les qualites humaines ou diplomes qui feront la difference.',
      ),
    ]
    : [
      t('adWizardDescription.tips.players1', "Précise l'intensité ou le niveau de jeu attendu."),
      t(
        'adWizardDescription.tips.players2',
        'Indique les horaires et le rythme des entraînements.',
      ),
      t(
        'adWizardDescription.tips.players3',
        "Mentionne si une séance d'essai ou une détection est prévue.",
      ),
      t('adWizardDescription.tips.players4', "Décris l'ambiance et le projet sportif de l'équipe."),
    ];

  return (
    <WizardStepLayout
      nextLabel={t('adWizardDescription.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardDescriptionStepIndex(state)}
      subtitle={isCoachAd
        ? t(
          'adWizardDescription.subtitleCoach',
          'Ajoute une presentation du besoin et les missions pour attirer les bons profils coach.',
        )
        : t(
          'adWizardDescription.subtitle',
          'Ajoute quelques détails pour rendre ton annonce plus claire et plus attractive.',
        )}
      title={isCoachAd ? t(
        'adWizardDescription.titleCoach',
        'Description et missions',
      ) : t('adWizardDescription.title', 'Description')}
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[32]]}>
        {contextualHighlights.length > 0 ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[16], cardSurfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('adWizardDescription.context.title', "Contexte de l'annonce")}
            </Text>
            <View style={[Spaces.gap[12]]}>
              {contextualHighlights.map((highlight) => (
                <Text key={highlight} style={[Fonts.p2, Fonts.neutral100]}>
                  {highlight}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], cardSurfaceStyle]}>
          <View
            style={[
              Alignments.row,
              Alignments.justifySpaceBetween,
              Spaces.gap[16],
              { alignItems: 'flex-start', flexWrap: 'wrap' },
            ]}
          >
            <View style={[Spaces.gap[12], { flex: 1 }]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('adWizardDescription.need.title', 'Présente ton besoin')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
                {isCoachAd
                  ? t(
                    'adWizardDescription.need.bodyCoach',
                    'Quelques lignes suffisent pour expliquer le contexte et donner envie aux bons profils coach de candidater.', // eslint-disable-line max-len
                  )
                  : t(
                    'adWizardDescription.need.body',
                    'Quelques lignes suffisent pour donner envie aux bons profils de candidater.',
                  )}
              </Text>
            </View>

            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                {t('adWizardDescription.need.optional', 'Optionnel')}
              </Text>
            </View>
          </View>

          <TextInput
            multiline
            numberOfLines={7}
            onChangeText={handleChange}
            placeholder={isCoachAd
              ? t(
                'adWizardDescription.need.placeholderCoach',
                'Ex. Nous recherchons un entraîneur adjoint pour accompagner notre groupe senior régional. Projet formateur, équipe staff engagee, rythme de deux séances par semaine.', // eslint-disable-line max-len
              )
              : t(
                'adWizardDescription.need.placeholder',
                'Ex. Nous recherchons un gardien expérimenté pour notre équipe U20 qui evolue en régional. Entraînements les mardis et jeudis soir, ambiance serieuse et bienveillante.', // eslint-disable-line max-len
              )}
            placeholderTextColor={Colors.neutral500}
            style={[
              Fonts.p1,
              styles.input,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: state.description.length > 0 ? Colors.primary500 : 'rgba(1, 179, 244, 0.18)',
                color: Colors.neutral00,
              },
            ]}
            textAlignVertical="top"
            value={state.description}
          />

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {state.description.length > 0
                ? t('adWizardDescription.need.ready', 'Ta description est prête à être publiée.')
                : t(
                  'adWizardDescription.need.canSkip',
                  'Tu peux aussi continuer sans description.',
                )}
            </Text>
            <Text
              style={[
                Fonts.p3Bold,
                state.description.length >= 450 ? Fonts.primary100 : Fonts.neutral300,
              ]}
            >
              {state.description.length}
              {' '}
              / 500
            </Text>
          </View>
        </View>

        {isCoachAd ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], cardSurfaceStyle]}>
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>
                {t('adWizardDescription.missions.title', 'Missions principales')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
                {t(
                  'adWizardDescription.missions.body',
                  'Décris ce que tu attends concretement du futur entraîneur.',
                )}
              </Text>
            </View>

            <TextInput
              multiline
              numberOfLines={6}
              onChangeText={handleMissionsChange}
              placeholder={t(
                'adWizardDescription.missions.placeholder',
                'Ex. Préparation des séances, accompagnement le week-end, lien avec les joueurs et coordination avec le reste du staff.', // eslint-disable-line max-len
              )}
              placeholderTextColor={Colors.neutral500}
              style={[
                Fonts.p1,
                styles.input,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: state.missions.length > 0 ? Colors.primary500 : 'rgba(1, 179, 244, 0.18)',
                  color: Colors.neutral00,
                },
              ]}
              textAlignVertical="top"
              value={state.missions}
            />
          </View>
        ) : null}

        <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[16], cardSurfaceStyle]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('adWizardDescription.tips.title', 'Idées à inclure')}
          </Text>
          <View style={[Spaces.gap[16]]}>
            {descriptionTips.map((tip) => (
              <View key={tip} style={[Alignments.row, Spaces.gap[16]]}>
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 999,
                    height: 8,
                    marginTop: 8,
                    width: 8,
                  }}
                />
                <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 18,
    borderWidth: 1,
    lineHeight: 22,
    minHeight: 170,
    padding: 24,
  },
});

export default AdWizardDescription;
