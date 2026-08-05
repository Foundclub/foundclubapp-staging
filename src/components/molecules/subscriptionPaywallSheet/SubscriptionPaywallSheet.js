import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  findSubscriptionMonthlySiblingEntry,
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  formatSubscriptionYearlyDiscountLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionCatalogEntryMeta,
  getSubscriptionPreselectedSlotCount,
  getSubscriptionTierAbBucket,
  SUBSCRIPTION_TIER_AB_TEST_ENABLED,
} from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionRequiredPlanText,
  getSubscriptionClubSheetContent,
  getSubscriptionPaywallBenefits,
  getSubscriptionPaywallContent,
  getSubscriptionQuotaSheetContent,
  getSubscriptionRecommendedPlanCode,
  getSubscriptionRequiredPlanLabels,
  getSubscriptionRequiredScope,
  getSubscriptionTeamSlotSummary,
  mapSubscriptionDecisionToPaywall,
} from '@/domains/subscription/subscriptionDecision';
import {
  isSubscriptionPurchaseAvailable,
  performSubscriptionPurchase,
} from '@/domains/subscription/subscriptionPurchaseRail';
import { scheduleSubscriptionStateRefresh } from '@/domains/subscription/subscriptionRefresh';
import { useSubscriptionCatalog } from '@/domains/subscription/useSubscriptionCatalog';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';

import { RouteNames } from '@/navigation/routeNames';

import { trackSubscriptionFunnelEvent } from '@/services/subscription/subscriptionService';

/**
 * Rang d'un palier dans sa famille : nombre d'equipes couvertes pour une offre
 * Équipe, numero de tier pour une offre Club (fc_club_tier_2_yearly -> 2).
 * @param {any} entry
 * @returns {number}
 */
const getCatalogEntryTierRank = (entry) => (
  String(entry?.scopeType || '').trim().toUpperCase() === 'CLUB'
    ? Number(String(entry?.planCode || '').match(/tier_(\d+)/)?.[1] || 0)
    : Number(entry?.slotCount || 0)
);

/**
 * Paliers d'une famille d'offre pour une periode de facturation donnee, du moins
 * cher au plus cher.
 * @param {any[]} entries
 * @param {'TEAM' | 'CLUB'} scopeType
 * @param {string} billingPeriod - 'monthly' ou 'yearly'.
 * @returns {Array<{ entry: any; id: number; label: string }>}
 */
const getTierOptionsForPeriod = (entries, scopeType, billingPeriod) => entries
  .filter((entry) => String(entry?.scopeType || '').trim().toUpperCase() === scopeType
    && String(entry?.billingPeriod || '').trim().toLowerCase() === billingPeriod)
  .sort((left, right) => getCatalogEntryTierRank(left) - getCatalogEntryTierRank(right))
  .map((entry) => {
    const slotCount = Number(entry?.slotCount || 0);
    return {
      entry,
      id: getCatalogEntryTierRank(entry),
      // Cote Club, le catalogue serveur porte deja les noms de paliers (Club S/M/L).
      label: scopeType === 'CLUB'
        ? String(entry?.displayName || '').trim()
        : `${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
    };
  })
  .filter((option) => option.id > 0 && option.label);

// Selecteur de periode de facturation (defaut produit : annuel).
// L38 — la pilule ne porte PLUS de tag de remise : le catalogue a deux grilles
// (Club x10 = -17 %, Equipe x7,5-7,7 = -36/-37 %), et « 2 mois offerts » sous-vendait
// l'offre Equipe de plus de la moitie. La remise est calculee sur le palier retenu.
const BILLING_PERIOD_OPTIONS = [
  { id: 'yearly', label: 'Annuel' },
  { id: 'monthly', label: 'Mensuel' },
];

/**
 * Sheet de quota v2 (handoff, decision 1) : une seule ancre prix, segments de
 * palier sans prix, CTA qui nomme la selection, achat direct dans la sheet.
 * Non bloquante : fermer = retour au wizard, brouillon conserve.
 * Les paywalls non-quota (verification club, palier club…) gardent la
 * presentation legacy en bas de fichier.
 * @param {{
 *   close: () => void;
 *   clubDocumentId?: string | null;
 *   contextLabel?: string | null;
 *   decision?: any;
 *   isVisible: boolean;
 *   navigation: any;
 * }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionPaywallSheet({
  close,
  clubDocumentId = null,
  contextLabel = null,
  decision,
  isVisible,
  navigation,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { subscriptionSummary, userData } = useAuth();
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionPaywall = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const paywall = useMemo(
    () => mapSubscriptionDecisionToPaywall(decision),
    [decision],
  );
  const quotaSheetContent = useMemo(
    () => getSubscriptionQuotaSheetContent(decision),
    [decision],
  );
  const clubSheetContent = useMemo(
    () => getSubscriptionClubSheetContent(decision),
    [decision],
  );
  // Une seule presentation pour les deux familles d'offre (L10-A) : la feuille de
  // quota Équipe et la feuille Club partagent paliers, prix, achat direct et
  // portes de sortie. Le reste des paywalls garde la presentation legacy.
  const sellingSheet = quotaSheetContent || clubSheetContent;
  const sellingScope = quotaSheetContent ? 'TEAM' : 'CLUB';
  const paywallContent = useMemo(
    () => getSubscriptionPaywallContent(decision),
    [decision],
  );
  const planLabels = useMemo(
    () => getSubscriptionRequiredPlanLabels(paywall.requiredPlan),
    [paywall.requiredPlan],
  );
  const requiredPlanText = useMemo(
    () => formatSubscriptionRequiredPlanText(paywall.requiredPlan),
    [paywall.requiredPlan],
  );
  const paywallBenefits = useMemo(
    () => getSubscriptionPaywallBenefits(decision),
    [decision],
  );

  const catalogQuery = useSubscriptionCatalog({
    enabled: Boolean(isVisible && decision && canShowSubscriptionPaywall),
  });
  const catalogEntries = catalogQuery.entries;
  const [billingPeriod, setBillingPeriod] = useState('yearly');
  const tierOptions = useMemo(
    () => getTierOptionsForPeriod(catalogEntries, sellingScope, billingPeriod),
    [billingPeriod, catalogEntries, sellingScope],
  );
  // Paliers annuels : base stable pour la preselection (les paliers sont les memes
  // d'une periode a l'autre, on ne reset pas le palier au toggle).
  const yearlyTierOptions = useMemo(
    () => getTierOptionsForPeriod(catalogEntries, sellingScope, 'yearly'),
    [catalogEntries, sellingScope],
  );
  const hasMonthlyTierOptions = useMemo(
    () => getTierOptionsForPeriod(catalogEntries, sellingScope, 'monthly').length > 0,
    [catalogEntries, sellingScope],
  );
  const recommendedEntry = useMemo(() => {
    const recommendedPlanCode = getSubscriptionRecommendedPlanCode(decision);
    return catalogEntries
      .find((entry) => String(entry?.planCode || '').trim() === recommendedPlanCode) || null;
  }, [catalogEntries, decision]);

  const [selectedTierId, setSelectedTierId] = useState(0);
  const funnelAbBucket = getSubscriptionTierAbBucket(userData?.documentId);

  // Palier preselectionne a chaque ouverture (2e equipe -> palier 2 ; offre Club ->
  // le palier le moins cher qui debloque), borne au catalogue, et retour a la
  // periode annuelle recommandee. Si le test A/B est actif, le bucket prime (handoff 13).
  useEffect(() => {
    if (!isVisible || !sellingSheet || yearlyTierOptions.length === 0) {
      return;
    }
    setBillingPeriod('yearly');
    const availableTierIds = yearlyTierOptions.map((option) => option.id);
    let wantedTierId = quotaSheetContent ? quotaSheetContent.preselectedSlotCount : 1;
    if (quotaSheetContent && SUBSCRIPTION_TIER_AB_TEST_ENABLED) {
      wantedTierId = getSubscriptionPreselectedSlotCount(funnelAbBucket);
    }
    setSelectedTierId(availableTierIds.includes(wantedTierId) ? wantedTierId : availableTierIds[0]);
  }, [funnelAbBucket, isVisible, quotaSheetContent, sellingSheet, yearlyTierOptions]);

  // Jalon funnel : ouverture de la feuille de vente (handoff 13).
  useEffect(() => {
    if (!isVisible || !sellingSheet) return;
    trackSubscriptionFunnelEvent('paywall_quota_sheet_viewed', {
      abBucket: funnelAbBucket,
      paywallKey: paywall.paywallKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  const selectedTierOption = useMemo(
    () => tierOptions.find((option) => option.id === selectedTierId) || null,
    [selectedTierId, tierOptions],
  );
  const selectedEntry = selectedTierOption?.entry || null;

  const purchaseMutation = useMutation({
    mutationFn: async (/** @type {any} */ purchaseInput) => (
      performSubscriptionPurchase(purchaseInput)
    ),
  });

  if (!isVisible || !decision) {
    return null;
  }

  if (!canShowSubscriptionPaywall) {
    return (
      <BottomModal
        close={close}
        isVisible={isVisible}
        scrollable={false}
      >
        <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
          <View style={Spaces.gap[8]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('profile.subscription.unavailable.title', 'Action indisponible')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral300]}>
              {t(
                'profile.subscription.unavailable.description',
                "Cette action n'est pas disponible pour ce profil.",
              )}
            </Text>
          </View>

          <Button
            onPress={close}
            title={t('common.close', 'Fermer')}
            variant="Primary"
          />
        </View>
      </BottomModal>
    );
  }

  // L33 — cap sur le CARROUSEL, jamais sur le hub. Cette personne vient de
  // buter sur un mur payant : le hub ne porte plus aucun catalogue, elle y
  // arriverait sans aucune offre a acheter. C'est exactement le trou que L10-A
  // a comble (« un dirigeant carte bleue en main n'a aucun chemin pour payer »).
  // L38 — et sur la BONNE carte : le refus porte la famille d'offre exigee, le
  // carrousel s'ouvrait sinon toujours sur Équipe, y compris pour un mur Club.
  const handleOpenSubscription = () => {
    close();
    navigation.navigate(RouteNames.ProfileStack, {
      params: { focusScope: getSubscriptionRequiredScope(decision) },
      screen: RouteNames.SubscriptionOffers,
    });
  };

  const handleCompareOffers = () => {
    trackSubscriptionFunnelEvent('paywall_compare_offers_opened', {
      abBucket: funnelAbBucket,
      paywallKey: paywall.paywallKey,
    });
    close();
    navigation.navigate(RouteNames.GuideOffersRecap);
  };

  const handleDismissLater = () => {
    trackSubscriptionFunnelEvent('paywall_dismissed', {
      abBucket: funnelAbBucket,
      paywallKey: paywall.paywallKey,
      slotCount: selectedTierId,
    });
    close();
  };

  // Une offre Club couvre un club : le club du contexte de l'action d'abord (les
  // installations qu'on voulait gerer), a defaut celui du compte. Le serveur refuse
  // l'achat sans lui (subscription-billing.ts:427).
  const purchaseClubDocumentId = String(
    clubDocumentId || userData?.club?.documentId || '',
  ).trim();

  // Achat direct dans la sheet. Aujourd'hui : mode test backend (trustedValidation) —
  // Purchases.purchase (RevenueCat) se branchera ici a l'item 14 du plan.
  const handlePurchase = async () => {
    if (!selectedEntry || purchaseMutation.isPending) {
      return;
    }

    if (!isSubscriptionPurchaseAvailable()) {
      Alert.alert(
        'Checkout indisponible',
        'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
      );
      return;
    }

    const isClubPurchase = sellingScope === 'CLUB';
    if (isClubPurchase && !purchaseClubDocumentId) {
      Alert.alert(
        'Club requis',
        "Rattache d'abord ton compte à un club avant de prendre une offre Club.",
      );
      return;
    }

    const slotCount = Number(selectedEntry?.slotCount || 0);
    trackSubscriptionFunnelEvent('paywall_purchase_started', {
      abBucket: funnelAbBucket,
      paywallKey: paywall.paywallKey,
      planCode: String(selectedEntry?.planCode || ''),
      slotCount,
    });
    const availableTeams = (userData?.myTeams || []).concat(userData?.trainedTeams || []);

    try {
      await purchaseMutation.mutateAsync({
        catalogEntry: selectedEntry,
        clubDocumentId: isClubPurchase ? purchaseClubDocumentId : undefined,
        payerUserDocumentId: String(userData?.documentId || '').trim(),
        // Une offre Club couvre tout le club : elle n'occupe aucun slot d'equipe.
        teamDocumentIds: isClubPurchase ? [] : getInitialTeamSelection({
          availableTeams,
          coveredTeamDocumentIds: getSubscriptionTeamSlotSummary(subscriptionSummary)
            .coveredTeamDocumentIds,
          slotCount,
        }),
      });
      trackSubscriptionFunnelEvent('paywall_purchase_succeeded', {
        abBucket: funnelAbBucket,
        paywallKey: paywall.paywallKey,
        planCode: String(selectedEntry?.planCode || ''),
        slotCount,
      });
      // Les droits arrivent par le webhook du store, quelques secondes apres la
      // reussite cote client : le calendrier de convergence relit jusqu'a ce que
      // l'etat bouge, sans dependre de l'ecran affiche (L08).
      scheduleSubscriptionStateRefresh(queryClient);
      close();
      const renewalDate = new Date();
      if (String(selectedEntry?.billingPeriod || '').trim().toLowerCase() === 'monthly') {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }
      navigation.navigate(RouteNames.SubscriptionSuccess, {
        // La portee vient de l'ACHAT, pas du cache d'abonnement : juste apres
        // l'achat, le webhook du store n'a pas encore converge (L08). L'ecran
        // de succes en deduit la liste de ce qui est reellement debloque (L11).
        clubDocumentId: isClubPurchase ? purchaseClubDocumentId : undefined,
        offerLabel: isClubPurchase
          ? String(selectedTierOption?.label || 'Club')
          : `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
        offerScope: isClubPurchase ? 'CLUB' : 'TEAM',
        renewalDateLabel: format(renewalDate, 'd MMMM yyyy', { locale: fr }),
        resumeCtaLabel: sellingSheet?.successCtaLabel || 'Reprendre',
      });
    } catch (error) {
      trackSubscriptionFunnelEvent('paywall_purchase_failed', {
        abBucket: funnelAbBucket,
        paywallKey: paywall.paywallKey,
        planCode: String(selectedEntry?.planCode || ''),
        slotCount,
      });
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  };

  /* ---------- Feuille de vente v2 (paliers Équipe ou paliers Club) ---------- */
  if (sellingSheet) {
    const selectedTierLabel = String(selectedTierOption?.label || '');
    const priceCents = Number(selectedEntry?.referencePriceEurCents);
    const priceAmountLabel = Number.isFinite(priceCents) && priceCents > 0
      ? `${(priceCents / 100).toFixed(2).replace('.', ',')} €`
      : '';
    const isYearlySelected = billingPeriod === 'yearly';
    const priceSuffix = isYearlySelected ? '/an' : '/mois';
    // Equivalence mensuelle : uniquement sur l'ancre annuelle.
    const monthlyLabel = isYearlySelected
      ? formatSubscriptionMonthlyEquivalentLabel(selectedEntry?.referencePriceEurCents)
      : '';
    // Remise calculee sur les DEUX prix du palier retenu. Sans jumelle mensuelle
    // dans le catalogue, le libelle est vide : on n'invente jamais une remise.
    const discountLabel = isYearlySelected
      ? formatSubscriptionYearlyDiscountLabel(
        findSubscriptionMonthlySiblingEntry(catalogEntries, selectedEntry)?.referencePriceEurCents,
        selectedEntry?.referencePriceEurCents,
      )
      : '';
    const isCatalogLoading = catalogQuery.isLoading;
    // Le catalogue serveur est STATIQUE et ne peut jamais etre vide : un catalogue
    // absent une fois le chargement fini est toujours un probleme de transport.
    // Sans cet etat, la feuille restait bloquee sur « Chargement des tarifs… ».
    const isCatalogUnavailable = !isCatalogLoading && tierOptions.length === 0;
    const purchasing = purchaseMutation.isPending;
    // Ce qui distingue Club S / M / L : le nombre d'equipes couvertes. Sans lui,
    // le palier n'est qu'un prix sans critere de choix.
    const clubTierMaxTeams = Number(selectedEntry?.maxTeams);
    let clubTierCoverageLabel = '';
    if (sellingScope === 'CLUB' && selectedEntry) {
      clubTierCoverageLabel = Number.isFinite(clubTierMaxTeams) && clubTierMaxTeams > 0
        ? `Jusqu'à ${clubTierMaxTeams} équipes du club`
        : 'Équipes du club illimitées';
    }
    let ctaLabel = 'Chargement des tarifs…';
    if (!isCatalogLoading && !isCatalogUnavailable) {
      ctaLabel = (sellingScope === 'TEAM' && selectedTierId === 1)
        ? 'Débloquer mon équipe'
        : `Débloquer ${selectedTierLabel}`;
    }

    return (
      <BottomModal
        close={close}
        isVisible={isVisible}
        scrollable={false}
      >
        <View style={[Spaces.paddingTop[16], Spaces.paddingBottom[8], Spaces.gap[16]]}>
          <View style={Spaces.gap[8]}>
            <Text
              style={[
                Fonts.p4Bold,
                Fonts.primary500,
                { letterSpacing: 1.5, textTransform: 'uppercase' },
              ]}
            >
              {sellingSheet.kicker}
            </Text>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {sellingSheet.title}
            </Text>
            {clubSheetContent ? (
              <Text style={[Fonts.p2, Fonts.neutral300]}>
                {clubSheetContent.description}
              </Text>
            ) : null}
          </View>

          {contextLabel ? (
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[8],
                {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                },
              ]}
            >
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                {contextLabel}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
                ✓ brouillon conservé
              </Text>
            </View>
          ) : null}

          {isCatalogLoading ? (
            <View style={[Spaces.gap[12]]}>
              <View
                style={[
                  ApplicationStyle.borderRadius100,
                  { backgroundColor: 'rgba(255,255,255,0.10)', height: 52 },
                ]}
              />
              <View
                style={[
                  ApplicationStyle.borderRadius12,
                  { backgroundColor: 'rgba(255,255,255,0.10)', height: 34, width: 160 },
                ]}
              />
            </View>
          ) : null}

          {isCatalogUnavailable ? (
            <View style={Spaces.gap[4]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Tarifs indisponibles
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                Impossible de charger les tarifs pour le moment. Vérifie ta
                connexion puis réessaie.
              </Text>
            </View>
          ) : null}

          {!isCatalogLoading && !isCatalogUnavailable ? (
            <>
              {hasMonthlyTierOptions ? (
                <TierSelector
                  onChange={(periodId) => setBillingPeriod(String(periodId))}
                  options={BILLING_PERIOD_OPTIONS}
                  value={billingPeriod}
                />
              ) : null}
              <TierSelector
                onChange={(tierId) => {
                  const nextTierId = Number(tierId);
                  const nextOption = tierOptions.find((option) => option.id === nextTierId);
                  setSelectedTierId(nextTierId);
                  trackSubscriptionFunnelEvent('paywall_tier_selected', {
                    abBucket: funnelAbBucket,
                    paywallKey: paywall.paywallKey,
                    planCode: String(nextOption?.entry?.planCode || ''),
                    slotCount: nextTierId,
                  });
                }}
                options={tierOptions}
                value={selectedTierId}
              />
              <View style={[Alignments.row, { alignItems: 'baseline' }, Spaces.gap[8]]}>
                <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
                  {priceAmountLabel}
                </Text>
                <Text style={[Fonts.p2Bold, Fonts.neutral300]}>{priceSuffix}</Text>
                {discountLabel ? (
                  <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
                    {discountLabel}
                  </Text>
                ) : null}
                <View style={Alignments.fill} />
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {monthlyLabel}
                </Text>
              </View>
              {clubTierCoverageLabel ? (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {clubTierCoverageLabel}
                </Text>
              ) : null}
            </>
          ) : null}

          <View style={Spaces.gap[8]}>
            {sellingSheet.benefits.map((benefit) => (
              <View
                key={benefit}
                style={[Alignments.row, Spaces.gap[8]]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>
                <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          <View style={Spaces.gap[4]}>
            {isCatalogUnavailable ? (
              <Button
                onPress={() => catalogQuery.refetch?.()}
                title="Réessayer"
                variant="Primary"
              />
            ) : (
              <Button
                disabled={isCatalogLoading}
                isLoading={purchasing}
                onPress={handlePurchase}
                title={purchasing ? 'Achat en cours…' : ctaLabel}
                variant="Primary"
              />
            )}
            <View
              style={[
                Alignments.row,
                Alignments.justifyCenter,
                Alignments.alignCenter,
                { columnGap: 22 },
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleCompareOffers}
                style={Spaces.paddingVertical[12]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  Comparer les offres
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleDismissLater}
                style={Spaces.paddingVertical[12]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral300]}>
                  Plus tard
                </Text>
              </TouchableOpacity>
            </View>
            <LegalFooter restore={false} />
          </View>
        </View>
      </BottomModal>
    );
  }

  /* ---------- Paywalls non-quota : presentation legacy ---------- */
  const recommendedEntryMeta = recommendedEntry
    ? getSubscriptionCatalogEntryMeta(recommendedEntry)
    : null;
  const recommendedPriceLabel = formatSubscriptionPriceLabel(
    recommendedEntry?.referencePriceEurCents,
    recommendedEntry?.billingPeriod,
  );
  const isRecommendedEntryYearly = String(recommendedEntry?.billingPeriod || '').trim().toLowerCase() === 'yearly';
  // Ancre prix unique : annuel + equivalence mensuelle exacte (jamais d'arrondi « ~ »).
  const monthlyEquivalentLabel = formatSubscriptionMonthlyEquivalentLabel(
    recommendedEntry?.referencePriceEurCents,
  );
  const recommendedPriceLine = isRecommendedEntryYearly && recommendedPriceLabel && monthlyEquivalentLabel
    ? `${recommendedPriceLabel} · ${monthlyEquivalentLabel}`
    : recommendedPriceLabel;

  // R10 — le refus CLUB_VERIFICATION_REQUIRED est supprime (GO Adel 2026-08-02).
  // Il renvoyait le client vers sa fiche club pour y faire une certification que
  // seule la console SuperAdmin peut declencher, et le serveur ne l'emet plus
  // (0 occurrence dans admin/src). Un seul bouton, une seule destination.
  // L33 — le bouton dit ou il mene : depuis un mur payant, il ouvre le
  // carrousel d'offres, pas la page de gestion.
  const primaryActionLabel = t('profile.subscription.actions.viewOffers', 'Voir les offres');

  return (
    <BottomModal
      close={close}
      isVisible={isVisible}
      scrollable={false}
    >
      <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {paywallContent.title}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral300]}>
            {paywallContent.description}
          </Text>
        </View>

        {recommendedEntry ? (
          <View style={[
            Spaces.gap[8],
            Spaces.padding[16],
            ApplicationStyle.borderRadius12,
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.primary100,
            ApplicationStyle.backgroundColor.primary700,
          ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.primary100]}>
              {t('profile.subscription.paywall.recommended', 'Offre recommandee')}
            </Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {recommendedEntryMeta?.label || ''}
            </Text>
            {recommendedPriceLine ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {recommendedPriceLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        {paywallBenefits.length > 0 ? (
          <View style={Spaces.gap[8]}>
            {paywallBenefits.map((benefit) => (
              <View
                key={benefit}
                style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>
                  ✓
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {requiredPlanText ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t('profile.subscription.paywall.requiredPlan', 'Offre requise: {{plans}}.', {
              plans: requiredPlanText,
            })}
          </Text>
        ) : null}

        {planLabels.length > 0 ? (
          <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
            {planLabels.map((planLabel) => (
              <View
                key={planLabel}
                style={{
                  backgroundColor: Colors.primary200,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {planLabel}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {paywall.remainingFreeUses !== null ? (
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t('profile.subscription.paywall.remaining', 'Usages gratuits restants: {{count}}.', {
              count: paywall.remainingFreeUses,
            })}
          </Text>
        ) : null}

        <View style={Spaces.gap[12]}>
          <Button
            onPress={handleOpenSubscription}
            title={primaryActionLabel}
            variant="Primary"
          />
          <LegalFooter />
        </View>
      </View>
    </BottomModal>
  );
}

export default SubscriptionPaywallSheet;
