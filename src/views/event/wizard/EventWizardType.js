import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import SubscriptionQuotaBanner from '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTypes } from '@/services/event/eventQueries';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardNextRoute,
  getEventWizardStepCount,
  normalizeTypeLabel,
} from './eventWizardDetectionUtils';

/**
 * La ligne de description de chaque type, indexee sur le nom NORMALISE que rend
 * le serveur (`admin/src/data/event-types.json`).
 *
 * ⛔ Ce n'est PAS une table de renommage : la cle est le nom enregistre, le
 * libelle affiche reste celui du serveur. Un type inconnu de cette table
 * s'affiche sans description plutot que de disparaitre.
 * @type {Record<string, string>}
 */
const DESCRIPTIONS_PAR_TYPE = {
  autre: 'Réunion, sortie, animation du club…',
  detection: 'Ouvre ton équipe à de nouveaux joueurs',
  entrainement: 'Séance classique pour ton équipe',
  match: 'Rencontre de championnat ou de coupe',
  reservation: "Bloque un créneau d'installation",
  stage: 'Plusieurs séances sur plusieurs jours',
  tournoi: 'Plusieurs équipes sur une ou plusieurs journées',
};

/** La rangee « Match amical » : une PORTE vers le tunnel League, pas un type. */
const CLE_MATCH_AMICAL = 'porte-match-amical';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function EventWizardType({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  const {
    data: eventTypes,
    error,
    isLoading,
    refetch,
  } = useGetEventTypes();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const handleSelectType = (type) => {
    dispatch({ payload: type, type: 'SET_TYPE' });
    // Le type vient d'etre choisi : c'est lui qui decide de la suite du
    // parcours, on interroge donc la chaine sur l'etat PROJETE.
    navigation.navigate(getEventWizardNextRoute(RouteNames.EventWizardType, { ...state, type }));
  };

  // Decision d'Adel du 2026-08-06 : « Match amical » n'est pas un type
  // d'evenement, c'est une SORTIE. On quitte le tunnel Evenement pour entrer
  // dans le tunnel amical, qui a son propre etat et ses 7 etapes.
  //
  // `navigate` et non `replace` : la pile garde `EventStack` en dessous, donc
  // ① le brouillon d'evenement en cours n'est pas perdu ② le « Retour » de la
  // 1re etape amicale (`FriendlyMatchWizardTeam.js:91`, un simple `goBack`)
  // ramene ICI. Un aller sans retour serait un piege ; le filet le fige.
  const handleOpenFriendlyMatchWizard = () => {
    navigation.navigate(RouteNames.FriendlyMatchWizardStack, {
      screen: RouteNames.FriendlyMatchWizardTeam,
    });
  };

  const hasTypes = Array.isArray(eventTypes) && eventTypes.length > 0;

  /**
   * Les rangees affichees : les types du serveur, plus la porte « Match amical »
   * glissee juste apres « Match » — c'est la paire officiel / amical du pack de
   * design. Sans type « Match », la porte se pose en fin de liste.
   * @returns {any[]} Les rangees, dans l'ordre d'affichage.
   */
  const buildRows = () => {
    const rows = [];
    (eventTypes || []).forEach((type) => {
      const normalized = normalizeTypeLabel(type?.name);
      rows.push({
        description: DESCRIPTIONS_PAR_TYPE[normalized] || '',
        // Le pack grise « Reservation » : la capacite existe cote serveur, mais
        // elle n'est pas ouverte au public. Le code de reservation de l'etape 3
        // n'est pas supprime, seule cette porte est fermee.
        disabled: normalized.includes('reservation'),
        key: type?.documentId || normalized,
        onPress: () => handleSelectType(type),
        selected: Boolean(
          state?.type?.documentId && state.type.documentId === type?.documentId,
        ),
        tag: normalized.includes('reservation')
          ? t('eventWizard.steps.type.comingSoonTag', 'Bientôt disponible')
          : '',
        title: type?.name,
      });
      if (normalized === 'match') {
        rows.push({
          description: t(
            'eventWizard.steps.type.friendlyMatchDescription',
            "Trouve un adversaire — ouvre l'annonce League",
          ),
          disabled: false,
          key: CLE_MATCH_AMICAL,
          onPress: handleOpenFriendlyMatchWizard,
          selected: false,
          tag: '',
          title: t('eventWizard.steps.type.friendlyMatchTitle', 'Match amical'),
        });
      }
    });

    if (rows.length > 0 && !rows.some((row) => row.key === CLE_MATCH_AMICAL)) {
      rows.push({
        description: t(
          'eventWizard.steps.type.friendlyMatchDescription',
          "Trouve un adversaire — ouvre l'annonce League",
        ),
        disabled: false,
        key: CLE_MATCH_AMICAL,
        onPress: handleOpenFriendlyMatchWizard,
        selected: false,
        tag: '',
        title: t('eventWizard.steps.type.friendlyMatchTitle', 'Match amical'),
      });
    }

    return rows;
  };

  /**
   * Une rangee de choix : titre, description sur une ligne, marqueur de
   * selection. Une rangee grisee ne porte ni marqueur ni action.
   * @param {any} row Rangee construite par `buildRows`.
   * @returns {import('react').ReactElement} La rangee.
   */
  const renderRow = (row) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: row.disabled, selected: row.selected }}
      activeOpacity={0.85}
      disabled={row.disabled}
      key={row.key}
      onPress={row.disabled ? undefined : row.onPress}
      style={[
        ApplicationStyle.card,
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[12],
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: row.selected
            ? withAlpha(Colors.primary500, 0.07)
            : cardSurfaceStyle.backgroundColor,
          borderColor: row.selected ? Colors.primary500 : cardSurfaceStyle.borderColor,
          borderRadius: 16,
          borderWidth: 1.5,
          columnGap: 12,
          minHeight: 64,
          opacity: row.disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[Alignments.fill]}>
        <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>{row.title}</Text>
          {row.tag ? (
            <View
              style={[
                Spaces.paddingHorizontal[8],
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.08),
                  borderColor: withAlpha(Colors.neutral00, 0.18),
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingVertical: 2,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.5 }]}>
                {row.tag}
              </Text>
            </View>
          ) : null}
        </View>
        {row.description ? (
          <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4], { lineHeight: 17 }]}>
            {row.description}
          </Text>
        ) : null}
      </View>
      {row.disabled ? null : (
        <View
          style={{
            alignItems: 'center',
            borderColor: row.selected ? Colors.primary500 : withAlpha(Colors.neutral00, 0.35),
            borderRadius: 999,
            borderWidth: 2,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          {row.selected ? (
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                height: 12,
                width: 12,
              }}
            />
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.EVENT_WIZARD_TYPE}
      userId={userData?.documentId}
    >
      <WizardStepLayout
        headerVariant="focus"
        onBack={() => navigation.goBack()}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={1}
        subtitle={t(
          'eventWizard.steps.type.focusSubtitle',
          'Un seul choix — il adapte les étapes suivantes.',
        )}
        title={t('eventWizard.steps.type.title')}
      >
        {/* L40 — si la personne part d'ici acheter, elle revient ICI. */}
        <SubscriptionQuotaBanner
          label="Evenements"
          quotaType="EVENT_PUBLISH"
          resumeRouteName={RouteNames.EventStack}
          resumeRouteParams={{ screen: RouteNames.EventWizardType }}
        />

        {isLoading ? (
          <ActivityIndicator color={Colors.primary500} size="large" />
        ) : null}

        {!isLoading && error ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[12], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100]}>
              {error?.message || t('eventWizard.errors.genericLoad', 'Impossible de charger cette étape.')}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                {
                  alignSelf: 'flex-start',
                  backgroundColor: withAlpha(Colors.primary500, 0.16),
                  borderColor: Colors.primary500,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>Recharger</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isLoading && !error && !hasTypes ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100]}>
              {t('eventWizard.errors.noTypes')}
            </Text>
          </View>
        ) : null}

        {!isLoading && !error && hasTypes ? (
          <OnboardingWrapper
            description="Choisis le type d événement avant de continuer le wizard."
            id="event-wizard-type-list"
            order={1}
            spotlight={{
              borderRadius: 16,
              maxHeight: 280,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            title="Sélection du type"
          >
            <View style={[Spaces.gap[8]]}>
              {buildRows().map(renderRow)}
            </View>
          </OnboardingWrapper>
        ) : null}
      </WizardStepLayout>
    </TutorialFlowBoundary>
  );
}

export default EventWizardType;
