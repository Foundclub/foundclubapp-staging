import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  ScrollView, Text, useWindowDimensions, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  sortSubscriptionCatalogEntries,
} from '@/domains/subscription/subscriptionBilling';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getSubscriptionCatalog } from '@/services/subscription/subscriptionService';

const PRICE_UNAVAILABLE_LABEL = "Tarif détaillé dans l'offre complète";

const TEAM_OFFER_FEATURES = [
  'Événements illimités',
  "Composition d'équipe",
  'Convocations',
  'Cotisations de ton équipe',
];

const CLUB_OFFER_FEATURES = [
  'Toutes tes équipes incluses',
  'Installations et planning du club',
  'Sponsors et partenaires',
  'Canal de diffusion',
  'Cotisations du club',
];

/**
 * Extract the catalog entries array from the raw catalog response payload.
 * @param {any} payload
 * @returns {any[]}
 */
const getCatalogEntriesFromResponse = (payload) => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

/**
 * Normalize the scope type of a catalog entry.
 * @param {any} entry
 * @returns {string}
 */
const getCatalogEntryScopeType = (entry) => String(entry?.scopeType || '').trim().toUpperCase();

/**
 * Normalize the billing period of a catalog entry.
 * @param {any} entry
 * @returns {string}
 */
const getCatalogEntryBillingPeriod = (entry) => (
  String(entry?.billingPeriod || '').trim().toLowerCase()
);

/**
 * Extract the club tier number encoded in the plan code.
 * @param {any} entry
 * @returns {number}
 */
const getCatalogEntryClubTier = (entry) => (
  Number(String(entry?.planCode || '').match(/tier_(\d+)/)?.[1] || 0)
);

/**
 * Build the "soit X €/mois" helper label for a yearly catalog entry.
 * @param {any} entry
 * @returns {string}
 */
const getYearlyMonthlyEquivalentLabel = (entry) => {
  if (getCatalogEntryBillingPeriod(entry) !== 'yearly') {
    return '';
  }

  return formatSubscriptionMonthlyEquivalentLabel(entry?.referencePriceEurCents);
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
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.8, textTransform: 'uppercase' }]}>
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
 * A single offer card used inside the guided tour recap screen.
 * @param {{
 *   badgeLabel: string | null;
 *   features: string[];
 *   highlighted: boolean;
 *   isWide: boolean;
 *   priceHint: string | null;
 *   priceLabel: string;
 *   pricePrefix: string | null;
 *   subtitle: string;
 *   title: string;
 * }} props
 * @returns {import('react').ReactElement}
 */
function OfferCard({
  badgeLabel,
  features,
  highlighted,
  isWide,
  priceHint,
  priceLabel,
  pricePrefix,
  subtitle,
  title,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[
      isWide ? Alignments.fill : null,
      Spaces.gap[12],
      Spaces.padding[16],
      ApplicationStyle.borderRadius16,
      ApplicationStyle.borderWidth1,
      highlighted
        ? ApplicationStyle.borderColor.primary500
        : ApplicationStyle.borderColor.neutral600,
      ApplicationStyle.backgroundColor.neutral700,
    ]}
    >
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.gap[8],
      ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        {badgeLabel ? (
          <View style={[
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[4],
            ApplicationStyle.borderRadius12,
            ApplicationStyle.backgroundColor.primary500,
          ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.primary900]}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[Fonts.p2, Fonts.neutral200]}>{subtitle}</Text>

      <View style={[Spaces.gap[4]]}>
        {priceLabel && pricePrefix ? (
          <Text style={[Fonts.p4, Fonts.primary100]}>{pricePrefix}</Text>
        ) : null}
        {priceLabel ? (
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>{priceLabel}</Text>
        ) : null}
        {priceLabel && priceHint ? (
          <Text style={[Fonts.p4, Fonts.primary100]}>{priceHint}</Text>
        ) : null}
        {!priceLabel ? (
          <Text style={[Fonts.p4, Fonts.neutral200]}>{PRICE_UNAVAILABLE_LABEL}</Text>
        ) : null}
      </View>

      <View style={[Spaces.gap[4]]}>
        {features.map((feature) => (
          <View key={feature} style={[Alignments.row, Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.success500]}>✓</Text>
            <Text style={[Alignments.fill, Fonts.p2, Fonts.neutral100]}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Guided tour recap screen presenting the Free / Team / Club offers with prices.
 * @param {{ navigation?: any }} props
 * @returns {import('react').ReactElement}
 */
function GuideOffersRecap({ navigation }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { getPostOnboardingHomeRoute } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const catalogQuery = useQuery({
    queryFn: getSubscriptionCatalog,
    queryKey: ['subscription-catalog'],
    staleTime: 1000 * 60 * 10,
  });

  const catalogEntries = useMemo(
    () => sortSubscriptionCatalogEntries(getCatalogEntriesFromResponse(catalogQuery.data)),
    [catalogQuery.data],
  );

  const teamOfferEntry = useMemo(() => {
    const teamYearlyEntries = catalogEntries.filter(
      (entry) => getCatalogEntryScopeType(entry) === 'TEAM'
        && getCatalogEntryBillingPeriod(entry) === 'yearly',
    );

    return teamYearlyEntries.find((entry) => Number(entry?.slotCount || 0) === 1)
      || teamYearlyEntries[0]
      || null;
  }, [catalogEntries]);

  const clubOfferEntry = useMemo(() => {
    const clubYearlyEntries = catalogEntries
      .filter((entry) => getCatalogEntryScopeType(entry) === 'CLUB'
        && getCatalogEntryBillingPeriod(entry) === 'yearly')
      .sort((left, right) => getCatalogEntryClubTier(left) - getCatalogEntryClubTier(right));

    return clubYearlyEntries.find((entry) => getCatalogEntryClubTier(entry) === 1)
      || clubYearlyEntries[0]
      || null;
  }, [catalogEntries]);

  const teamPriceLabel = teamOfferEntry
    ? formatSubscriptionPriceLabel(teamOfferEntry?.referencePriceEurCents, 'yearly')
    : '';
  const teamMonthlyLabel = getYearlyMonthlyEquivalentLabel(teamOfferEntry);
  const clubPriceLabel = clubOfferEntry
    ? formatSubscriptionPriceLabel(clubOfferEntry?.referencePriceEurCents, 'yearly')
    : '';

  const handleChooseOffer = () => {
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  };

  const handleLater = () => {
    const homeRoute = typeof getPostOnboardingHomeRoute === 'function'
      ? getPostOnboardingHomeRoute()
      : RouteNames.HomeTab;
    navigation.navigate(homeRoute);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[12], Spaces.paddingTop[0]]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[24], Spaces.paddingTop[12]]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            Voilà tout ce que FoundClub peut faire pour toi
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Récapitulatif de ton tour guidé. Choisis l&apos;offre qui colle à ton équipe
            ou à ton club.
          </Text>
        </View>

        <View style={[
          isWide ? Alignments.row : Alignments.column,
          isWide ? Alignments.alignStretch : null,
          Spaces.gap[16],
        ]}
        >
          <AcquisCard />
          <OfferCard
            badgeLabel="Populaire"
            features={TEAM_OFFER_FEATURES}
            highlighted
            isWide={isWide}
            priceHint={teamMonthlyLabel || null}
            priceLabel={teamPriceLabel}
            pricePrefix={null}
            subtitle="Pour ta ou tes équipes"
            title="Équipe"
          />
          <OfferCard
            badgeLabel={null}
            features={CLUB_OFFER_FEATURES}
            highlighted={false}
            isWide={isWide}
            priceHint={null}
            priceLabel={clubPriceLabel}
            pricePrefix={clubPriceLabel ? 'à partir de' : null}
            subtitle="Pour tout le club"
            title="Club"
          />
        </View>

        <View style={[Spaces.gap[12]]}>
          <Button onPress={handleChooseOffer} title="Choisir mon offre" variant="Primary" />
          <Button onPress={handleLater} title="Plus tard" variant="SecondaryLight" />
          <LegalFooter />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default GuideOffersRecap;
