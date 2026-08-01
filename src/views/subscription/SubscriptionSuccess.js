import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { getSubscriptionUnlockedCapabilities } from '@/domains/subscription/subscriptionDecision';
import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import { trackSubscriptionFunnelEvent } from '@/services/subscription/subscriptionService';

// Confettis statiques de la celebration compacte (positions relatives du handoff 6a).
const CELEBRATION_DOTS = [
  {
    color: 'primary500', left: '16%', size: 6, top: '18%',
  },
  {
    color: 'success500', left: '80%', size: 5, top: '15%',
  },
  {
    color: 'gold500', left: '26%', size: 4, top: '28%',
  },
  {
    color: 'primary500', left: '72%', size: 4, top: '29%',
  },
  {
    color: 'success500', left: '12%', size: 4, top: '38%',
  },
  {
    color: 'gold500', left: '87%', size: 5, top: '37%',
  },
];

// Libelles de repli des cles fr.js (`subscriptionSuccess.*`) : la cle gagne des
// qu'elle existe, le repli evite un trou de copy si elle disparait (L05).
/** @type {Record<string, string>} */
const UNLOCK_FALLBACK_LABELS = {
  clubRoles: 'Gestion des entraîneurs et dirigeants',
  clubTeams: 'Toutes les équipes du club couvertes',
  composition: 'Composition et convocations',
  dues: 'Campagnes de cotisations',
  events: 'Événements et matchs illimités',
  facilities: 'Installations du club',
  recruitment: 'Annonces de recrutement illimitées',
  sponsors: 'Sponsors du club',
  teams: 'Équipes supplémentaires',
};

/** @type {Record<string, string>} */
const FIRST_ACTION_FALLBACK_LABELS = {
  club: 'Gérer mon club',
  composition: 'Préparer ma compo',
  events: 'Publier un événement ou un match',
  recruitment: 'Publier une annonce de recrutement',
};

/**
 * Ecran de succes d'achat (handoff 6a, enrichi au lot L11) : celebration
 * compacte, la liste de ce que l'offre achetee debloque REELLEMENT (miroir de
 * la matrice serveur, voir getSubscriptionUnlockedCapabilities), les premiers
 * pas qui ouvrent les onglets concernes, recu discret vers Mon abonnement, CTA
 * unique qui relance la tache interrompue (la reprise de tache reste le heros).
 * Params navigation :
 * - offerLabel : ex. « Équipe · 2 équipes »
 * - offerScope : 'TEAM' | 'CLUB' — portee de l'offre ACHETEE ; absent (achat
 *   Stripe web), l'ecran ne montre que le socle commun aux deux offres
 * - clubDocumentId : club couvert par un achat Club (porte « Gérer mon club »)
 * - resumeCtaLabel : ex. « Créer ma 2ᵉ équipe » (defaut « Reprendre »)
 * - renewalDateLabel : ex. « 10 juillet 2027 » (optionnel)
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement}
 */
function SubscriptionSuccess({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const offerLabel = String(route?.params?.offerLabel || 'Équipe');
  const offerScope = String(route?.params?.offerScope || '').trim().toUpperCase();
  const purchasedClubDocumentId = String(route?.params?.clubDocumentId || '').trim();
  const resumeCtaLabel = String(route?.params?.resumeCtaLabel || 'Reprendre');
  const renewalDateLabel = String(route?.params?.renewalDateLabel || '');
  // 'back' (defaut) = la tache interrompue vit sous cet ecran dans la pile ;
  // 'home' = achat depuis le Recap de fin de tour, on repart sur l'accueil.
  const resumeMode = String(route?.params?.resumeMode || 'back');
  const storeLabel = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const queryClient = useQueryClient();

  const unlockedCapabilities = getSubscriptionUnlockedCapabilities(offerScope);

  const handleGoHome = () => {
    invalidateSubscriptionState(queryClient);
    navigation.reset({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
  };

  // Jalon funnel : ecran succes affiche (handoff 13).
  useEffect(() => {
    trackSubscriptionFunnelEvent('success_screen_viewed', { source: resumeMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les droits sont ouverts par le webhook du store, quelques secondes APRES la
  // reussite de l'achat cote client : une invalidation immediate relit l'ANCIEN
  // etat (constat recette sandbox iOS du 2026-07-17, puis build 2.6.1 le
  // 2026-08-01 : abonnement invisible avant un kill/relaunch de l'app).
  // Le calendrier de relance vit dans subscriptionRefresh.js, hors de ce
  // composant : pose ici, il mourait au demontage de l'ecran (L08).
  useEffect(() => {
    scheduleSubscriptionStateRefresh(queryClient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResume = () => {
    trackSubscriptionFunnelEvent('success_resume_clicked', { source: resumeMode });
    invalidateSubscriptionState(queryClient);
    if (resumeMode === 'home') {
      handleGoHome();
      return;
    }
    navigation.goBack();
  };

  const handleOpenSubscription = () => {
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  };

  // Premiers pas : chaque bouton ouvre l'ONGLET qui heberge la capacite
  // debloquee. Planning et Équipes sont des onglets directs de HomeTab (motif
  // EventDetails.js:2335) ; le recrutement vit DANS SearchStack, donc trois
  // niveaux via navigateToSearchHub — deux niveaux echouent en silence depuis
  // un ecran pousse sur le navigateur racine, comme celui-ci (R06).
  const firstActions = [
    {
      id: 'events',
      label: t('subscriptionSuccess.firstActions.events', FIRST_ACTION_FALLBACK_LABELS.events),
      open: () => navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList }),
    },
    {
      id: 'composition',
      label: t(
        'subscriptionSuccess.firstActions.composition',
        FIRST_ACTION_FALLBACK_LABELS.composition,
      ),
      open: () => navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyTeamList }),
    },
    {
      id: 'recruitment',
      label: t(
        'subscriptionSuccess.firstActions.recruitment',
        FIRST_ACTION_FALLBACK_LABELS.recruitment,
      ),
      open: () => navigateToSearchHub(navigation, 'recruitment'),
    },
    // Installations, sponsors, cotisations et roles vivent sur la fiche club :
    // le bouton n'apparait que si l'achat est Club ET que le club couvert est
    // connu — un bouton vers un club absent serait un mensonge (§2.3).
    ...(offerScope === 'CLUB' && purchasedClubDocumentId ? [{
      id: 'club',
      label: t('subscriptionSuccess.firstActions.club', FIRST_ACTION_FALLBACK_LABELS.club),
      open: () => navigation.navigate(RouteNames.ClubStack, {
        params: { clubId: purchasedClubDocumentId },
        screen: RouteNames.Club,
      }),
    }] : []),
  ];

  /**
   * Trace le premier pas choisi, invalide l'etat d'abonnement puis navigue.
   * @param {{ id: string; open: () => void }} action
   * @returns {void}
   */
  const handleFirstAction = (action) => {
    // Meme jalon que « Reprendre » : la liste blanche serveur des evenements
    // funnel est figee (subscription-funnel-event.ts:5), un nom nouveau serait
    // rejete en silence. La source distingue le bouton choisi.
    trackSubscriptionFunnelEvent('success_resume_clicked', { source: `first-action:${action.id}` });
    invalidateSubscriptionState(queryClient);
    action.open();
  };

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[Alignments.fill, Spaces.padding[24]]}>
        {CELEBRATION_DOTS.map((dot) => (
          <View
            key={`${dot.left}-${dot.top}`}
            pointerEvents="none"
            style={{
              backgroundColor: Colors[/** @type {keyof typeof Colors} */ (dot.color)],
              borderRadius: 999,
              height: dot.size,
              left: /** @type {any} */ (dot.left),
              opacity: 0.8,
              position: 'absolute',
              top: /** @type {any} */ (dot.top),
              width: dot.size,
            }}
          />
        ))}

        <ScrollView
          contentContainerStyle={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.gap[16],
            { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(39,214,163,0.08)',
              borderRadius: 999,
              height: 150,
              justifyContent: 'center',
              width: 150,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(39,214,163,0.12)',
                borderColor: Colors.success500,
                borderRadius: 999,
                borderWidth: 2,
                height: 92,
                justifyContent: 'center',
                width: 92,
              }}
            >
              <Text style={{ color: Colors.success500, fontSize: 44, lineHeight: 52 }}>✓</Text>
            </View>
          </View>
          <Text style={[Fonts.h1Bold, Fonts.neutral00, Fonts.textCenter]}>
            C&apos;est débloqué !
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter, { maxWidth: 300 }]}>
            Offre
            {' '}
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{offerLabel}</Text>
            {' '}
            — active pour toute l&apos;équipe, dès maintenant.
          </Text>

          <View style={[Spaces.gap[8], { maxWidth: 300 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('subscriptionSuccess.unlockedTitle', 'Ton offre débloque :')}
            </Text>
            {unlockedCapabilities.map((capabilityId) => (
              <View
                key={capabilityId}
                style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
              >
                <Text style={{ color: Colors.success500, fontSize: 14, lineHeight: 18 }}>✓</Text>
                <Text style={[Fonts.p2, Fonts.neutral200, { flexShrink: 1 }]}>
                  {t(
                    `subscriptionSuccess.unlocks.${capabilityId}`,
                    UNLOCK_FALLBACK_LABELS[capabilityId] || capabilityId,
                  )}
                </Text>
              </View>
            ))}
          </View>

          <View style={[Spaces.gap[8], { alignSelf: 'stretch', maxWidth: 340 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
              {t(
                'subscriptionSuccess.firstActionTitle',
                'Que veux-tu faire en premier pour profiter de ton abonnement ?',
              )}
            </Text>
            {firstActions.map((action) => (
              <Button
                key={action.id}
                onPress={() => handleFirstAction(action)}
                title={action.label}
                variant="Secondary"
              />
            ))}
          </View>
        </ScrollView>

        <View style={[Spaces.gap[12]]}>
          <Button
            onPress={handleResume}
            title={resumeCtaLabel}
            variant="Primary"
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleGoHome}
            style={[Spaces.paddingVertical[12]]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral300, Fonts.textCenter]}>
              Retour à l&apos;accueil
            </Text>
          </TouchableOpacity>
          <Text style={[Fonts.p4, Fonts.neutral400, Fonts.textCenter]}>
            {renewalDateLabel
              ? `Renouvellement le ${renewalDateLabel} · ${storeLabel} — détails dans `
              : `${storeLabel} — détails dans `}
            <Text onPress={handleOpenSubscription} style={[Fonts.p4Bold, Fonts.primary500]}>
              Mon abonnement
            </Text>
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

export default SubscriptionSuccess;
