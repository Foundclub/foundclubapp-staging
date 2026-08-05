import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { getSubscriptionBillingErrorMessage } from '@/domains/subscription/subscriptionBilling';
import {
  formatSubscriptionPlanLabel,
  getCoveredTeamCount,
  getSubscriptionStatusMeta,
  getSubscriptionTeamSlotSummary,
  hasActiveClubOffer,
} from '@/domains/subscription/subscriptionDecision';
import { restoreAllSubscriptionPurchases } from '@/domains/subscription/subscriptionPurchaseRail';
import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import ScreenContainer from '@/components/templates/ScreenContainer';
import SubscriptionCoveredHero from '@/views/profile/SubscriptionCoveredHero';

import { RouteNames } from '@/navigation/routeNames';

/** @type {Record<string, string>} */
const TRIAL_PLAN_LABELS = {
  fc_trial_club: 'Aperçu Club (essai 30 jours)',
  fc_trial_team: 'Aperçu Équipe (essai 30 jours)',
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
        Aucune carte requise. Retour au plan gratuit ensuite.
      </Text>
    </View>
  );
}

/**
 * Ecran 1 du parcours Abonnement (L33) : GERER. Aucun catalogue ici — la vente
 * vit dans le carrousel, la comparaison dans la matrice.
 *
 * Cette route garde son nom et son URL web `/profile/subscription` : trois
 * fichiers de test et la table des routes du site en dependent.
 * @param {{ navigation?: any }} props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionOverview({ navigation }) {
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
  // et je n'ai aucun plan actif en tant que payeur -> page heros dediee.
  const coveringEntitlement = useMemo(() => {
    if (activePlanCodes.length > 0) {
      return null;
    }
    const myDocumentId = String(userData?.documentId || '').trim();
    const candidates = entitlementsSummary.filter(
      /** @param {any} entry */ (entry) => entry?.paidBy?.documentId
        && entry.paidBy.documentId !== myDocumentId,
    );
    return candidates.find(/** @param {any} entry */ (entry) => entry?.scopeType === 'CLUB')
      || candidates[0]
      || null;
  }, [activePlanCodes, entitlementsSummary, userData?.documentId]);
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
   * @param {{ icon: string; label: string; onPress: () => void; right?: string; withDivider?: boolean }} props
   * @returns {import('react').ReactElement}
   */
  const renderActionRow = ({
    icon, label, onPress, right = '', withDivider = false,
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
        <Image
          source={Images[icon]}
          style={{ height: 14, tintColor: Colors.primary500, width: 14 }}
        />
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
              {`Autres plans actifs : ${planLabels.slice(1).join(' · ')}`}
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
                icon: 'chart',
                label: t('profile.subscription.actions.compareOffers', 'Comparer les offres'),
                onPress: () => navigation.navigate(RouteNames.SubscriptionCompare),
                withDivider: true,
              })}
              {renderActionRow({
                icon: 'search',
                label: t('profile.subscription.actions.restore', 'Restaurer mes achats'),
                onPress: handleRestorePurchases,
                withDivider: true,
              })}
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
    </ScreenContainer>
  );
}

export default SubscriptionOverview;
