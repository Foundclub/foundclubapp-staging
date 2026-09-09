import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { getCurrentRouteName, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  PENDING_TRAINING_REVIEWS_QUERY_KEY,
  useGetPendingTrainingReviews,
} from '@/services/trainingReview/trainingReviewQueries';
import { submitTrainingReview } from '@/services/trainingReview/trainingReviewService';

import { getWebBackgroundPollMs } from '@/utils/webRuntime';

import { POPUP_DISMISS_SCOPES, POPUP_IDS } from '@/constants/popupRegistry';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

/**
 * LOT AVIS — le pop-up « note ton entrainement ».
 *
 * 🧬 C EST UN FRERE de `MatchStatsPromptHost`, pas une modification de celui-ci :
 * la mecanique des rappels post-match fonctionne, et la toucher pour y greffer
 * un second sujet aurait mis les deux en risque. Ce qui est recopie : la requete
 * des sollicitations, l eligibilite (`usePopupEligibility`), le reveil au retour
 * au premier plan, et la fermeture sans action.
 *
 * Ce que demande Adel, et RIEN d autre : une note de 1 a 10, un commentaire
 * facultatif, un bouton pour passer. Rien n est obligatoire.
 */

/**
 * L ecran de la fiche d un evenement : y superposer une feuille qui parle du
 * meme evenement n aurait aucun sens.
 */
const BLOCKED_ROUTES = /** @type {Set<string>} */ (new Set([RouteNames.EventDetails]));

/**
 * Une date de fin lisible, ou rien du tout.
 * @param {string | number | Date | null | undefined} valeur - La date brute.
 * @returns {string} - Une date lisible, ou une chaine vide.
 */
const formatDateDeFin = (valeur) => {
  if (!valeur) return '';
  try {
    return new Date(valeur).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
    });
  } catch {
    return '';
  }
};

/**
 * Le pop-up qui demande son avis a un participant apres un entrainement.
 * @param {{ skipInitialFetch?: boolean }} [props] - Les proprietes.
 * @returns {import('react').ReactElement | null} - La feuille, ou rien.
 */
function TrainingReviewPromptHost({ skipInitialFetch = false } = {}) {
  const [{ auth }] = useAppContext();
  const { isBootstrapResolved } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [dismissedPromptKey, setDismissedPromptKey] = useState(/** @type {string | null} */ (null));
  const [currentRouteName, setCurrentRouteName] = useState(/** @type {string | null} */ (null));
  const [isNavigationReady, setIsNavigationReady] = useState(navigationRef.isReady());
  const [rating, setRating] = useState(/** @type {number | null} */ (null));
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const shownPromptKeyRef = useRef(/** @type {string | null} */ (null));

  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  let pollInterval = false;
  if (auth?.token && isBootstrapResolved && Platform.OS === 'web') {
    pollInterval = getWebBackgroundPollMs();
  }

  const { data: payload, refetch } = useGetPendingTrainingReviews({
    enabled: Boolean(auth?.token) && !skipInitialFetch && isBootstrapResolved,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  });

  const nextPrompt = payload?.nextPrompt || null;
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;

  const shouldShowPrompt = Boolean(
    auth?.token
    && nextPrompt
    && isNavigationReady
    && !isBlockedRoute
    && (!dismissedPromptKey || dismissedPromptKey !== nextPrompt.key),
  );

  const trainingReviewPopup = usePopupEligibility(
    POPUP_IDS.TRAINING_REVIEW_PROMPT,
    shouldShowPrompt,
    {
      cooldownKey: nextPrompt?.key || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const canShowPrompt = useBlockingOverlayPrompt(
    trainingReviewPopup.descriptor.id,
    trainingReviewPopup.canShow,
    trainingReviewPopup.descriptor.priority,
  );
  const isVisible = Boolean(shouldShowPrompt && trainingReviewPopup.canShow && canShowPrompt);
  useBlockingOverlayLifecycle(trainingReviewPopup.descriptor.id, isVisible, {
    releaseDelayMs: 360,
  });

  // 🧨 LA FEUILLE MENT SUR SA GEOMETRIE (memoire du projet, BottomModal) : un
  // `headerComponent` n entre pas dans la mesure, et pour faire remonter le haut
  // on AJOUTE de la marge basse. Le titre est donc le PREMIER ENFANT du contenu,
  // et la marge vit sur un enfant — jamais sur le conteneur.
  // ⚠️ En plus, il y a un champ de saisie ici, ce que le pop-up des matchs n a
  // pas : le clavier qui monte n a aucun precedent dans ce depot. Jest ne calcule
  // aucune mise en page, la porte resterait verte sur une feuille coupee — c est
  // l emulateur qui tranche.
  const modalBottomSpacer = (isCompactMobile ? 28 : 36) + insets.bottom;
  const modalSnapPoint = isCompactMobile ? '86%' : '78%';

  const dismissPromptForSession = useCallback(() => {
    if (nextPrompt?.key) setDismissedPromptKey(nextPrompt.key);
    trainingReviewPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
  }, [nextPrompt?.key, trainingReviewPopup]);

  useEffect(() => {
    if (!isVisible || !nextPrompt?.key) {
      shownPromptKeyRef.current = null;
      return;
    }
    if (shownPromptKeyRef.current === nextPrompt.key) return;
    shownPromptKeyRef.current = nextPrompt.key;
    // Une sollicitation qui change : la saisie precedente n a plus de sujet.
    setRating(null);
    setComment('');
    /** @type {any} */ (trainingReviewPopup).markShown({ promptKey: nextPrompt.key });
  }, [isVisible, nextPrompt?.key, trainingReviewPopup]);

  const handleSubmit = useCallback(async () => {
    if (!nextPrompt?.eventDocumentId || rating === null || isSending) return;

    setIsSending(true);
    try {
      await submitTrainingReview(nextPrompt.eventDocumentId, {
        comment: comment.trim() || null,
        rating,
      });
      dismissPromptForSession();
      // 🧊 `invalidateQueries` ne relit RIEN sur une requete en veille (memoire
      // du projet) : on redemande explicitement.
      queryClient.invalidateQueries({ queryKey: PENDING_TRAINING_REVIEWS_QUERY_KEY });
      await refetch();
    } finally {
      setIsSending(false);
    }
  }, [
    comment,
    dismissPromptForSession,
    isSending,
    nextPrompt?.eventDocumentId,
    queryClient,
    rating,
    refetch,
  ]);

  useEffect(() => {
    if (!auth?.token) {
      setDismissedPromptKey(null);
      return undefined;
    }

    const syncCurrentRoute = () => {
      setIsNavigationReady(navigationRef.isReady());
      setCurrentRouteName(getCurrentRouteName());
    };

    syncCurrentRoute();
    const unsubscribeState = typeof navigationRef.addListener === 'function'
      ? navigationRef.addListener('state', syncCurrentRoute)
      : undefined;
    const unsubscribeReady = typeof navigationRef.addListener === 'function'
      ? navigationRef.addListener('ready', syncCurrentRoute)
      : undefined;

    return () => {
      unsubscribeState?.();
      unsubscribeReady?.();
    };
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token) return undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = /inactive|background/.test(appStateRef.current);
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active' && isBootstrapResolved) {
        setDismissedPromptKey(null);
        queryClient.invalidateQueries({ queryKey: PENDING_TRAINING_REVIEWS_QUERY_KEY });
        refetch();
      }
    });

    return () => subscription.remove();
  }, [auth?.token, isBootstrapResolved, queryClient, refetch]);

  if (!auth?.token || !nextPrompt || !isVisible) return null;

  const sousTitre = t('trainingReviewPrompt.subtitle', {
    date: formatDateDeFin(nextPrompt?.endedAt),
    team: nextPrompt?.teamName || nextPrompt?.eventName || '',
  });

  return (
    <BottomModal
      close={dismissPromptForSession}
      contentBottomPaddingOverride={modalBottomSpacer}
      contentContainerStyle={{
        paddingBottom: modalBottomSpacer,
        paddingTop: isCompactMobile ? 10 : 14,
      }}
      isVisible={isVisible}
      preventStartupPresentation
      snapPoints={[modalSnapPoint]}
    >
      <View style={[Spaces.gap[isCompactMobile ? 16 : 24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('trainingReviewPrompt.title')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{sousTitre}</Text>
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {t('trainingReviewPrompt.anonymous')}
          </Text>
        </View>

        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('trainingReviewPrompt.ratingLabel')}
          </Text>
          {/* L echelle de 1 a 10, recopiee de PlayerMatchResponseScreen : aucun
              composant partage n existe pour ca dans ce depot. */}
          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((valeur) => {
              const estActive = rating === valeur;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={valeur}
                  onPress={() => setRating(valeur)}
                  style={[
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[10],
                    {
                      backgroundColor: estActive ? Colors.primary500 : Colors.primary700,
                      borderColor: estActive ? Colors.primary200 : Colors.neutral500,
                      borderRadius: 16,
                      borderWidth: 1,
                      minWidth: isCompactMobile ? 44 : 48,
                    },
                  ]}
                >
                  <Text
                    style={[
                      Fonts.p2Bold,
                      estActive ? Fonts.primary100 : Fonts.neutral00,
                      Fonts.textCenter,
                    ]}
                  >
                    {valeur}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setComment}
          placeholder={t('trainingReviewPrompt.commentPlaceholder')}
          placeholderTextColor={Colors.neutral400}
          style={[
            Fonts.p2,
            Fonts.neutral00,
            { borderRadius: 20 },
            Spaces.padding[16],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.neutral500,
              borderWidth: 1,
              minHeight: isCompactMobile ? 96 : 112,
              textAlignVertical: 'top',
            },
          ]}
          value={comment}
        />

        <View style={[{ gap: isCompactMobile ? 16 : 24 }]}>
          <Button
            disabled={rating === null || isSending}
            onPress={handleSubmit}
            style={[ApplicationStyle.borderRadius24, { minHeight: isCompactMobile ? 54 : 56 }]}
            title={isSending ? t('trainingReviewPrompt.sending') : t('trainingReviewPrompt.submit')}
            variant="Primary"
          />
          <Button
            onPress={dismissPromptForSession}
            style={[ApplicationStyle.borderRadius24, { minHeight: isCompactMobile ? 54 : 56 }]}
            title={t('trainingReviewPrompt.later')}
            variant="Secondary"
          />
          {/* La marge vit sur un ENFANT : le `contentContainerStyle` de l appelant
              est ecrase par la feuille (memoire du projet). */}
          <View pointerEvents="none" style={{ height: modalBottomSpacer }} />
        </View>
      </View>
    </BottomModal>
  );
}

export default TrainingReviewPromptHost;
