import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { getSubscriptionUnlockedCapabilities } from '@/domains/subscription/subscriptionDecision';
import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import { trackSubscriptionFunnelEvent } from '@/services/subscription/subscriptionService';

// Cotes de la mise en page compacte (handoff design tour 7a) : l'ecran doit
// tenir en entier sur un iPhone 13/14 SANS defiler. Le ScrollView reste en
// secours pour les petits ecrans, il ne porte plus le cas nominal.
const HERO_HALO_SIZE = 84;
const HERO_RING_SIZE = 56;
const CONTENT_MAX_WIDTH = 360;

// Confettis statiques : positions relatives DANS la bande decorative posee
// au-dessus du heros (styles.celebrationBand). Cette bande est hors du flux,
// donc aucun point ne peut retomber sur un texte (handoff 7a, point 6).
const CELEBRATION_DOTS = [
  {
    color: 'primary500', left: '6%', size: 6, top: '46%',
  },
  {
    color: 'success500', left: '24%', size: 4, top: '10%',
  },
  {
    color: 'gold500', left: '45%', size: 5, top: '58%',
  },
  {
    color: 'primary500', left: '66%', size: 4, top: '14%',
  },
  {
    color: 'success500', left: '84%', size: 5, top: '50%',
  },
  {
    color: 'gold500', left: '95%', size: 4, top: '8%',
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

// Version courte des memes libelles, pour la grille a 2 colonnes (tour 7a).
// C'est un raccourci d'AFFICHAGE : la liste des capacites vient toujours de
// getSubscriptionUnlockedCapabilities. Une capacite absente de cette table
// retombe sur son libelle long — elle ne doit JAMAIS disparaitre de l'ecran.
/** @type {Record<string, string>} */
const UNLOCK_SHORT_FALLBACK_LABELS = {
  clubRoles: 'Rôles du club',
  clubTeams: 'Toutes les équipes du club',
  composition: 'Compo & convocations',
  dues: 'Cotisations',
  events: 'Événements illimités',
  facilities: 'Installations',
  recruitment: 'Annonces illimitées',
  sponsors: 'Sponsors',
};

/** @type {Record<string, string>} */
const FIRST_ACTION_FALLBACK_LABELS = {
  club: 'Gérer mon club',
  composition: 'Préparer ma compo',
  events: 'Publier un événement ou un match',
  recruitment: 'Publier une annonce de recrutement',
};

/**
 * Ecran de succes d'achat (handoff 6a, enrichi au lot L11, remis en page au
 * tour 7a) : celebration compacte, la liste de ce que l'offre achetee debloque
 * REELLEMENT (miroir de la matrice serveur, voir
 * getSubscriptionUnlockedCapabilities) en grille a 2 colonnes, les premiers pas
 * en grille 2x2 qui ouvrent les onglets concernes, recu discret vers Mon
 * abonnement, CTA unique qui relance la tache interrompue (la reprise de tache
 * reste le heros).
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
    Alignments, Colors, Fonts, Images, Spaces,
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

  /**
   * Libelle affiche pour une capacite debloquee : la version courte quand elle
   * existe, sinon la version longue. Aucun identifiant ne peut sortir sans
   * texte — au pire il rend sa propre cle, jamais rien (tour 7a, point 3).
   * @param {string} capabilityId - Identifiant rendu par getSubscriptionUnlockedCapabilities.
   * @returns {string} - Libelle a afficher dans la grille.
   */
  const resolveUnlockLabel = (capabilityId) => {
    const longLabel = t(
      `subscriptionSuccess.unlocks.${capabilityId}`,
      UNLOCK_FALLBACK_LABELS[capabilityId] || capabilityId,
    );
    return t(
      `subscriptionSuccess.unlocksShort.${capabilityId}`,
      UNLOCK_SHORT_FALLBACK_LABELS[capabilityId] || longLabel,
    );
  };

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

  // L33 — cap sur le HUB, volontairement : cette personne VIENT d'acheter. Lui
  // reouvrir un catalogue juste apres serait au mieux inutile, au pire une
  // invitation a payer deux fois.
  const handleOpenSubscription = () => {
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  };

  // Premiers pas : chaque carte ouvre l'ONGLET qui heberge la capacite
  // debloquee. Planning et Équipes sont des onglets directs de HomeTab (motif
  // EventDetails.js:2335) ; le recrutement vit DANS SearchStack, donc trois
  // niveaux via navigateToSearchHub — deux niveaux echouent en silence depuis
  // un ecran pousse sur le navigateur racine, comme celui-ci (R06).
  // `icon` pointe la banque d'icones du theme (Images), la meme que les cartes
  // de l'accueil (HomeActionCard.js:186) : aucune image nouvelle a embarquer.
  const firstActions = [
    {
      icon: 'calendar',
      id: 'events',
      label: t('subscriptionSuccess.firstActions.events', FIRST_ACTION_FALLBACK_LABELS.events),
      open: () => navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList }),
    },
    {
      icon: 'users',
      id: 'composition',
      label: t(
        'subscriptionSuccess.firstActions.composition',
        FIRST_ACTION_FALLBACK_LABELS.composition,
      ),
      open: () => navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyTeamList }),
    },
    {
      icon: 'search',
      id: 'recruitment',
      label: t(
        'subscriptionSuccess.firstActions.recruitment',
        FIRST_ACTION_FALLBACK_LABELS.recruitment,
      ),
      open: () => navigateToSearchHub(navigation, 'recruitment'),
    },
    // Installations, sponsors, cotisations et roles vivent sur la fiche club :
    // la carte n'apparait que si l'achat est Club ET que le club couvert est
    // connu — une carte vers un club absent serait un mensonge (§2.3).
    ...(offerScope === 'CLUB' && purchasedClubDocumentId ? [{
      icon: 'shield',
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
      <View style={[Alignments.fill, Spaces.paddingHorizontal[24], Spaces.paddingVertical[16]]}>
        <ScrollView
          contentContainerStyle={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.gap[12],
            { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <View style={styles.hero}>
            <View pointerEvents="none" style={styles.celebrationBand}>
              {CELEBRATION_DOTS.map((dot) => (
                <View
                  key={`${dot.left}-${dot.top}`}
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
            </View>
            <View
              style={[
                styles.heroHalo,
                { backgroundColor: withAlpha(Colors.success500, 0.08) },
              ]}
            >
              <View
                style={[
                  styles.heroRing,
                  {
                    backgroundColor: withAlpha(Colors.success500, 0.12),
                    borderColor: Colors.success500,
                  },
                ]}
              >
                <Text style={{ color: Colors.success500, fontSize: 26, lineHeight: 32 }}>✓</Text>
              </View>
            </View>
          </View>

          <Text style={[Fonts.h2Bold, Fonts.neutral00, Fonts.textCenter]}>
            C&apos;est débloqué !
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter, styles.offerLine]}>
            Offre
            {' '}
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{offerLabel}</Text>
            {' '}
            — active pour toute l&apos;équipe, dès maintenant.
          </Text>

          <View
            style={[
              styles.glassCard,
              { borderColor: withAlpha(Colors.primary500, 0.25) },
            ]}
          >
            {/* Motif de carte verre du depot (ClubCardSurface.js:45) : le
                degrade est POSE DERRIERE en absoluteFill, le conteneur garde sa
                hauteur naturelle. L'angle suit le handoff (168deg). */}
            <LinearGradient
              colors={[withAlpha(Colors.primary700, 0.9), withAlpha(Colors.primary900, 0.96)]}
              end={{ x: 0.21, y: 1 }}
              pointerEvents="none"
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                styles.innerTopHighlight,
                { backgroundColor: withAlpha(Colors.neutral00, 0.14) },
              ]}
            />
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {t('subscriptionSuccess.unlockedTitle', 'Ton offre débloque :')}
            </Text>
            <View style={styles.unlockGrid}>
              {unlockedCapabilities.map((capabilityId) => (
                <View key={capabilityId} style={styles.unlockCell}>
                  <Text style={{ color: Colors.success500, fontSize: 12, lineHeight: 16 }}>✓</Text>
                  <Text
                    numberOfLines={2}
                    style={[Fonts.small, Fonts.neutral200, styles.unlockLabel]}
                  >
                    {resolveUnlockLabel(capabilityId)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.firstActionBlock}>
            <Text style={[Fonts.p3Bold, Fonts.neutral00, Fonts.textCenter]}>
              {t(
                'subscriptionSuccess.firstActionTitle',
                'Que veux-tu faire en premier pour profiter de ton abonnement ?',
              )}
            </Text>
            <View style={styles.firstActionGrid}>
              {firstActions.map((action) => (
                <TouchableOpacity
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  key={action.id}
                  onPress={() => handleFirstAction(action)}
                  style={[
                    styles.firstActionCard,
                    {
                      backgroundColor: withAlpha(Colors.primary700, 0.55),
                      borderColor: withAlpha(Colors.primary500, 0.28),
                    },
                  ]}
                >
                  <Image
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    resizeMode="contain"
                    // `?.` volontaire : c'est l'ecran qui suit un PAIEMENT. Une
                    // icone manquante doit laisser un trou, jamais faire tomber
                    // l'ecran (RN ignore une `source` indefinie sans broncher).
                    source={Images?.[/** @type {keyof typeof Images} */ (action.icon)]}
                    style={styles.firstActionIcon}
                    tintColor={Colors.primary500}
                  />
                  <Text
                    numberOfLines={2}
                    style={[Fonts.p3, Fonts.neutral100, Fonts.textCenter]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[Spaces.gap[12]]}>
          <Button
            onPress={handleResume}
            title={resumeCtaLabel}
            variant="Primary"
          />
          {/* Le pied reste celui du lot L11. Seul ajout : le libelle
              d'accessibilite, rendu necessaire par les cartes de premiers pas
              qui sont, elles aussi, des TouchableOpacity — il nomme la cible
              pour un lecteur d'ecran comme pour un test. */}
          <TouchableOpacity
            accessibilityLabel="Retour à l'accueil"
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

const styles = StyleSheet.create({
  // Bande decorative des confettis : hors du flux, debordant de part et d'autre
  // du heros et POSEE AU-DESSUS de lui. Cout en hauteur : zero.
  celebrationBand: {
    height: 44,
    left: -70,
    position: 'absolute',
    right: -70,
    top: -40,
  },
  firstActionBlock: {
    gap: 8,
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
  },
  firstActionCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 8,
    paddingVertical: 10,
    width: '48%',
  },
  firstActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  firstActionIcon: {
    height: 18,
    width: 18,
  },
  glassCard: {
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    // Le degrade est en absoluteFill derriere le contenu : sans cette decoupe
    // il depasserait des coins arrondis.
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
  },
  heroHalo: {
    alignItems: 'center',
    borderRadius: 999,
    height: HERO_HALO_SIZE,
    justifyContent: 'center',
    width: HERO_HALO_SIZE,
  },
  heroRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: HERO_RING_SIZE,
    justifyContent: 'center',
    width: HERO_RING_SIZE,
  },
  // Lisere clair interieur en haut de la carte verre (handoff 7a).
  innerTopHighlight: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  offerLine: {
    maxWidth: 300,
  },
  unlockCell: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 6,
    paddingRight: 8,
    width: '50%',
  },
  unlockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  unlockLabel: {
    flexShrink: 1,
  },
});

export default SubscriptionSuccess;
