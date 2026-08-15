/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSubscriptionRequiredScope } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * C-C — ECRAN 12 du pack composition : le mur payant de la composition, en
 * ECRAN PLEIN.
 *
 * Une FEUILLE de paywall existait deja et savait recevoir la clef
 * `composition-required` — avec 3 arguments. Le pack en demande 5, en ecran
 * plein, avec le rond cyan et le cadenas. Ce lot ne refait donc PAS le
 * branchement du refus (le lot C-A l'a pose et prouve) : il refait la FORME.
 *
 * ⛔ CE QU'IL NE TOUCHE PAS, ET C'EST VOLONTAIRE : aucun prix, aucun palier,
 * aucune regle d'abonnement. Cet ecran ne lit meme pas le catalogue — il
 * renvoie sur le carrousel d'offres, exactement la ou la feuille existante
 * renvoie deja (`SubscriptionPaywallSheet.handleOpenSubscription`).
 *
 * 🚪 SA PORTE : un refus d'abonnement sur un geste de composition. Aujourd'hui
 * l'ecran 11 l'ouvre. ⚠️ Le refus de PUBLICATION — celui que le pack designe
 * comme le vrai declencheur (« a la publication, pas a l'ouverture du module »)
 * — se branche dans `views/matchCallUp/MatchCompositionBoard.js`, qui appartient
 * a un autre lot en cours : ce fil-la reste a tirer.
 */

/** Les 5 arguments du pack, dans son ordre exact. */
const BENEFIT_KEYS = ['twoTaps', 'field', 'template', 'autoSplit', 'responses'];

/** Diametre du rond cyan qui porte le cadenas. */
const LOCK_CIRCLE = 78;

function CompositionPaywallScreen() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const { decision = null, resumeRouteName = '', resumeRouteParams = undefined } = params;

  // Meme destination que la feuille existante : le CARROUSEL d'offres, sur la
  // bonne famille d'offre. Une personne carte bleue en main doit trouver quoi
  // payer (L10-A), et le hub ne porte plus aucun catalogue (L33).
  const handleSubscribe = useCallback(() => {
    // @ts-ignore — `navigate` est bien la sur un ecran de pile.
    navigation.navigate(RouteNames.ProfileStack, {
      params: {
        focusScope: getSubscriptionRequiredScope(decision),
        ...(resumeRouteName ? { resumeRouteName, resumeRouteParams } : {}),
      },
      screen: RouteNames.SubscriptionOffers,
    });
  }, [decision, navigation, resumeRouteName, resumeRouteParams]);

  const handleCompare = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.GuideOffersRecap);
  }, [navigation]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('compositionPaywall.title')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('compositionPaywall.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        <View
          style={[
            styles.lockCircle,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.14),
              borderColor: withAlpha(Colors.primary500, 0.45),
            },
          ]}
        >
          {/* Le cadenas est DESSINE, pas importe : le design system n'a aucune
              icone de cadenas (mesure du 2026-08-15), et ajouter un asset pour
              un seul ecran serait plus cher que deux Views. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={styles.lockShackle}
          >
            <View style={[styles.lockArc, { borderColor: Colors.primary500 }]} />
            <View style={[styles.lockBody, { backgroundColor: Colors.primary500 }]} />
          </View>
        </View>

        <Text style={[Fonts.h2Bold, styles.wall, { color: Colors.neutral00 }]}>
          {t('compositionPaywall.wall')}
        </Text>
        <Text style={[Fonts.p2, styles.text, { color: Colors.neutral300 }]}>
          {t('compositionPaywall.text')}
        </Text>

        <View style={styles.benefits}>
          {BENEFIT_KEYS.map((key) => (
            <View
              key={key}
              style={[
                styles.benefitRow,
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.04),
                  borderColor: withAlpha(Colors.neutral00, 0.09),
                },
              ]}
            >
              <View style={[styles.benefitCheck, { backgroundColor: Colors.primary500 }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>✓</Text>
              </View>
              <Text style={[Fonts.p3Bold, styles.benefitLabel, { color: Colors.neutral00 }]}>
                {t(`compositionPaywall.benefits.${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          onPress={handleSubscribe}
          title={t('compositionPaywall.actions.subscribe')}
          variant="Primary"
        />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleCompare}
          style={styles.compare}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>
            {t('compositionPaywall.actions.compare')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  benefitCheck: {
    alignItems: 'center',
    borderRadius: 4,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  benefitLabel: {
    flex: 1,
  },
  benefitRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  benefits: {
    gap: 9,
    marginTop: 22,
  },
  compare: {
    alignItems: 'center',
    minHeight: 44,
    paddingTop: 12,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerTexts: {
    flex: 1,
  },
  // Meme idiome que les autres ecrans du pack : `flex: 1` BORNE la zone qui
  // defile, sinon le contenu pousse la barre du bas hors de l'ecran (D84).
  list: {
    flex: 1,
  },
  lockArc: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 3,
    height: 12,
    width: 18,
  },
  lockBody: {
    borderRadius: 4,
    height: 17,
    width: 26,
  },
  lockCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    height: LOCK_CIRCLE,
    justifyContent: 'center',
    marginTop: 8,
    width: LOCK_CIRCLE,
  },
  lockShackle: {
    alignItems: 'center',
  },
  screen: {
    paddingHorizontal: 0,
  },
  text: {
    marginTop: 10,
    textAlign: 'center',
  },
  wall: {
    marginTop: 16,
    textAlign: 'center',
  },
});

export default CompositionPaywallScreen;
