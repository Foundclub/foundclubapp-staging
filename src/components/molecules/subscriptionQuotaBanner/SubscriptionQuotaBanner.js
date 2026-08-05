import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { getSubscriptionQuotaItem } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

// Corps du bandeau « quota épuisé » par type de quota (microcopy validée du handoff —
// rappelle que le contenu gratuit reste actif, puis nomme le déblocage).
/** @type {Record<string, string>} */
const EXHAUSTED_BODY_BY_QUOTA_TYPE = {
  EVENT_PUBLISH: "Ton événement gratuit est déjà en ligne. Passe à l'illimité : entraînements, matchs, tournois…",
  FREE_TEAM: "Ta 1ʳᵉ équipe reste active. Débloque l'offre Équipe pour en créer d'autres.",
  RECRUITMENT_AD_PUBLISH: "Ton annonce gratuite est déjà en ligne. Recrute sans limite avec l'offre Équipe.",
};

/**
 * Bandeau proactif de quota gratuit affiche en entree de wizard.
 * Purement informatif: ne bloque jamais la progression du wizard.
 * @param {object} props
 * @param {string} props.quotaType - 'EVENT_PUBLISH' | 'FREE_TEAM' | 'RECRUITMENT_AD_PUBLISH'
 * @param {string} props.label - Libelle du contenu concerne, ex. 'Evenements'
 * @param {string} [props.resumeRouteName] - L40 : ou ramener la personne apres
 *   l'achat, exprime depuis le navigateur RACINE (ex. 'EventStack').
 * @param {Record<string, any>} [props.resumeRouteParams] - Cible imbriquee
 *   ({ screen, params }) de cette route racine.
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionQuotaBanner({
  label,
  quotaType,
  resumeRouteName = '',
  resumeRouteParams = undefined,
}) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    freeUsageSummary,
    subscriptionAccessLevel,
    userData,
  } = useAuth();

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionQuota = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  const quotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, quotaType, subscriptionAccessLevel),
    [freeUsageSummary, quotaType, subscriptionAccessLevel],
  );

  if (!canShowSubscriptionQuota) {
    return null;
  }

  // Le SEUL juge des compteurs gratuits est `getSubscriptionQuotaItem`
  // (subscriptionDecision.js) : il rend `null` des que l'utilisateur a paye,
  // offre Équipe comme offre Club — CERTIFIEE OU NON (cf. `hasActiveClubOffer`).
  // La condition qui vivait ici recopiait la sienne a la main et n'a pas suivi :
  // elle laissait passer CLUB_UNVERIFIED, donc on revendait du gratuit a un
  // abonne Club. On ne rejuge plus, on demande — le `if (!quotaItem)` ci-dessous
  // suffit desormais.
  // Reste le seul garde-fou propre a ce bandeau : tant que le niveau n'est pas
  // connu (bootstrap en cours), on n'affiche aucun argument de vente.
  if (!subscriptionAccessLevel) {
    return null;
  }

  if (!quotaItem) {
    return null;
  }

  const isQuotaExhausted = quotaItem.remaining <= 0;
  // FREE_TEAM compte des creations d'equipe, les autres quotas des publications.
  const quotaNoun = quotaType === 'FREE_TEAM' ? 'création' : 'publication';

  // L33 — cap sur le CARROUSEL : cette personne vient de voir un compteur, elle
  // doit tomber sur des offres achetables, pas sur la page de gestion (qui ne
  // porte plus aucun catalogue).
  // L40 — ce bandeau est affiche EN ENTREE d'assistant : il est la seule piece
  // qui sache d'ou part la personne. Il le dit au catalogue, qui transportera
  // l'information jusqu'a l'ecran de succes. Sans origine fournie, rien n'est
  // ajoute et le comportement d'avant reste mot pour mot.
  const handleOpenOffers = () => {
    navigation.navigate(RouteNames.ProfileStack, {
      ...(resumeRouteName ? { params: { resumeRouteName, resumeRouteParams } } : {}),
      screen: RouteNames.SubscriptionOffers,
    });
  };

  if (isQuotaExhausted) {
    return (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          Spaces.marginBottom[16],
          {
            backgroundColor: `${Colors.warning500}1F`,
            borderColor: `${Colors.warning500}CC`,
          },
        ]}
      >
        <Text style={[Fonts.p2Bold, Fonts.warning400]}>
          {`${label} : quota gratuit épuisé`}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {EXHAUSTED_BODY_BY_QUOTA_TYPE[quotaType]
            || "Débloque l'offre Équipe pour continuer sans limite."}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleOpenOffers}
          style={[Spaces.paddingVertical[8], { alignSelf: 'flex-start' }]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            Débloquer l&apos;offre Équipe →
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[8],
        Spaces.marginBottom[16],
        {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: 'rgba(1, 179, 244, 0.24)',
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.primary500]}>
        {quotaItem.remaining > 1
          ? `${label} : il te reste ${quotaItem.remaining} ${quotaNoun}s gratuites`
          : `${label} : il te reste ${quotaItem.remaining} ${quotaNoun} gratuite`}
      </Text>
    </View>
  );
}

export default SubscriptionQuotaBanner;
