import { useEffect } from 'react';
import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

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

/**
 * Ecran de succes d'achat (handoff 6a) : celebration compacte, 1 ligne de
 * confirmation, recu discret vers Mon abonnement, CTA unique qui relance la
 * tache interrompue (la reprise de tache est le heros).
 * Params navigation :
 * - offerLabel : ex. « Équipe · 2 équipes »
 * - resumeCtaLabel : ex. « Créer ma 2ᵉ équipe » (defaut « Reprendre »)
 * - renewalDateLabel : ex. « 10 juillet 2027 » (optionnel)
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement}
 */
function SubscriptionSuccess({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const offerLabel = String(route?.params?.offerLabel || 'Équipe');
  const resumeCtaLabel = String(route?.params?.resumeCtaLabel || 'Reprendre');
  const renewalDateLabel = String(route?.params?.renewalDateLabel || '');
  // 'back' (defaut) = la tache interrompue vit sous cet ecran dans la pile ;
  // 'home' = achat depuis le Recap de fin de tour, on repart sur l'accueil.
  const resumeMode = String(route?.params?.resumeMode || 'back');
  const storeLabel = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  const handleGoHome = () => {
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

  const handleResume = () => {
    trackSubscriptionFunnelEvent('success_resume_clicked', { source: resumeMode });
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

        <View
          style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter, Spaces.gap[16]]}
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
        </View>

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
