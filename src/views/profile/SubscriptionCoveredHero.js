import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import i18next from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import useMessaging from '@/domains/messaging/useMessaging';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';

import { RouteNames } from '@/navigation/routeNames';

// Libelles d'offre du heros « deja couvert » (handoff 7b).
//
// LOT CATALOGUE (2026-08-28) — les 4 tranches de LICENCIES ont remplace
// Club S / M / L. Les equipes sont illimitees dans les quatre : ce qui distingue
// une tranche d'une autre est le nombre de licenciés couverts.
//
// ⚠️ Cet ecran ne recoit qu'un CODE DE PLAN (l'entitlement qui couvre la
// personne), jamais l'entree de catalogue : il doit donc porter les noms. Le
// numero du code n'est PAS le nom de l'offre — `fc_club_tier_1` s'appelle
// « Club 100 », parce qu'un identifiant de magasin ne se renomme jamais.
/** @type {Record<number, string>} */
const CLUB_TIER_HERO_LABELS = {
  get 1() {
    return i18next.t(
      'subscriptionCoveredHero.offers.clubTier1',
      "Offre Club 100 · jusqu'à 100 licenciés",
    );
  },
  get 2() {
    return i18next.t(
      'subscriptionCoveredHero.offers.clubTier2',
      "Offre Club 500 · jusqu'à 500 licenciés",
    );
  },
  get 3() {
    return i18next.t(
      'subscriptionCoveredHero.offers.clubTier3',
      "Offre Club 1000 · jusqu'à 1 000 licenciés",
    );
  },
  get 4() {
    return i18next.t(
      'subscriptionCoveredHero.offers.clubTier4',
      'Offre Club Illimité · licenciés illimités',
    );
  },
};

/**
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const getHeroOfferLabel = (planCode) => {
  const normalized = String(planCode || '').trim().toLowerCase();
  const teamMatch = normalized.match(/^fc_team_(\d+)_/);
  if (teamMatch) {
    const slotCount = Number(teamMatch[1] || 0);
    return i18next.t('subscriptionCoveredHero.offers.team', {
      count: slotCount,
      defaultValue_one: 'Offre Équipe · {{count}} équipe',
      defaultValue_other: 'Offre Équipe · {{count}} équipes',
    });
  }
  // S12-B — l'offre au licencie AVANT les paliers, et sans toucher a leur regex :
  // elle n'a pas de palier. Sinon elle retombait sur « Offre FoundClub », un nom
  // qui ne dit rien a quelqu'un a qui on annonce que tout est deja paye pour lui.
  if (/^fc_club_licensee_/.test(normalized)) {
    return i18next.t(
      'subscriptionCoveredHero.offers.clubLicensee',
      'Offre Club au licencié · équipes illimitées',
    );
  }
  const clubMatch = normalized.match(/^fc_club_tier_(\d+)_/);
  if (clubMatch) {
    return CLUB_TIER_HERO_LABELS[Number(clubMatch[1] || 0)] || i18next.t(
      'subscriptionCoveredHero.offers.club',
      'Offre Club',
    );
  }
  return normalized ? i18next.t('subscriptionCoveredHero.offers.foundclub', 'Offre FoundClub') : '';
};

/**
 * Page heros « deja couvert » (handoff 7b) : le payeur au centre, offre et
 * renouvellement en sous-titre, chip « tout est debloque », action = ecrire
 * au payeur via le chat existant.
 * @param {object} props
 * @param {any} props.coveringEntitlement - Entitlement couvrant l'utilisateur
 *   (expose paidBy, scopeType, scopeTeamName, subscriptionPlanCode,
 *   subscriptionCurrentPeriodEnd).
 * @param {string[]} [props.coveredTeamNames] - Noms des equipes couvertes (scope TEAM).
 * @param {any} props.navigation
 * @returns {import('react').ReactElement}
 */
function SubscriptionCoveredHero({
  coveredTeamNames = [],
  coveringEntitlement,
  navigation,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { startWhisperChat } = /** @type {any} */ (useMessaging());
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const paidBy = coveringEntitlement?.paidBy || {};
  const firstname = String(paidBy?.firstname || '').trim() || t(
    'subscriptionCoveredHero.payer.fallbackName',
    'Un membre',
  );
  const lastnameInitial = String(paidBy?.lastname || '').trim().charAt(0).toUpperCase();
  const displayName = lastnameInitial ? `${firstname} ${lastnameInitial}.` : firstname;
  const isClubScope = String(coveringEntitlement?.scopeType || '').trim().toUpperCase() === 'CLUB';
  const offerLabel = getHeroOfferLabel(coveringEntitlement?.subscriptionPlanCode);
  const renewalDate = coveringEntitlement?.subscriptionCurrentPeriodEnd
    ? format(
      new Date(coveringEntitlement.subscriptionCurrentPeriodEnd),
      'd MMMM yyyy',
      { locale: fr },
    )
    : '';
  const teamNamesLine = coveredTeamNames.filter(Boolean).join(' · ');

  const handleWriteToPayer = async () => {
    const payerDocumentId = String(paidBy?.documentId || '').trim();
    if (!payerDocumentId || isOpeningChat) {
      return;
    }
    setIsOpeningChat(true);
    try {
      const chat = await startWhisperChat([payerDocumentId]);
      if (chat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: chat.documentId });
      }
    } catch (error) {
      Alert.alert(
        t('subscriptionCoveredHero.alerts.chatError.title', 'Messagerie'),
        t(
          'subscriptionCoveredHero.alerts.chatError.message',
          'Impossible de démarrer cette conversation pour le moment.',
        ),
      );
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <View
      style={[
        Alignments.fill,
        Alignments.alignCenter,
        Alignments.justifyCenter,
        Spaces.padding[24],
      ]}
    >
      <MemberAvatar
        firstname={paidBy?.firstname}
        lastname={paidBy?.lastname}
        outlined
        size={84}
      />
      <Text style={[Fonts.h2Bold, Fonts.neutral00, Fonts.textCenter, Spaces.marginTop[16]]}>
        {isClubScope
          ? t(
            'subscriptionCoveredHero.title.club',
            '{{firstname}} paie pour tout le club',
            { firstname, ...SANS_ECHAPPEMENT },
          )
          : t(
            'subscriptionCoveredHero.title.team',
            '{{firstname}} paie pour cette équipe',
            { firstname, ...SANS_ECHAPPEMENT },
          )}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter, Spaces.marginTop[8]]}>
        {offerLabel}
        {!isClubScope && teamNamesLine ? `\n${teamNamesLine}` : ''}
        {/* I18N-1 : la 1re lettre de « renouvellement » dependait de sa place (apres « — » ou en
            debut de ligne) : deux phrases entieres, une par place. */}
        {renewalDate && !isClubScope && teamNamesLine ? ` — ${t(
          'subscriptionCoveredHero.renewalInline',
          'renouvellement le {{renewalDate}}',
          { renewalDate, ...SANS_ECHAPPEMENT },
        )}` : ''}
        {renewalDate && !(!isClubScope && teamNamesLine) ? `\n${t(
          'subscriptionCoveredHero.renewalNewLine',
          'Renouvellement le {{renewalDate}}',
          { renewalDate, ...SANS_ECHAPPEMENT },
        )}` : ''}
      </Text>
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.marginTop[16],
          {
            backgroundColor: 'rgba(39,214,163,0.10)',
            borderColor: 'rgba(39,214,163,0.4)',
            borderRadius: 999,
            columnGap: 6,
            paddingHorizontal: 14,
            paddingVertical: 7,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>✓</Text>
        <Text style={[Fonts.p3Bold, { color: Colors.success200 }]}>
          {t('subscriptionCoveredHero.unlockedChip', 'Tout est débloqué pour toi')}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={isOpeningChat}
        onPress={handleWriteToPayer}
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          Spaces.marginTop[24],
          {
            borderColor: Colors.primary500,
            borderRadius: 999,
            borderWidth: 1.5,
            minHeight: 48,
            opacity: isOpeningChat ? 0.6 : 1,
            paddingHorizontal: 26,
          },
        ]}
      >
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {isOpeningChat ? t('subscriptionCoveredHero.actions.opening', 'Ouverture…') : t(
            'subscriptionCoveredHero.actions.writeTo',
            'Écrire à {{displayName}}',
            { displayName, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </TouchableOpacity>
      {!isClubScope ? (
        <Text
          style={[
            Fonts.p4,
            Fonts.neutral400,
            Fonts.textCenter,
            Spaces.marginTop[16],
            { maxWidth: 300 },
          ]}
        >
          {t(
            'subscriptionCoveredHero.upgradeHint',
            "Besoin d'une équipe de plus ? {{firstname}} peut passer au palier supérieur en 1 tap.",
            { firstname, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
    </View>
  );
}

export default SubscriptionCoveredHero;
