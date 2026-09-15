import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  getCoveringEntitlement,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

// Corps du bandeau « quota épuisé » par type de quota (microcopy validée du handoff —
// rappelle que le contenu gratuit reste actif, puis nomme le déblocage).
// I18N-1 : lue par le t du composant (une table evaluee au chargement ne suivrait pas la langue).
/**
 * Le corps du bandeau « quota épuisé », dans la langue de l'app.
 * @param {Function} t - La fonction de traduction du composant.
 * @returns {Record<string, string>} Le corps du bandeau par type de quota.
 */
const exhaustedBodyByQuotaType = (t) => ({
  EVENT_PUBLISH: t(
    'subscriptionQuotaBanner.exhaustedBody.eventPublish',
    "Ton événement gratuit est déjà en ligne. Passe à l'illimité : "
      + 'entraînements, matchs, tournois…',
  ),
  FREE_TEAM: t(
    'subscriptionQuotaBanner.exhaustedBody.freeTeam',
    "Ta 1ʳᵉ équipe reste active. Débloque l'offre Équipe pour en créer d'autres.",
  ),
  RECRUITMENT_AD_PUBLISH: t(
    'subscriptionQuotaBanner.exhaustedBody.recruitmentAdPublish',
    "Ton annonce gratuite est déjà en ligne. Recrute sans limite avec l'offre Équipe.",
  ),
});

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
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const {
    entitlementsSummary,
    freeUsageSummary,
    subscriptionAccessLevel,
    subscriptionSummary,
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

  // D59 ⑤ — « Deja couvert » : quelqu'un d'autre paie pour cette equipe / ce club.
  const coveringEntitlement = useMemo(
    () => getCoveringEntitlement({
      entitlementsSummary,
      subscriptionAccessLevel,
      subscriptionSummary,
      userDocumentId: userData?.documentId,
    }),
    [entitlementsSummary, subscriptionAccessLevel, subscriptionSummary, userData?.documentId],
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

  // D59 ⑤ — LE BANDEAU « DEJA COUVERT » (pack `pw-screens.jsx`, variante
  // `covered` de `QuotaBanner`). Il se pose ICI, juste avant le silence : quand
  // quelqu'un d'autre paie, `getSubscriptionQuotaItem` rend `null` et ce
  // composant ne disait plus rien du tout. La personne entrait dans l'assistant
  // sans savoir pourquoi plus aucun compteur ne s'affichait.
  //
  // 🔒 Il annonce que la personne n'a rien a payer : la condition vit dans
  // `getCoveringEntitlement`, qui exige les TROIS a la fois — niveau d'acces
  // connu et non gratuit, aucun plan paye par elle, et un tiers NOMME qui paie.
  // Sans nom de payeur, pas de bandeau : on ne peut pas expliquer la couverture.
  if (coveringEntitlement) {
    const paidBy = coveringEntitlement?.paidBy || {};
    const firstname = String(paidBy?.firstname || '').trim();
    const lastnameInitial = String(paidBy?.lastname || '').trim().charAt(0).toUpperCase();
    const displayName = lastnameInitial ? `${firstname} ${lastnameInitial}.` : firstname;
    const scopeType = String(coveringEntitlement?.scopeType || '').trim().toUpperCase();
    const isClubScope = scopeType === 'CLUB';
    const offerName = isClubScope ? t('subscriptionQuotaBanner.covered.offerClub', 'Club') : t(
      'subscriptionQuotaBanner.covered.offerTeam',
      'Équipe',
    );
    const coveredThing = isClubScope ? t(
      'subscriptionQuotaBanner.covered.wholeClub',
      'tout le club',
    ) : t(
      'subscriptionQuotaBanner.covered.thisTeam',
      'cette équipe',
    );

    return (
      <View
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          Spaces.marginBottom[16],
          {
            backgroundColor: withAlpha(Colors.success500, 0.08),
            borderColor: withAlpha(Colors.success500, 0.35),
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 9 }]}>
          <Image
            source={Images.shield}
            style={{ height: 16, width: 16 }}
            tintColor={Colors.success500}
          />
          <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>
            {t('subscriptionQuotaBanner.covered.title', "Déjà couvert — tu n'as rien à payer")}
          </Text>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'subscriptionQuotaBanner.covered.message',
            "{{displayName}} paie l'offre {{offerName}} pour {{coveredThing}}.",
            {
              coveredThing,
              displayName,
              offerName,
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
      </View>
    );
  }

  if (!quotaItem) {
    return null;
  }

  const isQuotaExhausted = quotaItem.remaining <= 0;
  // FREE_TEAM compte des creations d'equipe, les autres quotas des publications.
  const quotaNoun = quotaType === 'FREE_TEAM' ? t(
    'subscriptionQuotaBanner.nouns.creation',
    'création',
  ) : t(
    'subscriptionQuotaBanner.nouns.publication',
    'publication',
  );

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
          {t(
            'subscriptionQuotaBanner.exhausted.title',
            '{{label}} : quota gratuit épuisé',
            { label, ...SANS_ECHAPPEMENT },
          )}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {exhaustedBodyByQuotaType(t)[quotaType]
            || t(
              'subscriptionQuotaBanner.exhausted.defaultBody',
              "Débloque l'offre Équipe pour continuer sans limite.",
            )}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleOpenOffers}
          style={[Spaces.paddingVertical[8], { alignSelf: 'flex-start' }]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {t('subscriptionQuotaBanner.exhausted.cta', "Débloquer l'offre Équipe →")}
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
          ? t(
            'subscriptionQuotaBanner.remaining.many',
            '{{label}} : il te reste {{remaining}} {{quotaNoun}}s gratuites',
            {
              label,
              quotaNoun,
              remaining: quotaItem.remaining,
              ...SANS_ECHAPPEMENT,
            },
          )
          : t(
            'subscriptionQuotaBanner.remaining.one',
            '{{label}} : il te reste {{remaining}} {{quotaNoun}} gratuite',
            {
              label,
              quotaNoun,
              remaining: quotaItem.remaining,
              ...SANS_ECHAPPEMENT,
            },
          )}
      </Text>
    </View>
  );
}

export default SubscriptionQuotaBanner;
