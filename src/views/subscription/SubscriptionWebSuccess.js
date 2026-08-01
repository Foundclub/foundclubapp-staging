import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  finalizeStripeWebCheckoutSession,
  trackSubscriptionFunnelEvent,
} from '@/services/subscription/subscriptionService';

/**
 * Retour de Stripe Checkout (rail web) : /subscription/web-success?session_id=cs_...
 * Finalise la session aupres du serveur (verification payeur + transmission a
 * RevenueCat) puis celebre via l'ecran de succes commun. Les droits sont ouverts
 * par le webhook RevenueCat — d'ou les re-invalidations differees, comme sur
 * mobile (convergence du cache profil ~2-3 s).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement}
 */
function SubscriptionWebSuccess({ navigation, route }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const queryClient = useQueryClient();
  const sessionId = String(route?.params?.session_id || route?.params?.sessionId || '');
  const [status, setStatus] = useState('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return undefined;
    }
    startedRef.current = true;

    let cancelled = false;

    const finalize = async () => {
      if (!sessionId) {
        setStatus('error');
        setErrorMessage('Session de paiement introuvable.');
        return;
      }
      try {
        const result = await finalizeStripeWebCheckoutSession({ sessionId });
        if (cancelled) {
          return;
        }
        if (result?.status === 'submitted') {
          trackSubscriptionFunnelEvent('purchase_succeeded', { source: 'stripe-web' });
          // Posees ici, les relances differees mouraient au demontage — et cet
          // ecran se remplace lui-meme des `status === 'success'` (L08).
          scheduleSubscriptionStateRefresh(queryClient);
          setStatus('success');
          return;
        }
        // paiement pas encore confirme cote Stripe (paiement differe) : la
        // reconciliation passera par le webhook, on informe sans bloquer.
        setStatus('success');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(error?.message || 'Impossible de confirmer le paiement.');
        }
      }
    };

    finalize();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    invalidateSubscriptionState(queryClient);
    if (status === 'success') {
      navigation.replace(RouteNames.SubscriptionSuccess, {
        offerLabel: 'FoundClub',
        resumeCtaLabel: "C'est parti !",
        resumeMode: 'home',
      });
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
  };

  useEffect(() => {
    if (status === 'success') {
      handleContinue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <ScreenContainer bgImage="bg2">
      <View
        style={[
          Alignments.fill,
          Alignments.alignCenter,
          Alignments.justifyCenter,
          Spaces.gap[16],
          Spaces.padding[24],
        ]}
      >
        {status === 'error' ? (
          <>
            <Text style={[Fonts.h2Bold, Fonts.neutral00, Fonts.textCenter]}>
              Confirmation impossible
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter, { maxWidth: 320 }]}>
              {errorMessage}
              {' '}
              Si tu as bien été débité, tes droits s&apos;activeront automatiquement d&apos;ici
              quelques minutes.
            </Text>
            <Button onPress={handleContinue} title="Retour à l'accueil" variant="Primary" />
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
              Confirmation du paiement…
            </Text>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

export default SubscriptionWebSuccess;
