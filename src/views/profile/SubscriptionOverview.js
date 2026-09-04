import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ScrollView, Text, TouchableOpacity, View,
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
  formatSubscriptionPlanLabel,
  getCoveredTeamCount,
  getCoveringEntitlement,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
  hasActiveClubOffer,
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
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import LicenseeCountField from '@/components/molecules/licenseeCountField/LicenseeCountField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import SubscriptionCoveredHero from '@/views/profile/SubscriptionCoveredHero';

import { RouteNames } from '@/navigation/routeNames';

/**
 * ESSAI (2026-08-28) — LA DUREE SORT DE CES DEUX LIBELLES, ET C'EST UNE
 * CORRECTION, PAS UNE PREFERENCE.
 *
 * Ils annonçaient « essai 30 jours » EN DUR. Depuis le cadeau de bienvenue du
 * dirigeant, le MEME `fc_trial_club` peut durer 7 jours
 * (`subscription-trial.ts`, `ONBOARDING_GIFT_DURATION_DAYS`) : l'ecran aurait
 * promis 30 jours pour un droit qui s'eteint au 7e, et le client aurait eu
 * raison de se plaindre.
 * ⛔ Ne JAMAIS y recrire un nombre de jours : la vraie duree est deja affichee
 * juste a cote, en « J-N », et elle est calculee sur `currentPeriodEnd` — donc
 * elle est vraie quelle que soit la decision d'Adel sur 7 ou 30 jours.
 * @type {Record<string, string>}
 */
const TRIAL_PLAN_LABELS = {
  fc_trial_club: 'Aperçu Club (offert)',
  fc_trial_team: 'Aperçu Équipe (offert)',
};

/**
 * @param {any} clubVerificationSummary
 * @returns {string}
 */
const getVerificationLabel = (clubVerificationSummary) => {
  if (!clubVerificationSummary?.clubDocumentId) {
    return 'Aucun club rattaché';
  }
  if (clubVerificationSummary?.clubVerified === true) {
    return 'Club certifié';
  }
  if (clubVerificationSummary?.requiresClubVerification === true) {
    // L'ancien libelle reclamait ici un geste qui n'existe pas pour un
    // dirigeant : la certification est faite par la plateforme, jamais par lui.
    return 'Certification en cours';
  }
  return 'Club non certifié';
};

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
  String(planCode || '').trim().toLowerCase().includes('club') ? 'Club' : 'Équipe'
);

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const formatSubscriptionPlanLabelWithTrial = (planCode) => (
  TRIAL_PLAN_LABELS[String(planCode || '').trim().toLowerCase()]
    || formatSubscriptionPlanLabel(planCode)
);

/**
 * @param {{ trialSubscription: any }} props
 * @returns {import('react').ReactElement}
 */
function SubscriptionTrialBanner({ trialSubscription }) {
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
        {`Aperçu ${getTrialScopeLabel(trialSubscription?.planCode)} · J-${remainingDays}`}
      </Text>
      <Text style={[Fonts.p2, Fonts.primary700]}>
        Aucune carte requise. Retour à l&apos;offre gratuite ensuite.
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
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionAccessLevel,
    subscriptionSummary,
    userData,
  } = useAuth();

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionExperience = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const currentClubDocumentId = String(
    clubVerificationSummary?.clubDocumentId || userData?.club?.documentId || '',
  ).trim();
  const activePlanCodes = useMemo(
    () => (Array.isArray(subscriptionSummary?.activePlanCodes) ? subscriptionSummary.activePlanCodes : []),
    [subscriptionSummary?.activePlanCodes],
  );

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

  const statusMeta = useMemo(
    () => getSubscriptionStatusMeta(subscriptionAccessLevel),
    [subscriptionAccessLevel],
  );
  // Chip de statut DS (design 13c) : neutre / cyan / violet, jamais de couleurs Tailwind.
  const subscriptionChip = useMemo(() => {
    switch (subscriptionAccessLevel) {
      case 'CLUB':
      case 'CLUB_UNVERIFIED':
        return {
          // R10 — les deux etats Club portent la meme etiquette et la meme
          // couleur : ils ouvrent exactement les memes droits, et l'horloge
          // suggerait au client une attente qui ne le concerne pas.
          borderColor: withAlpha(Colors.violet500, 0.55),
          fillColor: withAlpha(Colors.violet500, 0.16),
          label: t(`profile.subscription.states.${subscriptionAccessLevel === 'CLUB' ? 'club' : 'clubUnverified'}`),
          textColor: Colors.violet200,
        };
      case 'TEAM':
        return {
          borderColor: withAlpha(Colors.primary500, 0.45),
          fillColor: withAlpha(Colors.primary500, 0.12),
          label: t('profile.subscription.states.team'),
          textColor: Colors.primary200,
        };
      default:
        return {
          borderColor: withAlpha(Colors.neutral00, 0.22),
          fillColor: withAlpha(Colors.neutral00, 0.08),
          label: t('profile.subscription.states.free'),
          textColor: Colors.neutral200,
        };
    }
  }, [subscriptionAccessLevel, Colors, t]);

  const planLabels = useMemo(
    () => activePlanCodes.map(
      /** @param {string} planCode */ (planCode) => formatSubscriptionPlanLabelWithTrial(planCode),
    ),
    [activePlanCodes],
  );
  const teamSlotSummary = useMemo(
    () => getSubscriptionTeamSlotSummary(subscriptionSummary),
    [subscriptionSummary],
  );
  const coveredTeamCount = useMemo(
    () => getCoveredTeamCount(entitlementsSummary, subscriptionSummary),
    [entitlementsSummary, subscriptionSummary],
  );
  const activeTrialSubscription = useMemo(
    () => getActiveTrialSubscription(subscriptionSummary),
    [subscriptionSummary],
  );
  const payerRenewalEntitlement = useMemo(
    () => entitlementsSummary.find(
      (/** @type {any} */ entry) => entry?.paidBy?.documentId
        && entry.paidBy.documentId === String(userData?.documentId || '')
        && entry?.subscriptionCurrentPeriodEnd,
    ) || null,
    [entitlementsSummary, userData?.documentId],
  );

  const verificationLabel = getVerificationLabel(clubVerificationSummary);
  const isFreeLevel = subscriptionAccessLevel === 'FREE';
  const isClubLevel = hasActiveClubOffer(subscriptionAccessLevel);
  // Titre humain de la carte statut : le vrai nom d'offre si payant, sinon l'offre gratuite.
  const planCardTitle = isFreeLevel ? 'Offre gratuite FoundClub' : (planLabels[0] || statusMeta.label);
  // Description tutoyée par niveau (remplace la copie technique/vouvoyée du backend).
  const planCardDescription = {
    CLUB: 'Les droits Club sont actifs sur ton club certifié : toutes tes équipes sont couvertes.',
    CLUB_UNVERIFIED: 'Tes droits Club sont actifs sur tout ton club — rien n\'est bloqué. Ton club est en cours de certification par la plateforme.',
    FREE: 'Tu publies en quantité limitée. Passe à une offre payante pour lever les limites.',
    TEAM: 'Tes équipes couvertes profitent des droits Équipe, sans limite de publication.',
  }[subscriptionAccessLevel] || 'Tu utilises l\'offre gratuite FoundClub.';
  // Résumé de couverture humain (aucune tuile « 0 » : on n'affiche que ce qui a du sens).
  const coverageSummary = (() => {
    if (isFreeLevel) return '';
    if (isClubLevel) return 'Toutes les équipes de ton club sont couvertes.';
    if (coveredTeamCount > 0) {
      return `${coveredTeamCount} équipe${coveredTeamCount > 1 ? 's' : ''} couverte${coveredTeamCount > 1 ? 's' : ''} par ton offre.`;
    }
    return '';
  })();
  // Places restantes d'une offre Équipe : la seule information de l'ancienne
  // section « Plans et droits actifs » qui n'existait nulle part ailleurs.
  const teamSlotLine = !isFreeLevel && !isClubLevel && teamSlotSummary.total > 0
    ? `${teamSlotSummary.assigned}/${teamSlotSummary.total} place${teamSlotSummary.total > 1 ? 's' : ''} attribuée${teamSlotSummary.assigned > 1 ? 's' : ''}`
    : '';
  const renewalDateLabel = payerRenewalEntitlement?.subscriptionCurrentPeriodEnd
    ? formatDate(
      new Date(payerRenewalEntitlement.subscriptionCurrentPeriodEnd),
      'd MMMM yyyy',
      { locale: frLocale },
    )
    : '';

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
        'Nouveau nombre de licenciés enregistré',
        Number.isFinite(previousCount) && previousCount > 0
          ? `Ton club passe de ${previousCount} à ${nextCount} licenciés. La différence est facturée tout de suite, au prorata, et les adhésions rouvrent.`
          : `Ton club couvre maintenant ${nextCount} licenciés. La différence est facturée tout de suite, au prorata, et les adhésions rouvrent.`,
      );
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
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
        'Restauration terminée',
        restoredCount > 0
          ? `${restoredCount} abonnement${restoredCount > 1 ? 's ont été retrouves' : ' a été retrouve'}.`
          : 'Aucun achat n a été retrouve sur ce compte.',
      );
    } catch (error) {
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
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
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  }, [t]);

  if (!canShowSubscriptionExperience) {
    return null;
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

  /**
   * Ligne d'information de la carte statut (Certification, Renouvellement…).
   * @param {{ icon: string; label: string; value: string; valueColor?: any }} props
   * @returns {import('react').ReactElement}
   */
  const renderStatusLine = ({
    icon, label, value, valueColor,
  }) => (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[8],
        {
          borderTopColor: withAlpha(Colors.neutral00, 0.06),
          borderTopWidth: 1,
          minHeight: 42,
        },
      ]}
    >
      <Image
        source={Images[icon]}
        style={{ height: 14, tintColor: Colors.neutral400, width: 14 }}
      />
      <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[Alignments.fill, Fonts.p4Bold, Fonts.textRight, { color: valueColor || Colors.neutral100 }]}
      >
        {value}
      </Text>
    </View>
  );

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

        {/* LA carte statut : la seule carte riche de l'ecran. */}
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary800, 0.82),
            borderColor: isClubLevel
              ? withAlpha(Colors.violet500, 0.42)
              : withAlpha(Colors.primary500, 0.24),
            borderRadius: 18,
            borderWidth: 1,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <Text numberOfLines={2} style={[Alignments.fill, Fonts.h4Black, Fonts.neutral00]}>
              {planCardTitle}
            </Text>
            <View
              style={{
                backgroundColor: subscriptionChip.fillColor,
                borderColor: subscriptionChip.borderColor,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: subscriptionChip.textColor }]}>
                {subscriptionChip.label}
              </Text>
            </View>
          </View>

          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8], { lineHeight: 19 }]}>
            {planCardDescription}
          </Text>

          {coverageSummary ? (
            <Text style={[Fonts.p4Bold, Fonts.primary200, Spaces.marginTop[8]]}>
              {coverageSummary}
            </Text>
          ) : null}

          {planLabels.length > 1 ? (
            <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[4]]}>
              {`Autres offres actives : ${planLabels.slice(1).join(' · ')}`}
            </Text>
          ) : null}

          <View style={Spaces.marginTop[12]}>
            {isClubLevel ? renderStatusLine({
              icon: 'check',
              label: 'Certification',
              value: verificationLabel,
              valueColor: Colors.violet200,
            }) : null}
            {teamSlotLine ? renderStatusLine({
              icon: 'users',
              label: 'Équipes couvertes',
              value: teamSlotLine,
            }) : null}
            {renewalDateLabel ? renderStatusLine({
              icon: 'calendar',
              label: 'Renouvelé le',
              value: renewalDateLabel,
            }) : null}
          </View>
        </View>

        {renderSection(
          'Offre', (
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
                label: 'Augmenter mes licenciés',
                onPress: () => setIsLicenseeSheetVisible(true),
                right: knownLicenseeCount === null ? '' : `${knownLicenseeCount} couverts`,
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
                right: t('profile.subscription.actions.manageWebHint', 'Site de paiement'),
                withDivider: true,
              }) : null}
            </>
          ),
        )}

        {currentClubDocumentId ? renderSection('Club', renderActionRow({
          icon: 'shield',
          label: t('profile.subscription.actions.viewClub', 'Voir mon club'),
          onPress: () => navigation.navigate(RouteNames.ClubStack, {
            params: { clubId: currentClubDocumentId },
            screen: RouteNames.Club,
          }),
          right: t('profile.subscription.actions.viewClubHint', 'Demandes · certification'),
        })) : null}

        <LegalFooter restore={false} />
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
              Augmenter mes licenciés
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {knownLicenseeCount === null
                ? 'Indique le nouveau nombre TOTAL de licenciés que ton club doit couvrir.'
                : `Ton abonnement couvre ${knownLicenseeCount} licenciés${knownMemberCount === null ? '' : `, et ton club compte ${knownMemberCount} membres`}. Indique le nouveau total.`}
            </Text>
          </View>

          <LicenseeCountField
            billingPeriod={licenseeSubscription?.billingPeriod || ''}
            helperText={'La différence est facturée tout de suite, au prorata du temps restant. '
              + 'Une baisse, elle, prend effet au prochain renouvellement.'}
            label="Nouveau nombre de licenciés"
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
              {`+ ${formatSubscriptionPerMemberPriceLabel(
                licenseeUnitPriceEurCents,
                /** @type {number} */ (typedLicenseeCount) - knownLicenseeCount,
                licenseeSubscription?.billingPeriod || '',
              )} sur une année pleine`}
            </Text>
          ) : null}

          <View style={Spaces.gap[8]}>
            <Button
              disabled={!isTypedLicenseeCountValid}
              isLoading={increaseMutation.isPending}
              onPress={handleIncreaseLicensees}
              title="Confirmer l'augmentation"
              variant="PrimaryLight"
            />
            <Button
              onPress={closeLicenseeSheet}
              title="Annuler"
              variant="SecondaryLight"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SubscriptionOverview;
