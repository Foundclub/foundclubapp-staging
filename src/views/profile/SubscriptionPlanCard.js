import { format as formatDate } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import i18next from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { getSubscriptionSelectableTeams } from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  getActiveClubNotCovered,
  getActiveOfferDetails,
  getCoveredTeamCount,
  getSubscriptionBadgeLevel,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
  hasActiveClubOffer,
} from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * ABONNEMENT-HAUT (12/11, Adel « 288 B ») — LA CARTE DE STATUT de « Mon abonnement »,
 * sortie telle quelle de `SubscriptionOverview.js` (le telephone) pour que le SITE pose
 * la meme carte en haut de sa page, au lieu de ses 4 cases, « État actuel » et « Quotas
 * gratuits ». Une seule carte, deux ecrans : rien n est recopie.
 *
 * `useSubscriptionPlanCard` calcule ce que la carte dit (l ecran du telephone en lit aussi
 * trois valeurs : le club non couvert, le niveau gratuit, la date de l offre) ;
 * `SubscriptionPlanCard` la dessine.
 *
 * `detaille` (le site seulement) : la carte dit EN PLUS ce que les blocs retires du site
 * affichaient et que le telephone tait — la certification pour tout compte (pas seulement
 * sous une offre Club), les noms des equipes couvertes, le signal partenaire. Sans
 * l option, rien ne change au telephone. Table « information -> ou elle est maintenant » :
 * banc ABONNEMENT-HAUT-1211.
 */

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
  get fc_trial_club() {
    // TEXTES-COLLECTIVITES (01/10) : un essai n est pas « offert » — ce mot est reserve a
    // l offre de la Ville (« Offert par la Ville de … »).
    return i18next.t('subscriptionOverview.trialPlans.club', 'Essai Club');
  },
  get fc_trial_team() {
    return i18next.t('subscriptionOverview.trialPlans.team', 'Essai Équipe');
  },
};

/**
 * Le libelle de certification du club actif.
 * @param {any} clubVerificationSummary
 * @returns {string}
 */
const getVerificationLabel = (clubVerificationSummary) => {
  if (!clubVerificationSummary?.clubDocumentId) {
    return i18next.t('subscriptionOverview.verification.noClub', 'Aucun club rattaché');
  }
  if (clubVerificationSummary?.clubVerified === true) {
    return i18next.t('subscriptionOverview.verification.verified', 'Club certifié');
  }
  if (clubVerificationSummary?.requiresClubVerification === true) {
    // L'ancien libelle reclamait ici un geste qui n'existe pas pour un
    // dirigeant : la certification est faite par la plateforme, jamais par lui.
    return i18next.t('subscriptionOverview.verification.pending', 'Certification en cours');
  }
  return i18next.t('subscriptionOverview.verification.unverified', 'Club non certifié');
};

/**
 * Le nom d une offre, l essai compris.
 * @param {string | null | undefined} planCode
 * @returns {string}
 */
const formatSubscriptionPlanLabelWithTrial = (planCode) => (
  TRIAL_PLAN_LABELS[String(planCode || '').trim().toLowerCase()]
    || formatSubscriptionPlanLabel(planCode)
);

/**
 * Une date d'offre, telle que l'ecran l'affiche.
 * @param {string} value - La date ISO.
 * @returns {string} Le jour en toutes lettres.
 */
const formatOfferDate = (value) => formatDate(
  new Date(value),
  'd MMMM yyyy',
  { locale: frLocale },
);

/**
 * Ce que dit la carte de statut, calcule depuis la session.
 * @returns {any}
 */
export const useSubscriptionPlanCard = () => {
  const { t } = useTranslation();
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
  const subscriptionAccessLevel = accountSubscriptionAccessLevel
    || activeClubSubscriptionAccessLevel;
  const activePlanCodes = useMemo(
    () => (Array.isArray(subscriptionSummary?.activePlanCodes)
      ? subscriptionSummary.activePlanCodes
      : []),
    [subscriptionSummary?.activePlanCodes],
  );

  const statusMeta = useMemo(
    () => getSubscriptionStatusMeta(subscriptionAccessLevel),
    [subscriptionAccessLevel],
  );
  // ABOCLUB (2026-09-28) — L'OFFRE CLUB DU COMPTE COUVRE UN AUTRE CLUB QUE
  // CELUI QU'IL REGARDE. Le niveau d'acces est celui du COMPTE : sans ce garde,
  // l'ecran annoncait « rien n'est bloque » pour un club que le serveur refuse
  // (recette du 28/09). Le titre garde le nom de ce qui est paye ; seules la
  // description et la couverture disent ou l'offre s'applique.
  const uncoveredActiveClub = useMemo(() => getActiveClubNotCovered({
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionAccessLevel,
    userData,
  }), [clubVerificationSummary, entitlementsSummary, subscriptionAccessLevel, userData]);
  // ABOPARCLUB — recette du 29/09 (tournee 4, defaut 4) : le badge dit l'etat
  // du club AFFICHE quand l'offre en couvre un autre, plus « Club · actif ».
  const badgeAccessLevel = getSubscriptionBadgeLevel({
    activeClubLevel: activeClubSubscriptionAccessLevel,
    paidLevel: subscriptionAccessLevel,
    uncoveredActiveClub,
  });

  // ABOCLUB2 (2026-09-28) — les offres UNE PAR UNE, chacune avec sa date et son
  // club, celle qui couvre le club actif en tete : c'est elle que la carte
  // decrit. Voir `getActiveOfferDetails` (subscriptionDecision.js).
  const offerDetails = useMemo(() => getActiveOfferDetails({
    activePlanCodes,
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionSummary,
    userData,
  }), [
    activePlanCodes, clubVerificationSummary, entitlementsSummary, subscriptionSummary, userData,
  ]);
  const planLabels = useMemo(
    () => offerDetails.map((offer) => formatSubscriptionPlanLabelWithTrial(offer.planCode)),
    [offerDetails],
  );
  const teamSlotSummary = useMemo(
    () => getSubscriptionTeamSlotSummary(subscriptionSummary),
    [subscriptionSummary],
  );
  const coveredTeamCount = useMemo(
    () => getCoveredTeamCount(entitlementsSummary, subscriptionSummary),
    [entitlementsSummary, subscriptionSummary],
  );
  const payerRenewalEntitlement = useMemo(
    () => entitlementsSummary.find(
      (/** @type {any} */ entry) => entry?.paidBy?.documentId
        && entry.paidBy.documentId === String(userData?.documentId || '')
        && entry?.subscriptionCurrentPeriodEnd,
    ) || null,
    [entitlementsSummary, userData?.documentId],
  );
  // `detaille` — les noms des equipes couvertes, lus comme la page du site les lisait
  // (equipes du compte, croisees avec les places de l offre Équipe).
  const coveredTeamNames = useMemo(() => {
    const teamsById = new Map(getSubscriptionSelectableTeams([
      ...(userData?.myTeams || []),
      ...(userData?.trainedTeams || []),
    ]).map((/** @type {any} */ team) => [String(team?.documentId || '').trim(), team]));
    return teamSlotSummary.coveredTeamDocumentIds
      .map((/** @type {any} */ teamDocumentId) => (
        teamsById.get(String(teamDocumentId || '').trim())?.name || null
      ))
      .filter(Boolean);
  }, [teamSlotSummary.coveredTeamDocumentIds, userData?.myTeams, userData?.trainedTeams]);

  const verificationLabel = getVerificationLabel(clubVerificationSummary);
  const isFreeLevel = subscriptionAccessLevel === 'FREE';
  const isClubLevel = hasActiveClubOffer(subscriptionAccessLevel);
  // Titre humain de la carte statut : le vrai nom d'offre si payant, sinon l'offre gratuite.
  const planCardTitle = isFreeLevel ? t(
    'subscriptionOverview.planCard.freeTitle',
    'Offre gratuite FoundClub',
  ) : (planLabels[0] || statusMeta.label);
  let uncoveredClubDescription = '';
  if (uncoveredActiveClub) {
    uncoveredClubDescription = uncoveredActiveClub.activeClubName ? t(
      'subscriptionOverview.planCard.description.activeClubNotCovered',
      "Ton club {{clubName}} n'est pas couvert par cette offre.",
      { clubName: uncoveredActiveClub.activeClubName, ...SANS_ECHAPPEMENT },
    ) : t(
      'subscriptionOverview.planCard.description.activeClubNotCoveredUnnamed',
      "Ton club actuel n'est pas couvert par cette offre.",
    );
  }
  // Description tutoyée par niveau (remplace la copie technique/vouvoyée du backend).
  const planCardDescription = uncoveredClubDescription || {
    CLUB: t(
      'subscriptionOverview.planCard.description.club',
      'Les droits Club sont actifs sur ton club certifié : toutes tes équipes sont couvertes.',
    ),
    CLUB_UNVERIFIED: t(
      'subscriptionOverview.planCard.description.clubUnverified',
      "Tes droits Club sont actifs sur tout ton club — rien n'est bloqué. Ton club est en "
        + 'cours de certification par la plateforme.',
    ),
    FREE: t(
      'subscriptionOverview.planCard.description.free',
      'Tu publies en quantité limitée. Passe à une offre payante pour lever les limites.',
    ),
    TEAM: t(
      'subscriptionOverview.planCard.description.team',
      'Tes équipes couvertes profitent des droits Équipe, sans limite de publication.',
    ),
  }[subscriptionAccessLevel] || t(
    'profile.subscription.status.free',
    "Tu utilises l'offre gratuite FoundClub.",
  );
  // Résumé de couverture humain (aucune tuile « 0 » : on n'affiche que ce qui a du sens).
  const coverageSummary = (() => {
    if (isFreeLevel) return '';
    if (uncoveredActiveClub) {
      return uncoveredActiveClub.coveredClubNames.length > 0 ? t(
        'subscriptionOverview.coverage.otherClubs',
        'Couvre : {{clubNames}}',
        { clubNames: uncoveredActiveClub.coveredClubNames.join(', '), ...SANS_ECHAPPEMENT },
      ) : t(
        'subscriptionOverview.coverage.otherClubUnnamed',
        'Cette offre couvre un autre club.',
      );
    }
    if (isClubLevel) {
      return t(
        'subscriptionOverview.coverage.allClubTeams',
        'Toutes les équipes de ton club sont couvertes.',
      );
    }
    if (coveredTeamCount > 0) {
      return t('subscriptionOverview.coverage.teams', {
        count: coveredTeamCount,
        defaultValue_one: '{{count}} équipe couverte par ton offre.',
        defaultValue_other: '{{count}} équipes couvertes par ton offre.',
      });
    }
    return '';
  })();
  // Places restantes d'une offre Équipe : la seule information de l'ancienne
  // section « Plans et droits actifs » qui n'existait nulle part ailleurs.
  const teamSlotLine = !isFreeLevel && !isClubLevel && teamSlotSummary.total > 0
    ? t('subscriptionOverview.teamSlots.usage', '{{assigned}}/{{places}} {{assignedWord}}', {
      assigned: teamSlotSummary.assigned,
      assignedWord: t('subscriptionOverview.teamSlots.assignedWord', {
        count: teamSlotSummary.assigned,
        defaultValue_one: 'attribuée',
        defaultValue_other: 'attribuées',
      }),
      places: t('subscriptionOverview.teamSlots.places', {
        count: teamSlotSummary.total,
        defaultValue_one: '{{count}} place',
        defaultValue_other: '{{count}} places',
      }),
      ...SANS_ECHAPPEMENT,
    })
    : '';
  // ABOCLUB2 — la date de la carte est celle de l'offre QUE LA CARTE NOMME, avec
  // son vrai mot (renouvellement ou fin). Elle affichait la premiere echeance
  // trouvee parmi les droits payes : la fin d'un essai sous le nom du Club 100.
  // Repli : un serveur qui ne rend pas `payerSubscriptionsSummary` garde
  // l'ancienne lecture — il ne dit pas si l'offre se renouvelle.
  let planCardDate = offerDetails[0]?.date || null;
  if (!Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)) {
    planCardDate = payerRenewalEntitlement?.subscriptionCurrentPeriodEnd
      ? { kind: 'renews', value: String(payerRenewalEntitlement.subscriptionCurrentPeriodEnd) }
      : null;
  }
  // Les AUTRES offres, chacune avec son club et sa date, a cote de SON nom :
  // aucune date d'une offre ne s'affiche sous une autre.
  const otherOffersLabel = offerDetails.slice(1).map((offer, index) => {
    let label = planLabels[index + 1];
    if (offer.coveredClubNames.length > 0) {
      label = t(
        'subscriptionOverview.planCard.otherPlan.covers',
        '{{plan}} (couvre {{clubNames}})',
        { clubNames: offer.coveredClubNames.join(', '), plan: label, ...SANS_ECHAPPEMENT },
      );
    }
    if (offer.date?.kind === 'renews') {
      label = t(
        'subscriptionOverview.planCard.otherPlan.renewsOn',
        '{{plan}}, renouvelé le {{date}}',
        { date: formatOfferDate(offer.date.value), plan: label, ...SANS_ECHAPPEMENT },
      );
    } else if (offer.date?.kind === 'ends') {
      label = t(
        'subscriptionOverview.planCard.otherPlan.endsOn',
        '{{plan}}, se termine le {{date}}',
        { date: formatOfferDate(offer.date.value), plan: label, ...SANS_ECHAPPEMENT },
      );
    }
    return label;
  }).join(' · ');

  return {
    badgeAccessLevel,
    clubPartner: clubVerificationSummary?.clubPartner === true,
    coverageSummary,
    coveredTeamNames,
    isClubLevel,
    isFreeLevel,
    otherOffersLabel,
    planCardDate,
    planCardDescription,
    planCardTitle,
    planLabels,
    teamSlotLine,
    uncoveredActiveClub,
    verificationLabel,
  };
};

/**
 * La carte de statut de « Mon abonnement ».
 * @param {{ carte: any; detaille?: boolean }} props - `carte` : `useSubscriptionPlanCard()`.
 * @returns {import('react').ReactElement}
 */
function SubscriptionPlanCard({ carte, detaille = false }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    badgeAccessLevel,
    clubPartner,
    coverageSummary,
    coveredTeamNames,
    isClubLevel,
    otherOffersLabel,
    planCardDate,
    planCardDescription,
    planCardTitle,
    planLabels,
    teamSlotLine,
    uncoveredActiveClub,
    verificationLabel,
  } = carte;

  // Chip de statut DS (design 13c) : neutre / cyan / violet, jamais de couleurs Tailwind.
  const subscriptionChip = useMemo(() => {
    switch (badgeAccessLevel) {
      case 'CLUB':
      case 'CLUB_UNVERIFIED':
        return {
          // R10 — les deux etats Club portent la meme etiquette et la meme
          // couleur : ils ouvrent exactement les memes droits, et l'horloge
          // suggerait au client une attente qui ne le concerne pas.
          borderColor: withAlpha(Colors.violet500, 0.55),
          fillColor: withAlpha(Colors.violet500, 0.16),
          label: t(badgeAccessLevel === 'CLUB'
            ? 'profile.subscription.states.club'
            : 'profile.subscription.states.clubUnverified'),
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
  }, [badgeAccessLevel, Colors, t]);

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
        style={[
          Alignments.fill, Fonts.p4Bold, Fonts.textRight, { color: valueColor || Colors.neutral100 },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  // La certification ne regarde que le club actif : au telephone, elle n'a rien a
  // dire d'une offre qui ne le couvre pas (ABOCLUB). Le site (`detaille`) la dit
  // toujours, comme son ancienne case « Vérification club ».
  const showsCertification = detaille || (isClubLevel && !uncoveredActiveClub);

  return (
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
      testID="subscription-plan-card"
    >
      <View
        style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}
      >
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

      {detaille && coveredTeamNames.length > 0 ? (
        <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[4]]}>
          {coveredTeamNames.join(' · ')}
        </Text>
      ) : null}

      {planLabels.length > 1 ? (
        <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[4]]}>
          {t(
            'subscriptionOverview.planCard.otherPlans',
            'Autres offres actives : {{plans}}',
            { plans: otherOffersLabel, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}

      <View style={Spaces.marginTop[12]}>
        {showsCertification ? renderStatusLine({
          icon: 'check',
          label: t('subscriptionOverview.statusLines.certification', 'Certification'),
          value: verificationLabel,
          valueColor: Colors.violet200,
        }) : null}
        {teamSlotLine ? renderStatusLine({
          icon: 'users',
          label: t('subscriptionOverview.statusLines.coveredTeams', 'Équipes couvertes'),
          value: teamSlotLine,
        }) : null}
        {planCardDate ? renderStatusLine({
          icon: 'calendar',
          label: planCardDate.kind === 'renews'
            ? t('subscriptionOverview.statusLines.renewedOn', 'Renouvelé le')
            : t('subscriptionOverview.statusLines.endsOn', 'Se termine le'),
          value: formatOfferDate(planCardDate.value),
        }) : null}
      </View>

      {detaille && clubPartner ? (
        <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginBottom[12]]}>
          {t('subscriptionOverview.planCard.partnerSignal', 'Signal partenaire interne actif.')}
        </Text>
      ) : null}
    </View>
  );
}

export default SubscriptionPlanCard;
