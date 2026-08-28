import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  findSubscriptionMonthlySiblingEntry,
  formatSubscriptionClubTierShortLabel,
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionYearlyDiscountLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  isPerLicenseeSubscriptionEntry,
} from '@/domains/subscription/subscriptionBilling';
import { getSubscriptionTeamSlotSummary } from '@/domains/subscription/subscriptionDecision';
import {
  isSubscriptionPurchaseAvailable,
  performSubscriptionPurchase,
} from '@/domains/subscription/subscriptionPurchaseRail';
import { scheduleSubscriptionStateRefresh } from '@/domains/subscription/subscriptionRefresh';
import { useSubscriptionCatalog } from '@/domains/subscription/useSubscriptionCatalog';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { trackSubscriptionFunnelEvent } from '@/services/subscription/subscriptionService';

// Resume 1 ligne des cartes repliees (decision 3 — carte non selectionnee).
const TEAM_SUMMARY = "Événements illimités, compo, convocations, cotisation d'équipe…";
const CLUB_SUMMARY = 'Installations, sponsors, cotisations du club…';

// Benefices des cartes depliees (handoff pw-core PRICING).
const TEAM_BENEFITS = [
  'Événements et matchs illimités',
  'Composition et convocations en 2 taps',
  "Cotisation d'équipe encaissée dans l'app",
];
const CLUB_BENEFITS = [
  'Équipes du club illimitées',
  'Installations et réservations',
  'Sponsors et partenaires du club',
  "Cotisations du club encaissées dans l'app",
];

// LOT CATALOGUE (2026-08-28) — CE QUI A REMPLACE LA TABLE ECRITE EN DUR. Cet
// ecran portait « S · ≤ 3 » / « M · ≤ 8 » / « L · illim. », une grille recopiee
// dans l'app : le 28/08, les prix et les paliers ont change QUATRE fois dans la
// journee, et une table recopiee est fausse le lendemain. Les pilules se
// deduisent desormais du catalogue serveur (`formatSubscriptionClubTierShortLabel`,
// partage avec le carrousel des offres).

// Selecteur de periode de facturation, global a l'ecran (defaut produit : annuel).
// L38 — la pilule ne porte PLUS de tag de remise : le catalogue a deux grilles
// (Club x10 = -17 %, Equipe x7,5-7,7 = -36/-37 %), et « 2 mois offerts » sous-vendait
// l'offre Equipe de plus de la moitie. La remise est calculee et portee PAR CARTE.
const BILLING_PERIOD_OPTIONS = [
  { id: 'yearly', label: 'Annuel' },
  { id: 'monthly', label: 'Mensuel' },
];

/**
 * @param {any} entry
 * @returns {string}
 */
const getCatalogEntryScopeType = (entry) => String(entry?.scopeType || '').trim().toUpperCase();

/**
 * @param {any} entry
 * @returns {string}
 */
const getCatalogEntryBillingPeriod = (entry) => (
  String(entry?.billingPeriod || '').trim().toLowerCase()
);

/**
 * @param {any} entry
 * @returns {number}
 */
const getCatalogEntryClubTier = (entry) => (
  Number(String(entry?.planCode || '').match(/tier_(\d+)/)?.[1] || 0)
);

/**
 * @param {any} entry
 * @returns {string}
 */
const getEntryPriceAmountLabel = (entry) => {
  const cents = Number(entry?.referencePriceEurCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    return '';
  }
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
};

// Ce que l'utilisateur vient de creer pendant le tour (fusion preuve + Gratuit, decision 5b).
const ACQUIS_PROOF_ITEMS = ['Ton équipe', 'Ton événement', 'Ta compo', 'Ton annonce'];

/**
 * Carte « acquis » : le Gratuit n'est plus une offre a vendre mais un etat atteint.
 * @returns {import('react').ReactElement}
 */
function AcquisCard() {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[
      Spaces.padding[16],
      Spaces.gap[8],
      {
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        borderWidth: 1,
      },
    ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral100]}>Gratuit — 0 €</Text>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
        >
          <Text
            style={[
              Fonts.p4Bold,
              Fonts.neutral300,
              { letterSpacing: 0.8, textTransform: 'uppercase' },
            ]}
          >
            Tu y es
          </Text>
        </View>
      </View>
      <View style={[Alignments.row, { columnGap: 10, flexWrap: 'wrap', rowGap: 4 }]}>
        {ACQUIS_PROOF_ITEMS.map((item) => (
          <View key={item} style={[Alignments.row, Alignments.alignCenter, { columnGap: 4 }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>✓</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.success200 }]}>{item}</Text>
          </View>
        ))}
      </View>
      <Text style={[Fonts.p4, Fonts.neutral400]}>
        Tout reste à toi, à vie — chat illimité inclus.
      </Text>
    </View>
  );
}

/**
 * Ecran Recap des offres, version validee (corps 4a + en-tete 5b).
 * LE moment de vente unique : carte non selectionnee repliee « a partir de »,
 * carte selectionnee depliee (segments -> ancre prix -> benefices), CTA collant
 * qui reflete la selection, achat direct.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement}
 */
function GuideOffersRecap({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const { getPostOnboardingHomeRoute, subscriptionSummary, userData } = useAuth();

  const [selectedOffer, setSelectedOffer] = useState('team');

  // Jalon funnel : arrivee sur le recap des offres (handoff 13).
  useEffect(() => {
    trackSubscriptionFunnelEvent('recap_viewed', { source: 'guide-offers-recap' });
  }, []);
  const [teamSlotCount, setTeamSlotCount] = useState(1);
  const [clubTier, setClubTier] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState('yearly');

  const catalogQuery = useSubscriptionCatalog();
  const catalogEntries = catalogQuery.entries;
  const teamTierEntries = useMemo(() => catalogEntries
    .filter((entry) => getCatalogEntryScopeType(entry) === 'TEAM'
      && getCatalogEntryBillingPeriod(entry) === billingPeriod)
    .sort((left, right) => (
      Number(left?.slotCount || 0) - Number(right?.slotCount || 0)
    )), [billingPeriod, catalogEntries]);
  // S12-B — ⛔ L'OFFRE AU LICENCIE N'EST PAS UN PALIER CLUB, ET DEUX CHOSES
  // CASSAIENT ICI DEPUIS S12-A (mesure du 2026-08-26) :
  //   1. cette liste alimente les pilules de palier SANS filtre de rang
  //      (l. 347-351, contrairement au carrousel et a la feuille qui, eux,
  //      ecartent le rang 0) : une 4e pilule « Tier 0 » apparaissait ;
  //   2. le tri par numero de palier la placait EN TETE (rang 0), donc
  //      `firstEntry` la designait et la carte repliee annoncait
  //      « a partir de 2,50 EUR/an » pour l'offre Club — au lieu de 199,99 EUR.
  // Le recap du tour guide vend les PALIERS (decision D1 : le mode au licencie
  // vit dans le carrousel et la feuille de vente, pas ici). On l'ecarte donc,
  // par `pricingModel` et jamais par son code de plan.
  const clubTierEntries = useMemo(() => catalogEntries
    .filter((entry) => getCatalogEntryScopeType(entry) === 'CLUB'
      && getCatalogEntryBillingPeriod(entry) === billingPeriod
      && !isPerLicenseeSubscriptionEntry(entry))
    .sort((left, right) => (
      getCatalogEntryClubTier(left) - getCatalogEntryClubTier(right)
    )), [billingPeriod, catalogEntries]);
  const hasMonthlyEntries = useMemo(() => catalogEntries
    .some((entry) => getCatalogEntryScopeType(entry) === 'TEAM'
      && getCatalogEntryBillingPeriod(entry) === 'monthly'), [catalogEntries]);

  const selectedTeamEntry = useMemo(
    () => teamTierEntries.find((entry) => Number(entry?.slotCount || 0) === teamSlotCount)
      || teamTierEntries[0]
      || null,
    [teamSlotCount, teamTierEntries],
  );
  const selectedClubEntry = useMemo(
    () => clubTierEntries.find((entry) => getCatalogEntryClubTier(entry) === clubTier)
      || clubTierEntries[0]
      || null,
    [clubTier, clubTierEntries],
  );

  const currentClubDocumentId = String(userData?.club?.documentId || '').trim();
  const isCatalogLoading = catalogQuery.isLoading;
  const isCatalogError = catalogQuery.isError
    || (!catalogQuery.isLoading && teamTierEntries.length === 0);

  const selectedEntry = selectedOffer === 'club' ? selectedClubEntry : selectedTeamEntry;
  const selectedOfferName = selectedOffer === 'club'
    // Le nom vendu est celui du catalogue serveur (« Club 100 »), jamais un nom
    // reconstruit ici : l'ecran des offres et « Mon abonnement » doivent dire
    // le meme mot que ce recap.
    ? (String(selectedClubEntry?.displayName || '').trim() || 'Club')
    : 'Équipe';
  const selectedPriceAmountLabel = getEntryPriceAmountLabel(selectedEntry);
  const isYearlyPeriod = billingPeriod === 'yearly';
  const billingPeriodSuffix = isYearlyPeriod ? '/an' : '/mois';

  const purchaseMutation = useMutation({
    mutationFn: async (/** @type {any} */ purchaseInput) => (
      performSubscriptionPurchase(purchaseInput)
    ),
  });

  const handleLater = () => {
    const homeRoute = typeof getPostOnboardingHomeRoute === 'function'
      ? getPostOnboardingHomeRoute()
      : RouteNames.HomeTab;
    navigation.navigate(homeRoute);
  };

  // Achat direct depuis le Recap (mode test backend — RevenueCat a l'item 14).
  const handleUnlock = async () => {
    if (!selectedEntry || purchaseMutation.isPending || isCatalogLoading || isCatalogError) {
      return;
    }

    if (!isSubscriptionPurchaseAvailable()) {
      Alert.alert(
        'Checkout indisponible',
        'Le checkout store réel sera branché dans une prochaine vague. Utilise le mode test local ou staging pour la recette complète.',
      );
      return;
    }

    const isClubPurchase = selectedOffer === 'club';
    if (isClubPurchase && !currentClubDocumentId) {
      Alert.alert(
        'Club requis',
        "Rattache d'abord ton compte à un club avant de prendre une offre Club.",
      );
      return;
    }

    const slotCount = Number(selectedEntry?.slotCount || 0);
    trackSubscriptionFunnelEvent('recap_unlock_started', {
      planCode: String(selectedEntry?.planCode || ''),
      slotCount,
      source: selectedOffer,
    });
    const availableTeams = (userData?.myTeams || []).concat(userData?.trainedTeams || []);

    try {
      await purchaseMutation.mutateAsync({
        catalogEntry: selectedEntry,
        clubDocumentId: isClubPurchase ? currentClubDocumentId : undefined,
        payerUserDocumentId: String(userData?.documentId || '').trim(),
        teamDocumentIds: isClubPurchase ? [] : getInitialTeamSelection({
          availableTeams,
          coveredTeamDocumentIds: getSubscriptionTeamSlotSummary(subscriptionSummary)
            .coveredTeamDocumentIds,
          slotCount,
        }),
      });
      trackSubscriptionFunnelEvent('recap_unlock_succeeded', {
        planCode: String(selectedEntry?.planCode || ''),
        slotCount,
        source: selectedOffer,
      });
      // Les droits arrivent par le webhook du store, quelques secondes apres la
      // reussite cote client : le calendrier de convergence relit jusqu'a ce que
      // l'etat bouge, sans dependre de l'ecran affiche (L08).
      scheduleSubscriptionStateRefresh(queryClient);
      const renewalDate = new Date();
      if (getCatalogEntryBillingPeriod(selectedEntry) === 'monthly') {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }
      navigation.navigate(RouteNames.SubscriptionSuccess, {
        // La portee vient de l'ACHAT, pas du cache d'abonnement : juste apres
        // l'achat, le webhook du store n'a pas encore converge (L08). L'ecran
        // de succes en deduit la liste de ce qui est reellement debloque (L11).
        clubDocumentId: isClubPurchase ? currentClubDocumentId : undefined,
        offerLabel: isClubPurchase
          ? selectedOfferName
          : `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
        offerScope: isClubPurchase ? 'CLUB' : 'TEAM',
        renewalDateLabel: format(renewalDate, 'd MMMM yyyy', { locale: fr }),
        resumeCtaLabel: "C'est parti !",
        resumeMode: 'home',
      });
    } catch (error) {
      trackSubscriptionFunnelEvent('recap_unlock_failed', {
        planCode: String(selectedEntry?.planCode || ''),
        slotCount,
        source: selectedOffer,
      });
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
    }
  };

  /**
   * Carte d'offre selectionnable (repliee / depliee).
   * @param {'team' | 'club'} offerKey
   * @returns {import('react').ReactElement}
   */
  const renderOfferCard = (offerKey) => {
    const isClub = offerKey === 'club';
    const isSelected = selectedOffer === offerKey;
    const offerName = isClub ? 'Club' : 'Équipe';
    const offerSub = isClub
      ? 'Pour les dirigeants — tout le club'
      : 'Pour les coachs — ta ou tes équipes';
    const entries = isClub ? clubTierEntries : teamTierEntries;
    const firstEntry = entries[0] || null;
    const summary = isClub ? CLUB_SUMMARY : TEAM_SUMMARY;
    const benefits = isClub ? CLUB_BENEFITS : TEAM_BENEFITS;
    const tierOptions = isClub
      ? entries.map((entry) => {
        const tier = getCatalogEntryClubTier(entry);
        return { id: tier, label: formatSubscriptionClubTierShortLabel(entry) };
      })
      : entries.map((entry) => {
        const slotCount = Number(entry?.slotCount || 0);
        return { id: slotCount, label: `${slotCount} équipe${slotCount > 1 ? 's' : ''}` };
      });
    const selectedTierId = isClub ? clubTier : teamSlotCount;
    const cardEntry = isClub ? selectedClubEntry : selectedTeamEntry;
    const cardPriceAmount = getEntryPriceAmountLabel(cardEntry);
    // Equivalence mensuelle : uniquement sur l'ancre annuelle.
    const cardMonthlyLabel = isYearlyPeriod
      ? formatSubscriptionMonthlyEquivalentLabel(cardEntry?.referencePriceEurCents)
      : '';
    // Remise calculee sur les DEUX prix de CETTE carte. Sans jumelle mensuelle
    // dans le catalogue, le libelle est vide : on n'invente jamais une remise.
    const cardDiscountLabel = isYearlyPeriod
      ? formatSubscriptionYearlyDiscountLabel(
        findSubscriptionMonthlySiblingEntry(catalogEntries, cardEntry)?.referencePriceEurCents,
        cardEntry?.referencePriceEurCents,
      )
      : '';

    const cardBackgroundColor = isSelected
      ? 'rgba(1,179,244,0.10)'
      : 'rgba(255,255,255,0.04)';

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        activeOpacity={0.9}
        key={offerKey}
        onPress={() => {
          setSelectedOffer(offerKey);
          trackSubscriptionFunnelEvent('recap_offer_selected', { source: offerKey });
        }}
        style={{
          backgroundColor: cardBackgroundColor,
          borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.10)',
          borderRadius: 20,
          borderWidth: 1.5,
          paddingBottom: 18,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {offerName}
          </Text>
          {!isClub ? (
            <View style={{
              backgroundColor: Colors.primary500,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
            >
              <Text
                style={[
                  Fonts.p4Bold,
                  Fonts.primary900,
                  { letterSpacing: 0.8, textTransform: 'uppercase' },
                ]}
              >
                Populaire
              </Text>
            </View>
          ) : null}
          <View style={Alignments.fill} />
          <View style={{
            alignItems: 'center',
            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
            borderColor: isSelected ? Colors.primary500 : Colors.neutral600,
            borderRadius: 999,
            borderWidth: 2,
            height: 22,
            justifyContent: 'center',
            width: 22,
          }}
          >
            {isSelected ? (
              <Text style={{ color: Colors.primary900, fontSize: 12, fontWeight: '900' }}>✓</Text>
            ) : null}
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>
          {offerSub}
        </Text>

        {isCatalogLoading ? (
          <View style={[Spaces.gap[8], Spaces.marginTop[12]]}>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8, height: 26, width: 128,
            }}
            />
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 7, height: 12, width: 94,
            }}
            />
          </View>
        ) : null}

        {!isCatalogLoading && isSelected ? (
          <>
            <View style={Spaces.marginTop[12]}>
              <TierSelector
                onChange={(tierId) => (isClub
                  ? setClubTier(Number(tierId))
                  : setTeamSlotCount(Number(tierId)))}
                options={tierOptions}
                value={selectedTierId}
              />
            </View>
            <View
              style={[
                Alignments.row,
                { alignItems: 'baseline' },
                Spaces.gap[8],
                Spaces.marginTop[12],
              ]}
            >
              <Text style={[Fonts.h2Bold, Fonts.neutral00]}>
                {cardPriceAmount}
              </Text>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{billingPeriodSuffix}</Text>
              {cardDiscountLabel ? (
                <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
                  {cardDiscountLabel}
                </Text>
              ) : null}
              <View style={Alignments.fill} />
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {cardMonthlyLabel}
              </Text>
            </View>
            <View style={[Spaces.gap[8], Spaces.marginTop[12]]}>
              {benefits.map((benefit) => (
                <View key={benefit} style={[Alignments.row, Spaces.gap[8]]}>
                  <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>✓</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!isCatalogLoading && !isSelected ? (
          <>
            <View
              style={[
                Alignments.row,
                { alignItems: 'baseline' },
                Spaces.gap[8],
                Spaces.marginTop[12],
              ]}
            >
              <Text
                style={[
                  Fonts.p4Bold,
                  Fonts.primary200,
                  { textTransform: 'uppercase' },
                ]}
              >
                à partir de
              </Text>
              <Text style={[Fonts.h5Bold, Fonts.neutral00]}>
                {getEntryPriceAmountLabel(firstEntry)}
                {billingPeriodSuffix}
              </Text>
            </View>
            <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[8]]}>
              {summary}
            </Text>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  let ctaTitle = `Débloquer ${selectedOfferName}`;
  if (isCatalogLoading) {
    ctaTitle = 'Chargement des tarifs…';
  } else if (isCatalogError) {
    ctaTitle = 'Tarifs indisponibles';
  } else if (selectedPriceAmountLabel) {
    ctaTitle = `Débloquer ${selectedOfferName} · ${selectedPriceAmountLabel}${billingPeriodSuffix}`;
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[12], Spaces.paddingTop[0]]}
    >
      <View style={[Alignments.fill]}>
        <ScrollView
          contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24], Spaces.paddingTop[12]]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Fonts.h2Bold, Fonts.neutral00]}>
            Ton équipe est prête.
            {' '}
            <Text style={[Fonts.h2Bold, Fonts.primary500]}>Débloque la suite.</Text>
          </Text>

          <AcquisCard />

          {isCatalogError ? (
            <View
              style={[
                Alignments.alignCenter,
                Spaces.gap[12],
                {
                  backgroundColor: 'rgba(255,40,79,0.07)',
                  borderColor: 'rgba(255,40,79,0.45)',
                  borderRadius: 20,
                  borderWidth: 1,
                  paddingHorizontal: 20,
                  paddingVertical: 26,
                },
              ]}
            >
              <Text style={[Fonts.h5Bold, Fonts.neutral00, Fonts.textCenter]}>
                Impossible de charger les tarifs
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
                Vérifie ta connexion et réessaie. Tes créations sont bien enregistrées.
              </Text>
              <Button
                onPress={() => catalogQuery.refetch()}
                title="Réessayer"
                variant="Secondary"
              />
            </View>
          ) : (
            <>
              {hasMonthlyEntries && !isCatalogLoading ? (
                <TierSelector
                  onChange={(periodId) => setBillingPeriod(String(periodId))}
                  options={BILLING_PERIOD_OPTIONS}
                  value={billingPeriod}
                />
              ) : null}
              {renderOfferCard('team')}
              {renderOfferCard('club')}
              <Text style={[Fonts.p4, Fonts.neutral300, Fonts.textCenter]}>
                Résiliable à tout moment · Paiement App Store / Google Play
              </Text>
            </>
          )}
        </ScrollView>

        <View style={[Spaces.gap[4], Spaces.paddingTop[8]]}>
          <Button
            disabled={isCatalogLoading || isCatalogError}
            isLoading={purchaseMutation.isPending}
            onPress={handleUnlock}
            title={purchaseMutation.isPending ? 'Achat en cours…' : ctaTitle}
            variant="Primary"
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleLater}
            style={Spaces.paddingVertical[12]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral200, Fonts.textCenter]}>
              Plus tard
            </Text>
          </TouchableOpacity>
          <LegalFooter />
        </View>
      </View>
    </ScreenContainer>
  );
}

export default GuideOffersRecap;
