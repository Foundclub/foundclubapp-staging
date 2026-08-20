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
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardStepCount,
  normalizeTypeLabel,
} from './eventWizardDetectionUtils';

/**
 * La ligne de description de chaque type, indexee sur un MOTIF contenu dans le
 * nom normalise que rend le serveur (`admin/src/data/event-types.json`).
 *
 * ⛔ Ce n'est PAS une table de renommage : le libelle affiche reste celui du
 * serveur. Un type qui ne contient aucun de ces motifs s'affiche sans
 * description plutot que de disparaitre.
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

/**
 * La description d'un type, lue par CONTENANCE et non par egalite stricte.
 *
 * 🧨 C'est ici qu'etait le defaut trouve a la recette du 2026-08-07 : le serveur
 * sert « Détection / Séance d'essai », que `normalizeTypeLabel` rend
 * « detection / seance d'essai ». La lecture par cle exacte
 * (`DESCRIPTIONS_PAR_TYPE[normalise]`) rendait donc `undefined`, et le repli
 * `|| ''` affichait une rangee NUE — sans erreur, sans trace. Les six autres
 * types, dont le nom normalise valait exactement leur cle, s'affichaient bien :
 * c'est ce qui rendait le trou invisible.
 *
 * La contenance n'est pas un choix neuf : c'est deja ainsi que tout le tunnel
 * reconnait un type (`isDetectionEventType` et ses trois soeurs, dans
 * `eventWizardDetectionUtils.js`, et le grisage de « Reservation » plus bas).
 * @param {string} normalized Nom du type, deja passe par `normalizeTypeLabel`.
 * @returns {string} La description, ou une chaine vide si aucun motif ne colle.
 */
const getTypeDescription = (normalized) => {
  const motif = Object.keys(DESCRIPTIONS_PAR_TYPE).find((cle) => normalized.includes(cle));
  return motif ? DESCRIPTIONS_PAR_TYPE[motif] : '';
};

/** La rangee « Match amical » : une PORTE vers le tunnel League, pas un type. */
const CLE_MATCH_AMICAL = 'porte-match-amical';

/**
 * LE TYPE SERVEUR HOMONYME DE LA PORTE — masque depuis AA10 (constat ① d'Adel
 * du 2026-08-20 : « il y a deux "Match amical", il faut garder celui des
 * annonces »).
 *
 * 🎯 D'OU VIENT CE DOUBLON, exactement. Il n'est PAS au catalogue : les sept
 * types semes au demarrage (`admin/src/data/event-types.json`) sont Detection,
 * Entrainement, Stage, Tournoi, Match, Autre, Reservation. Celui-ci est
 * FABRIQUE PAR LE SERVEUR, a la volee, la premiere fois qu'une annonce d'amical
 * est acceptee — `resolveEventType`
 * (`admin/src/api/friendly-match-ad/services/friendly-match-workflow.ts:144`)
 * cherche un type nomme « Match amical » et le CREE s'il n'existe pas. C'est
 * une ETIQUETTE de rangement, jamais un choix a proposer.
 *
 * 🧨 Et sa description etait fausse par accident : « match amical » CONTIENT
 * « match », et `getTypeDescription` lit par contenance — la rangee heritait
 * donc de « Rencontre de championnat ou de coupe ». C'est ce que montre la
 * capture d'Adel.
 *
 * ⛔ POURQUOI ON MASQUE PLUTOT QUE DE SUPPRIMER COTE SERVEUR — et ce n'est pas
 * de la prudence, c'est mesure :
 *   1. Les evenements deja crees par une annonce acceptee POINTENT sur ce type.
 *      Le supprimer les priverait de leur nom de type.
 *   2. Il reviendrait tout seul : `resolveEventType` le recree a la premiere
 *      annonce acceptee suivante, et le demarrage
 *      (`admin/src/bootstrap/maintenance.js:764`) n'efface jamais un type.
 * ⇒ Masquer la RANGEE ne retire donc rien a personne : le type existe toujours,
 * les evenements gardent leur nom, seule la porte de creation se ferme.
 *
 * ⚠️ Egalite STRICTE, pas contenance : on ferme exactement cette rangee-la, et
 * jamais un futur type que le serveur nommerait autrement.
 */
const TYPE_SERVEUR_MATCH_AMICAL = 'match amical';

/**
 * Une rangee de l'etape 1 : soit un type servi par le serveur, soit la porte
 * « Match amical », qui n'en est pas un.
 * @typedef {object} RangeeDeType
 * @property {string} description Ligne d'explication, vide si le type est inconnu.
 * @property {boolean} disabled Rangee grisee et non pressable.
 * @property {string} key Cle de rendu.
 * @property {() => void} onPress Geste declenche au toucher.
 * @property {boolean} selected Marqueur de choix courant.
 * @property {string} tag Pilule courte, vide s'il n'y en a pas.
 * @property {string} title Libelle affiche — le nom du SERVEUR, jamais reecrit.
 */

/**
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
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
    const nextRoute = getEventWizardNextRoute(RouteNames.EventWizardType, { ...state, type });
    // 🧨 D19 — SEUL ECRAN DU TUNNEL OU LE BILLET DE RETOUR EST CONDITIONNEL, et
    // ce n'est pas une prudence de principe : changer le type change la CHAINE
    // elle-meme (un stage gagne son programme, une detection ses postes, un
    // tournoi ses deux ecrans). Revenir droit au recapitulatif laisserait ces
    // etapes-la jamais remplies. Type inchange = geste blanc, on rend la main
    // au recap ; type change = on repart dans le tunnel, comme aujourd'hui.
    const isSameType = Boolean(type?.documentId)
      && state?.type?.documentId === type.documentId;

    navigation.navigate(
      isSameType ? getEventWizardExitRoute(nextRoute, route?.params) : nextRoute,
    );
  };

  // Decision d'Adel du 2026-08-06 : « Match amical » n'est pas un type
  // d'evenement, c'est une SORTIE. On quitte le tunnel Evenement pour entrer
  // dans le tunnel amical, qui a son propre etat et ses 7 etapes.
  //
  // `navigate` et non `replace` : la pile garde `EventStack` en dessous, donc
  // ① le brouillon d'evenement en cours n'est pas perdu ② le « Retour » de la
  // 1re etape amicale (`FriendlyMatchWizardTeam.js:91`, un simple `goBack`)
  // ramene ICI. Un aller sans retour serait un piege ; le filet le fige.
  //
  // ⚠️ POURQUOI PAS `navigateOrExplainOnWeb` ICI, alors que l'autre entree du
  // tunnel amical l'utilise (`FriendlyMatchListContent.js:258`) : ce garde-fou
  // interroge le nom qu'on lui passe. Le CONTENEUR n'a pas de motif d'URL — il
  // est exempte parce que ce sont ses ENFANTS qui en portent un
  // (`webRouteExemptions.js:38`). L'autre entree vise le conteneur SEUL, elle
  // atterrirait donc sur « / » : son garde-fou est justifie. Ici on nomme
  // l'etape visee, qui EST routee (`webRoutes.js:149`,
  // /friendly-matches/wizard/team), et `buildWebPath` deplie deja `{ screen }`
  // pour retomber dessus (`webRoutes.js:271`). Poser le garde-fou sur le
  // conteneur refuserait donc une destination qui existe sur le site.
  //
  // D24 — `entryOrigin` dit au tunnel amical QUI lui a ouvert la porte. Sans
  // lui, publier l'annonce effacait bien le tunnel amical, mais laissait
  // `EventStack` dessous, arrete sur CET ecran : le premier « Retour » depuis
  // le detail de l'annonce retombait donc dans le tunnel Evenement (defaut ⑤
  // de la recette du 2026-08-07). L'information VOYAGE, elle ne se devine pas
  // en fouillant la pile — lecon L40-B.
  const handleOpenFriendlyMatchWizard = () => {
    navigation.navigate(RouteNames.FriendlyMatchWizardStack, {
      params: { entryOrigin: RouteNames.EventStack },
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
    const rows = /** @type {RangeeDeType[]} */ ([]);
    /** @type {RangeeDeType} */
    const friendlyMatchRow = {
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
    };

    (eventTypes || []).forEach((type) => {
      const normalized = normalizeTypeLabel(type?.name);
      // AA10 ① — le type serveur homonyme ne s'affiche pas : c'est la PORTE
      // ci-dessus qu'Adel garde. Voir `TYPE_SERVEUR_MATCH_AMICAL`.
      if (normalized === TYPE_SERVEUR_MATCH_AMICAL) return;
      rows.push({
        description: getTypeDescription(normalized),
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
      // Une seule porte, meme si le serveur venait a servir deux types
      // normalises en « match » : deux rangees porteraient la meme cle React.
      if (normalized === 'match' && !rows.includes(friendlyMatchRow)) {
        rows.push(friendlyMatchRow);
      }
    });

    // Sans type « Match » — un serveur qui l'aurait renomme — la porte se pose
    // en fin de liste plutot que de disparaitre.
    if (rows.length > 0 && !rows.includes(friendlyMatchRow)) {
      rows.push(friendlyMatchRow);
    }

    return rows;
  };

  /**
   * Une rangee de choix : titre, description sur une ligne, marqueur de
   * selection. Une rangee grisee ne porte ni marqueur ni action.
   * @param {RangeeDeType} row Rangee construite par `buildRows`.
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
