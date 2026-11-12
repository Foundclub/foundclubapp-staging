import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  clampSubscriptionLicenseeCount,
  formatSubscriptionPerMemberPriceLabel,
  getSubscriptionBillingErrorMessage,
  getSubscriptionEntryUnitPriceEurCents,
  isPerLicenseeSubscriptionEntry,
  sanitizeSubscriptionLicenseeCountInput,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatCollectiviteOfferedBy,
  getCollectiviteOffer,
  getCollectiviteOfferDetails,
  getCoveringEntitlement,
} from '@/domains/subscription/subscriptionDecision';
import {
  openSubscriptionManagementPortal,
  performSubscriptionLicenseeIncrease,
  restoreAllSubscriptionPurchases,
} from '@/domains/subscription/subscriptionPurchaseRail';
import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import { useSubscriptionCatalog } from '@/domains/subscription/useSubscriptionCatalog';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import LicenseeCountField from '@/components/molecules/licenseeCountField/LicenseeCountField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import SubscriptionCoveredHero from '@/views/profile/SubscriptionCoveredHero';
import SubscriptionPlanCard, { useSubscriptionPlanCard } from '@/views/profile/SubscriptionPlanCard';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @param {any} subscriptionSummary
 * @returns {any | null}
 */
const getActiveTrialSubscription = (subscriptionSummary) => {
  const payerSubscriptions = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
    ? subscriptionSummary.payerSubscriptionsSummary
    : [];

  return payerSubscriptions.find(/** @param {any} entry */ (entry) => entry?.isTrial === true
    && ['active', 'grace_period'].includes(String(entry?.status || '').trim().toLowerCase())) || null;
};

/**
 * @param {string | null | undefined} currentPeriodEnd
 * @returns {number}
 */
const getTrialRemainingDays = (currentPeriodEnd) => {
  const endTime = new Date(String(currentPeriodEnd || '')).getTime();
  if (!Number.isFinite(endTime)) {
    return 0;
  }

  return Math.max(0, Math.ceil((endTime - Date.now()) / (1000 * 60 * 60 * 24)));
};

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const getTrialScopeLabel = (planCode) => (
  String(planCode || '').trim().toLowerCase().includes('club') ? i18next.t(
    'subscriptionOverview.trialScope.club',
    'Club',
  ) : i18next.t(
    'profile.subscription.states.team',
    'Équipe',
  )
);

/**
 * @param {{ trialSubscription: any }} props
 * @returns {import('react').ReactElement}
 */
function SubscriptionTrialBanner({ trialSubscription }) {
  const { t } = useTranslation();
  const { ApplicationStyle, Fonts, Spaces } = useTheme();
  const remainingDays = getTrialRemainingDays(trialSubscription?.currentPeriodEnd);

  return (
    <View style={[
      Spaces.gap[4],
      Spaces.padding[16],
      ApplicationStyle.borderRadius12,
      ApplicationStyle.borderWidth1,
      ApplicationStyle.borderColor.primary700,
      ApplicationStyle.backgroundColor.primary100,
    ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.primary700]}>
        {t(
          'subscriptionOverview.trialBanner.title',
          'Essai {{scope}} · J-{{remainingDays}}',
          {
            remainingDays,
            scope: getTrialScopeLabel(trialSubscription?.planCode),
            ...SANS_ECHAPPEMENT,
          },
        )}
      </Text>
      <Text style={[Fonts.p2, Fonts.primary700]}>
        {t(
          'subscriptionOverview.trialBanner.noCard',
          "Aucune carte requise. Retour à l'offre gratuite ensuite.",
        )}
      </Text>
    </View>
  );
}

/**
 * Ecran 1 du parcours Abonnement (L33) : GERER. Aucun catalogue a VENDRE ici —
 * la vente vit dans le carrousel, la comparaison dans la matrice.
 *
 * S12-B/D5 — il porte desormais UN geste d'argent : augmenter le nombre de
 * licenciés couverts. Il est pose ICI et pas sur une route neuve, parce que les
 * routes sont des carrefours (E4 : `routeNames`, `webRoutes`, le registre du
 * site) et qu'une feuille suffit. La notification de quota y mene par
 * `openLicenseeIncrease`.
 *
 * Cette route garde son nom et son URL web `/profile/subscription` : trois
 * fichiers de test et la table des routes du site en dependent.
 * @param {{ navigation?: any, route?: any }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionOverview({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    accountSubscriptionAccessLevel,
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionAccessLevel: activeClubSubscriptionAccessLevel,
    subscriptionSummary,
    userData,
  } = useAuth();
  // ABOPARCLUB (2026-09-29) — CET ECRAN DECRIT CE QUE LE COMPTE PAIE. Depuis la
  // decision « niveau oui », `subscriptionAccessLevel` est le niveau du club
  // AFFICHE : dans AIKI il vaut « gratuit », et le « Club 100 » paye pour
  // FoundClub Demo aurait disparu de l'ecran qui le gere (piege a du lot). Le
  // niveau du COMPTE garde ici tout ce qu'il affichait ; ABOCLUB/ABOCLUB2 disent
  // deja quel club l'offre couvre, et que le club affiche ne l'est pas.
  const subscriptionAccessLevel = accountSubscriptionAccessLevel || activeClubSubscriptionAccessLevel;

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionExperience = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const currentClubDocumentId = String(
    clubVerificationSummary?.clubDocumentId || userData?.club?.documentId || '',
  ).trim();
  // « Deja couvert » (handoff 7b) : quelqu'un d'autre paie pour mon equipe/club
  // et je ne paie rien moi-meme -> page heros dediee.
  //
  // 🧨 VITRINE / W4 — CE CALCUL VIVAIT ICI EN DOUBLE, ET LES DEUX COPIES AVAIENT
  // LA MEME ERREUR : « si des offres sont actives, on n'affiche rien ». Or
  // `activePlanCodes` inclut les droits payes par QUELQU'UN D'AUTRE (le serveur
  // la construit a partir de tous les droits actifs du compte) : etre couvert
  // suffisait a fermer la porte de l'ecran qui explique la couverture. Une seule
  // copie desormais, dans `subscriptionDecision`, ou le motif est ecrit en clair.
  const coveringEntitlement = useMemo(() => getCoveringEntitlement({
    entitlementsSummary,
    subscriptionAccessLevel,
    subscriptionSummary,
    userDocumentId: String(userData?.documentId || '').trim(),
  }), [entitlementsSummary, subscriptionAccessLevel, subscriptionSummary, userData?.documentId]);
  const coveredByOtherTeamNames = useMemo(() => Array.from(new Set(
    entitlementsSummary
      .filter(/** @param {any} entry */ (entry) => entry?.scopeType === 'TEAM' && entry?.scopeTeamName)
      .map(/** @param {any} entry */ (entry) => String(entry.scopeTeamName)),
  )), [entitlementsSummary]);
  // COLL1D (29/09) — L'OFFRE CLUB OFFERTE PAR LA COLLECTIVITE (SPEC §3, §4) : « Mon
  // abonnement » le dit, sans date ni prix — personne ne paie dans l'app. Seul un
  // abonnement pris dans un MAGASIN (ou sur le site) garde l'ecran de gestion : c'est
  // la seule porte pour le gerer ou le resilier. Un cadeau `manual` ne compte pas.
  const collectiviteOffer = useMemo(() => getCollectiviteOffer({
    clubDocumentId: currentClubDocumentId,
    entitlementsSummary,
  }), [currentClubDocumentId, entitlementsSummary]);
  /** @type {any[]} */
  const payerSubscriptionRows = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
    ? subscriptionSummary.payerSubscriptionsSummary
    : [];
  const paysInAStore = payerSubscriptionRows.some((entry) => (
    ['active', 'grace_period'].includes(String(entry?.status || '').trim().toLowerCase())
      && String(entry?.provider || '').trim().toLowerCase() !== 'manual'
  ));

  useEffect(() => {
    if (canShowSubscriptionExperience) {
      return;
    }

    if (typeof navigation?.replace === 'function') {
      navigation.replace(RouteNames.Profile);
      return;
    }

    if (typeof navigation?.navigate === 'function') {
      navigation.navigate(RouteNames.Profile);
    }
  }, [canShowSubscriptionExperience, navigation]);

  const activeTrialSubscription = useMemo(
    () => getActiveTrialSubscription(subscriptionSummary),
    [subscriptionSummary],
  );
  // ABONNEMENT-HAUT (12/11) — la carte de statut (titre, pastille, couverture, certification,
  // places, date) se calcule dans SubscriptionPlanCard.js ; l ecran en lit trois valeurs.
  const carte = useSubscriptionPlanCard();
  const { isFreeLevel, planCardDate, uncoveredActiveClub } = carte;

  /* ================================================================== */
  /* S12-B/D5 — AUGMENTER LE NOMBRE DE LICENCIES COUVERTS                */
  /* ================================================================== */

  // Le catalogue est lu ICI pour UNE raison : savoir si l'offre payee se facture
  // AU LICENCIE. C'est `pricingModel` qui le dit, jamais le code de plan — et
  // c'est lui aussi qui porte le prix unitaire du recap. Point de lecture unique
  // (L39), donc partage avec les surfaces de vente et mis en cache 10 min.
  const catalogEntries = useSubscriptionCatalog({
    enabled: canShowSubscriptionExperience,
  }).entries;

  // L'abonnement au licencie que CETTE personne paie. On croise le detail des
  // abonnements payes avec le catalogue : le resume serveur ne dit pas quel
  // modele de prix porte un plan.
  const licenseeSubscription = useMemo(() => {
    const payerSubscriptions = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
      ? subscriptionSummary.payerSubscriptionsSummary
      : [];
    return payerSubscriptions.find(/** @param {any} entry */ (entry) => {
      const planCode = String(entry?.planCode || '').trim();
      const isActive = ['active', 'grace_period'].includes(
        String(entry?.status || '').trim().toLowerCase(),
      );
      return isActive && catalogEntries.some(
        (catalogEntry) => String(catalogEntry?.planCode || '').trim() === planCode
          && isPerLicenseeSubscriptionEntry(catalogEntry),
      );
    }) || null;
  }, [catalogEntries, subscriptionSummary?.payerSubscriptionsSummary]);

  // ABO-FIX / R3 — L ABONNEMENT PRIS SUR LE SITE, et lui seul.
  // La porte de sortie n a de sens que pour un abonnement Stripe : celui qui
  // a paye sur iPhone resilie chez Apple, celui qui a paye sur Android chez
  // Google, et leur montrer un bouton qui ne peut pas les servir serait pire
  // que pas de bouton. `provider` est deja dans le resume du serveur
  // (subscription-permission.ts) : on ne devine rien, on le lit.
  const webSubscription = useMemo(() => {
    const payerSubscriptions = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
      ? subscriptionSummary.payerSubscriptionsSummary
      : [];
    return payerSubscriptions.find(/** @param {any} entry */ (entry) => (
      String(entry?.provider || '').trim().toLowerCase() === 'web'
      && ['active', 'grace_period'].includes(String(entry?.status || '').trim().toLowerCase())
    )) || null;
  }, [subscriptionSummary?.payerSubscriptionsSummary]);

  const licenseeCatalogEntry = useMemo(
    () => catalogEntries.find(
      (entry) => String(entry?.planCode || '').trim() === String(licenseeSubscription?.planCode || '').trim(),
    ) || null,
    [catalogEntries, licenseeSubscription?.planCode],
  );
  const licenseeUnitPriceEurCents = getSubscriptionEntryUnitPriceEurCents(licenseeCatalogEntry);

  // ⚠️ LE NOMBRE ACTUELLEMENT SOUSCRIT NE VIENT PAS DU BOOTSTRAP.
  // `payerSubscriptionsSummary` n'expose PAS `licenseeCount`
  // (subscription-permission.ts:1150-1159), et aucune route ne le lit. Les deux
  // seuls porteurs sont le REFUS de quota et la NOTIFICATION — tous deux
  // arrivent ici en parametre de route. Sans eux, on ne l'invente pas : on
  // demande le nouveau total, et le serveur refuse tout seul une diminution.
  const knownLicenseeCount = clampSubscriptionLicenseeCount(route?.params?.licenseeCount);
  const knownMemberCount = clampSubscriptionLicenseeCount(route?.params?.memberCount);

  const [isLicenseeSheetVisible, setIsLicenseeSheetVisible] = useState(false);
  const [licenseeCountText, setLicenseeCountText] = useState('');

  // La notification de quota et le mur payant ouvrent la feuille directement :
  // deux taps de moins entre « ton club est plein » et la reparation.
  useEffect(() => {
    if (route?.params?.openLicenseeIncrease && licenseeSubscription) {
      setIsLicenseeSheetVisible(true);
    }
  }, [licenseeSubscription, route?.params?.openLicenseeIncrease]);

  const typedLicenseeCount = licenseeCountText === ''
    ? null
    : clampSubscriptionLicenseeCount(licenseeCountText);
  // Le serveur REFUSE une diminution (subscription-stripe.ts:247-253) : le
  // plancher de l'ecran est donc « strictement plus que ce qui est deja
  // couvert », quand on le connait.
  const minimumLicenseeCount = knownLicenseeCount === null ? 1 : knownLicenseeCount + 1;
  const isTypedLicenseeCountValid = typedLicenseeCount !== null
    && String(typedLicenseeCount) === licenseeCountText
    && typedLicenseeCount >= minimumLicenseeCount;

  const increaseMutation = useMutation({
    mutationFn: async (/** @type {{ licenseeCount: number; subscriptionDocumentId: string }} */ payload) => (
      performSubscriptionLicenseeIncrease(payload)
    ),
  });

  const closeLicenseeSheet = useCallback(() => {
    setIsLicenseeSheetVisible(false);
    setLicenseeCountText('');
  }, []);

  const handleIncreaseLicensees = useCallback(async () => {
    const subscriptionDocumentId = String(licenseeSubscription?.documentId || '').trim();
    if (!subscriptionDocumentId || !isTypedLicenseeCountValid || increaseMutation.isPending) {
      return;
    }

    try {
      const result = await increaseMutation.mutateAsync({
        licenseeCount: /** @type {number} */ (typedLicenseeCount),
        subscriptionDocumentId,
      });
      // Le plafond d'adhesions est relu par le serveur : on rearme le calendrier
      // de convergence comme apres un achat (L08).
      scheduleSubscriptionStateRefresh(queryClient);
      await invalidateSubscriptionState(queryClient);
      closeLicenseeSheet();

      // La CONFIRMATION dit le mouvement, pas seulement le resultat : « 120 →
      // 150 » se verifie d'un coup d'oeil, « 150 » ne se verifie pas.
      const previousCount = Number(result?.previousLicenseeCount);
      const nextCount = Number(result?.licenseeCount || typedLicenseeCount);
      Alert.alert(
        i18next.t(
          'subscriptionOverview.alerts.licenseeIncreased.title',
          'Nouveau nombre de licenciés enregistré',
        ),
        Number.isFinite(previousCount) && previousCount > 0
          ? i18next.t(
            'subscriptionOverview.alerts.licenseeIncreased.fromTo',
            'Ton club passe de {{previousCount}} à {{nextCount}} licenciés. La différence '
              + 'est facturée tout de suite, au prorata, et les adhésions rouvrent.',
            { nextCount, previousCount, ...SANS_ECHAPPEMENT },
          )
          : i18next.t(
            'subscriptionOverview.alerts.licenseeIncreased.nowCovers',
            'Ton club couvre maintenant {{nextCount}} licenciés. La différence est facturée '
              + 'tout de suite, au prorata, et les adhésions rouvrent.',
            { nextCount, ...SANS_ECHAPPEMENT },
          ),
      );
    } catch (error) {
      Alert.alert(i18next.t(
        'subscriptionOverview.alerts.subscriptionError.title',
        'Erreur abonnement',
      ), getSubscriptionBillingErrorMessage(error));
    }
  }, [
    closeLicenseeSheet,
    increaseMutation,
    isTypedLicenseeCountValid,
    licenseeSubscription?.documentId,
    queryClient,
    typedLicenseeCount,
  ]);

  const restoreMutation = useMutation({
    mutationFn: async () => restoreAllSubscriptionPurchases(),
  });

  const handleRestorePurchases = useCallback(async () => {
    try {
      const restoredPayload = await restoreMutation.mutateAsync();
      // Les droits d'un achat store sont ouverts par le webhook, quelques
      // secondes APRES la reussite cote client : une invalidation immediate
      // seule relit l'ancien etat et le fige (L08).
      scheduleSubscriptionStateRefresh(queryClient);
      await invalidateSubscriptionState(queryClient);
      const restoredCount = Number(
        restoredPayload?.meta?.restoredCount || restoredPayload?.data?.length || 0,
      );
      Alert.alert(
        i18next.t('subscriptionOverview.alerts.restoreDone.title', 'Restauration terminée'),
        restoredCount > 0
          ? i18next.t('subscriptionOverview.alerts.restoreDone.found', {
            count: restoredCount,
            defaultValue_one: '{{count}} abonnement a été retrouve.',
            defaultValue_other: '{{count}} abonnements ont été retrouves.',
          })
          : i18next.t(
            'subscriptionOverview.alerts.restoreDone.none',
            'Aucun achat n a été retrouve sur ce compte.',
          ),
      );
    } catch (error) {
      Alert.alert(i18next.t(
        'subscriptionOverview.alerts.subscriptionError.title',
        'Erreur abonnement',
      ), getSubscriptionBillingErrorMessage(error));
    }
  }, [queryClient, restoreMutation]);

  /**
   * ABO-FIX / R3 — OUVRIR LE PORTAIL DE RESILIATION.
   *
   * Le portail est heberge par Stripe : resiliation, factures et moyen de
   * paiement compris, donc aucun ecran a maintenir de notre cote.
   *
   * ⚠️ LE SERVEUR REPOND 200 MEME QUAND LE PORTAIL EST INDISPONIBLE (il n y a
   * AUCUNE cle Stripe en production aujourd'hui) : on lit `available`, on ne
   * suppose pas. Et on ne laisse jamais la personne devant un bouton muet —
   * si on ne peut pas ouvrir, on DIT pourquoi.
   */
  const handleManageWebSubscription = useCallback(async () => {
    // 🍎 Apple 3.1.3(a) — une app iOS ne renvoie pas vers une page de PAIEMENT
    // externe. Cette ligne ouvrait le portail de facturation Stripe dans le
    // navigateur, depuis un ecran iPhone.
    //
    // ⚠️ On ne SUPPRIME pas la ligne : elle est la seule porte de sortie d'un
    // abonne web (ABO-FIX/R3), et l'app lui promet « resiliable a tout moment ».
    // On garde la porte et on change ce qu'il y a derriere : sur iOS on DIT ou
    // aller, sans ouvrir le navigateur et sans montrer d'adresse de paiement.
    // Android et le web gardent le portail : leurs magasins n'interdisent rien ici.
    if (Platform.OS === 'ios') {
      Alert.alert(
        t('profile.subscription.actions.manageWebIosTitle', 'Abonnement pris sur notre site'),
        t(
          'profile.subscription.actions.manageWebIosBody',
          'Cet abonnement n\'a pas ete achete sur l\'App Store : il a ete souscrit sur notre site.'
            + ' Vous pouvez le gerer ou le resilier depuis votre navigateur, avec le meme compte.'
            + ' Ecrivez-nous si vous avez besoin d\'aide.',
        ),
      );
      return;
    }
    try {
      const portal = await openSubscriptionManagementPortal();
      if (portal?.opened) return;
      Alert.alert(
        t('profile.subscription.actions.manageWebErrorTitle', 'Gestion indisponible'),
        t(
          'profile.subscription.actions.manageWebErrorBody',
          'La gestion en ligne de cet abonnement n\'est pas disponible pour le moment.'
            + ' Ecrivez-nous et nous nous en occupons.',
        ),
      );
    } catch (error) {
      Alert.alert(t(
        'subscriptionOverview.alerts.subscriptionError.title',
        'Erreur abonnement',
      ), getSubscriptionBillingErrorMessage(error));
    }
  }, [t]);

  if (!canShowSubscriptionExperience) {
    return null;
  }

  /**
   * Rangee d'action : bouton pleine largeur d'au moins 52 pt.
   * `glyph` prend le pas sur `icon` : AD07 y a pose le SEUL dessin vectoriel
   * de l'ecran (rangee « Comparer les offres »). Les 5 autres restent en PNG.
   * @param {{ glyph?: string; icon?: string; label: string; onPress: () => void; right?: string; withDivider?: boolean }} props
   * @returns {import('react').ReactElement}
   */
  const renderActionRow = ({
    glyph = '', icon = '', label, onPress, right = '', withDivider = false,
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
        {
          borderTopColor: withDivider ? withAlpha(Colors.neutral00, 0.08) : 'transparent',
          borderTopWidth: withDivider ? 1 : 0,
          minHeight: 52,
        },
      ]}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.primary500, 0.12),
          borderRadius: 10,
          height: 30,
          justifyContent: 'center',
          width: 30,
        }}
      >
        {glyph ? (
          <GlyphIcon color={Colors.primary500} name={glyph} size={14} />
        ) : (
          <Image
            source={Images[icon]}
            style={{ height: 14, tintColor: Colors.primary500, width: 14 }}
          />
        )}
      </View>
      <Text style={[Alignments.fill, Fonts.p2Bold, Fonts.neutral100]}>{label}</Text>
      {right ? <Text style={[Fonts.p4, Fonts.neutral400]}>{right}</Text> : null}
      <Image
        source={Images.arrowRight}
        style={{ height: 14, tintColor: Colors.neutral500, width: 14 }}
      />
    </TouchableOpacity>
  );

  /**
   * Groupe de rangees d'actions, sous une legende en capitales.
   * @param {string} title
   * @param {import('react').ReactNode} children
   * @returns {import('react').ReactElement}
   */
  const renderSection = (title, children) => (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 1, textTransform: 'uppercase' }]}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 12,
        }}
      >
        {children}
      </View>
    </View>
  );

  // COLL-C2C (02/10) — planche P8-abonnement-tel, etat 1 (D63) : QUI paie (la Ville), POUR quel
  // club, DEPUIS quand, ce qui est inclus, qui contacter, et ce qui se passe si la Ville arrete.
  // Rien a acheter ni a resilier : ni « Changer d offre », ni « Restaurer mes achats », ni « Gerer
  // ou resilier », ni « Augmenter mes licencies ». « Comparer les offres » et « Voir mon club »
  // restent (planche validee le 01/10).
  if (collectiviteOffer && !paysInAStore) {
    const ville = formatCollectiviteOfferedBy(collectiviteOffer.name);
    const inclus = [
      t(
        'subscriptionCoveredHero.collectivite.inclus.equipes',
        'Créer tes équipes et ajouter tes membres',
      ),
      t(
        'subscriptionCoveredHero.collectivite.inclus.evenements',
        'Publier tes événements, sans limite',
      ),
      t(
        'subscriptionCoveredHero.collectivite.inclus.cotisations',
        'Créer tes campagnes de cotisations',
      ),
      t(
        'subscriptionCoveredHero.collectivite.inclus.matchs',
        'Rechercher des matchs',
      ),
      t(
        'subscriptionCoveredHero.collectivite.inclus.communiquer',
        'Communiquer à tous tes licenciés',
      ),
    ];
    const paragraphe = (/** @type {string} */ titre, /** @type {string} */ corps) => renderSection(
      titre,
      <Text style={[Fonts.p2, Fonts.neutral100, Spaces.paddingVertical[12]]}>{corps}</Text>,
    );
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingBottom[12], Spaces.paddingTop[0]]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
        >
          <SubscriptionCoveredHero
            collectiviteDetails={getCollectiviteOfferDetails({
              clubDocumentId: currentClubDocumentId,
              entitlementsSummary,
            })}
            collectiviteOffer={collectiviteOffer}
            navigation={navigation}
          />
          {renderSection(
            t('subscriptionCoveredHero.collectivite.inclus.titre', 'Ce qui est inclus'),
            <View style={[Spaces.paddingVertical[12], Spaces.gap[8]]}>
              {inclus.map((ligne) => (
                <View key={ligne} style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <SvgIcon color={Colors.success500} height={12} name="check" width={12} />
                  <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{ligne}</Text>
                </View>
              ))}
            </View>,
          )}
          {paragraphe(
            t('subscriptionCoveredHero.collectivite.questionTitre', 'Une question sur cette offre'),
            t(
              'subscriptionCoveredHero.collectivite.question',
              'Adresse-toi à {{ville}}, pas à la boutique.',
              { ville, ...SANS_ECHAPPEMENT },
            ),
          )}
          {paragraphe(
            t('subscriptionCoveredHero.collectivite.arretTitre', 'Si la Ville arrête'),
            t(
              'subscriptionCoveredHero.collectivite.arret',
              // eslint-disable-next-line max-len
              'Ton club repasse à l’offre gratuite. Tes équipes, membres et événements restent. Tu pourras alors t’abonner toi-même.',
            ),
          )}
          {renderSection(
            t('subscriptionOverview.sections.plan', 'Offre'),
            <>
              {renderActionRow({
                glyph: 'chartColumn',
                label: t('profile.subscription.actions.compareOffers', 'Comparer les offres'),
                onPress: () => navigation.navigate(RouteNames.SubscriptionCompare),
              })}
              {currentClubDocumentId ? renderActionRow({
                icon: 'shield',
                label: t('profile.subscription.actions.viewClub', 'Voir mon club'),
                onPress: () => navigation.navigate(RouteNames.ClubStack, {
                  params: { clubId: currentClubDocumentId },
                  screen: RouteNames.Club,
                }),
                right: t('profile.subscription.actions.viewClubHint', 'Demandes · certification'),
                withDivider: true,
              }) : null}
            </>,
          )}
          <LegalFooter pricesNotice={false} restore={false} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (coveringEntitlement) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingBottom[12], Spaces.paddingTop[0]]}
      >
        <SubscriptionCoveredHero
          coveredTeamNames={coveredByOtherTeamNames}
          coveringEntitlement={coveringEntitlement}
          navigation={navigation}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[12], Spaces.paddingTop[0]]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[24]]}
        showsVerticalScrollIndicator={false}
      >
        {activeTrialSubscription ? (
          <SubscriptionTrialBanner trialSubscription={activeTrialSubscription} />
        ) : null}

        {/* ABONNEMENT-HAUT (12/11) : LA carte statut, la seule carte riche de l'ecran,
            vit dans SubscriptionPlanCard.js — le site pose la meme en haut de sa page. */}
        <SubscriptionPlanCard carte={carte} />

        {renderSection(
          t('subscriptionOverview.sections.plan', 'Offre'), (
            <>
              {renderActionRow({
                icon: 'euroCircle',
                label: t('profile.subscription.actions.changeOffer', 'Changer d\'offre'),
                onPress: () => navigation.navigate(RouteNames.SubscriptionOffers),
              })}
              {renderActionRow({
                glyph: 'chartColumn',
                label: t('profile.subscription.actions.compareOffers', 'Comparer les offres'),
                onPress: () => navigation.navigate(RouteNames.SubscriptionCompare),
                withDivider: true,
              })}
              {/* S12-B/D5 — LA PORTE VERS L'AUGMENTATION. Elle n'existe QUE
                  pour qui paie vraiment au licencié : proposer d'augmenter un
                  nombre a quelqu'un qui n'en a pas serait une impasse. */}
              {licenseeSubscription ? renderActionRow({
                icon: 'users',
                label: t('subscriptionOverview.licensee.increase', 'Augmenter mes licenciés'),
                onPress: () => setIsLicenseeSheetVisible(true),
                right: knownLicenseeCount === null ? '' : t(
                  'subscriptionOverview.licensee.coveredCount',
                  '{{knownLicenseeCount}} couverts',
                  { knownLicenseeCount, ...SANS_ECHAPPEMENT },
                ),
                withDivider: true,
              }) : null}
              {renderActionRow({
                icon: 'search',
                label: t('profile.subscription.actions.restore', 'Restaurer mes achats'),
                onPress: handleRestorePurchases,
                withDivider: true,
              })}
              {/* ABO-FIX / R3 — LA SEULE PORTE DE SORTIE D UN ABONNE WEB.
                  Avant ce lot il n'en existait AUCUNE : ni ecran, ni route,
                  pendant que l'app promet « resiliable a tout moment ». Elle
                  n'apparait que pour un abonnement pris sur le site — un
                  abonnement iPhone ou Android se resilie chez son magasin. */}
              {webSubscription ? renderActionRow({
                icon: 'euroCircle',
                label: t('profile.subscription.actions.manageWeb', 'Gerer ou resilier mon abonnement'),
                onPress: handleManageWebSubscription,
                // 🍎 « Site de paiement » est exactement le mot qu'un examinateur
                // Apple releve sous 3.1.3(a). Sur iOS on nomme la MEME chose sans
                // pointer une caisse : l'origine de l'abonnement.
                right: Platform.OS === 'ios'
                  ? t('profile.subscription.actions.manageWebHintIos', 'Souscrit sur notre site')
                  : t('profile.subscription.actions.manageWebHint', 'Site de paiement'),
                withDivider: true,
              }) : null}
            </>
          ),
        )}

        {currentClubDocumentId ? renderSection(
          t('subscriptionOverview.sections.club', 'Club'), (
            <>
              {renderActionRow({
                icon: 'shield',
                label: t('profile.subscription.actions.viewClub', 'Voir mon club'),
                onPress: () => navigation.navigate(RouteNames.ClubStack, {
                  params: { clubId: currentClubDocumentId },
                  screen: RouteNames.Club,
                }),
                right: t('profile.subscription.actions.viewClubHint', 'Demandes · certification'),
              })}
              {/* ABOCLUB — LA SUITE QUI NE TOUCHE PAS A L'ARGENT : revenir sur
                  le club que l'offre couvre. Le selecteur vit sur la fiche du
                  club ACTIF (ClubDetails, des deux clubs) ; l'ouvrir sur le club
                  couvert l'y montrerait deja « actif », sans rien basculer. */}
              {uncoveredActiveClub?.canSwitchToCoveredClub ? renderActionRow({
                icon: 'shield',
                label: t('subscriptionOverview.clubSwitch.label', 'Changer de club actif'),
                onPress: () => navigation.navigate(RouteNames.ClubStack, {
                  params: { clubId: currentClubDocumentId },
                  screen: RouteNames.Club,
                }),
                right: uncoveredActiveClub.coveredClubNames[0] || '',
                withDivider: true,
              }) : null}
            </>
          ),
        ) : null}

        {/* ABOPARCLUB — recette du 29/09 (tournee 4, defaut 4) : « Renouvellement
            automatique » ne se dit que si l'offre decrite se renouvelle vraiment
            (pas sous une offre OFFERTE ni sous une offre posee a la main). Le
            gratuit garde la mention : elle parle des offres a acheter. */}
        <LegalFooter
          pricesNotice={isFreeLevel || planCardDate?.kind === 'renews'}
          restore={false}
        />
      </ScrollView>

      {/* S12-B/D5 — LA FEUILLE « AUGMENTER », pas une route neuve.
          Nombre actuel (quand on le connait) -> nouveau nombre -> ce que ca
          coute -> l'appel -> la confirmation. */}
      <BottomModal
        close={closeLicenseeSheet}
        isVisible={isLicenseeSheetVisible}
        scrollable
        snapPoints={['72%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {t('subscriptionOverview.licensee.increase', 'Augmenter mes licenciés')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {knownLicenseeCount === null
                ? t(
                  'subscriptionOverview.licenseeSheet.introUnknown',
                  'Indique le nouveau nombre TOTAL de licenciés que ton club doit couvrir.',
                )
                : t(
                  'subscriptionOverview.licenseeSheet.introKnown',
                  'Ton abonnement couvre {{knownLicenseeCount}} licenciés{{memberClause}}. '
                    + 'Indique le nouveau total.',
                  {
                    knownLicenseeCount,
                    memberClause: knownMemberCount === null
                      ? ''
                      : t(
                        'subscriptionOverview.licenseeSheet.memberClause',
                        ', et ton club compte {{knownMemberCount}} membres',
                        { knownMemberCount, ...SANS_ECHAPPEMENT },
                      ),
                    ...SANS_ECHAPPEMENT,
                  },
                )}
            </Text>
          </View>

          <LicenseeCountField
            billingPeriod={licenseeSubscription?.billingPeriod || ''}
            helperText={t(
              'subscriptionOverview.licenseeSheet.helperCharge',
              'La différence est facturée tout de suite, au prorata du temps restant. ',
            )
              + t(
                'subscriptionOverview.licenseeSheet.helperDecrease',
                'Une baisse, elle, prend effet au prochain renouvellement.',
              )}
            label={t(
              'subscriptionOverview.licenseeSheet.fieldLabel',
              'Nouveau nombre de licenciés',
            )}
            minCount={minimumLicenseeCount}
            onChangeText={
              (value) => setLicenseeCountText(sanitizeSubscriptionLicenseeCountInput(value))
            }
            unitPriceEurCents={licenseeUnitPriceEurCents}
            value={licenseeCountText}
          />

          {/* CE QUE CA AJOUTE, quand on connait le point de depart : le total
              seul ne dit pas ce qu'on va payer EN PLUS. */}
          {knownLicenseeCount !== null && isTypedLicenseeCountValid ? (
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t(
                'subscriptionOverview.licenseeSheet.extraPerYear',
                '+ {{extraYearLabel}} sur une année pleine',
                {
                  extraYearLabel: formatSubscriptionPerMemberPriceLabel(
                    licenseeUnitPriceEurCents,
                    /** @type {number} */ (typedLicenseeCount) - knownLicenseeCount,
                    licenseeSubscription?.billingPeriod || '',
                  ),
                  ...SANS_ECHAPPEMENT,
                },
              )}
            </Text>
          ) : null}

          <View style={Spaces.gap[8]}>
            <Button
              disabled={!isTypedLicenseeCountValid}
              isLoading={increaseMutation.isPending}
              onPress={handleIncreaseLicensees}
              title={t('subscriptionOverview.licenseeSheet.confirm', "Confirmer l'augmentation")}
              variant="PrimaryLight"
            />
            <Button
              onPress={closeLicenseeSheet}
              title={t('subscriptionOverview.licenseeSheet.cancel', 'Annuler')}
              variant="SecondaryLight"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SubscriptionOverview;
