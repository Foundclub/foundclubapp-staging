import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { getCurrentRouteName, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  PENDING_TRAINING_REVIEWS_QUERY_KEY,
  TRAINING_REVIEW_STALE_MS,
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
 *
 * ST-RETOURS (02/10, planche 20 du design valide des statistiques) :
 *   · la seance nommee (« Entraînement U13 · jeu. 1 oct., fin à 17:00 ») ;
 *   · dix pastilles sur deux rangees de cinq, cibles de 44 px ;
 *   · l anonymat dit PRES du bouton, avec le prenom de l entraineur ;
 *   · un envoi qui echoue LE DIT, et la note est gardee (defaut 11 : il n y avait pas de catch,
 *     le joueur croyait avoir envoye) ;
 *   · un merci, puis la seance suivante s il en reste une a noter (moins de 7 jours).
 * L entraineur n a plus de fenetre : le serveur ne lui rend plus sa propre seance (defaut 10).
 */

/**
 * L ecran de la fiche d un evenement : y superposer une feuille qui parle du
 * meme evenement n aurait aucun sens.
 */
const BLOCKED_ROUTES = /** @type {Set<string>} */ (new Set([RouteNames.EventDetails]));

/** Les dix notes, en deux rangees de cinq (planche 20). */
const RANGEES_DE_NOTES = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];

/**
 * Le jour et l heure de fin d une seance : `{ day: 'jeu. 1 oct.', time: '17:00' }`.
 * @param {string | number | Date | null | undefined} valeur - La date brute.
 * @returns {{ day: string, time: string }} - Les deux morceaux, vides si la date est illisible.
 */
const jourEtHeureDeFin = (valeur) => {
  const date = new Date(/** @type {any} */ (valeur || ''));
  if (!valeur || Number.isNaN(date.getTime())) return { day: '', time: '' };
  return {
    day: new Intl.DateTimeFormat(localeDesFormats(), {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(date),
    time: new Intl.DateTimeFormat(localeDesFormats(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  };
};

/**
 * La premiere lettre en capitale (« Mar. 29 sept. »).
 * @param {string} texte - Le texte.
 * @returns {string} - Le texte, capitalise.
 */
const capitaliser = (texte) => (texte ? `${texte.charAt(0).toUpperCase()}${texte.slice(1)}` : '');

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
  // ST-RETOURS — `form` · `sending` · `error` (l envoi a echoue) · `thanks` (le merci).
  const [phase, setPhase] = useState('form');
  // La seance choisie dans le merci (« Encore 1 séance à noter ») ; sinon la prochaine.
  const [selectedKey, setSelectedKey] = useState(/** @type {string | null} */ (null));
  const [thanks, setThanks] = useState(
    /** @type {{ remaining: any[], trainerFirstname: string | null } | null} */ (null),
  );
  const appStateRef = useRef(AppState.currentState);
  const shownPromptKeyRef = useRef(/** @type {string | null} */ (null));

  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
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

  const items = useMemo(
    () => (Array.isArray(payload?.items) ? payload.items : []),
    [payload?.items],
  );
  const nextPrompt = payload?.nextPrompt || null;
  const activePrompt = (selectedKey && items.find((item) => item?.key === selectedKey))
    || nextPrompt;
  const isBlockedRoute = currentRouteName ? BLOCKED_ROUTES.has(currentRouteName) : false;
  const isCompactMobile = width < 390 || height < 760;

  const shouldShowPrompt = Boolean(
    auth?.token
    && (activePrompt || thanks)
    && isNavigationReady
    && !isBlockedRoute
    && (thanks || !dismissedPromptKey || dismissedPromptKey !== activePrompt?.key),
  );

  const trainingReviewPopup = usePopupEligibility(
    POPUP_IDS.TRAINING_REVIEW_PROMPT,
    shouldShowPrompt,
    {
      cooldownKey: activePrompt?.key || 'default',
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
    const cle = nextPrompt?.key || activePrompt?.key;
    if (cle) setDismissedPromptKey(cle);
    setThanks(null);
    setSelectedKey(null);
    setPhase('form');
    trainingReviewPopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
  }, [activePrompt?.key, nextPrompt?.key, trainingReviewPopup]);

  useEffect(() => {
    if (!isVisible || !activePrompt?.key) {
      shownPromptKeyRef.current = null;
      return;
    }
    if (shownPromptKeyRef.current === activePrompt.key) return;
    shownPromptKeyRef.current = activePrompt.key;
    // Une sollicitation qui change : la saisie precedente n a plus de sujet.
    // Pendant le merci, la liste relue avance toute seule : on ne touche a rien.
    if (thanks) return;
    setRating(null);
    setComment('');
    setPhase('form');
    /** @type {any} */ (trainingReviewPopup).markShown({ promptKey: activePrompt.key });
  }, [activePrompt?.key, isVisible, thanks, trainingReviewPopup]);

  const handleSubmit = useCallback(async () => {
    if (!activePrompt?.eventDocumentId || rating === null || phase === 'sending') return;

    setPhase('sending');
    try {
      await submitTrainingReview(activePrompt.eventDocumentId, {
        comment: comment.trim() || null,
        rating,
      });
    } catch {
      // ST-RETOURS (defaut 11) — l echec se DIT ; la note et le mot restent.
      setPhase('error');
      return;
    }
    setThanks({
      remaining: items.filter((item) => item?.key && item.key !== activePrompt.key),
      trainerFirstname: activePrompt?.trainerFirstname || null,
    });
    setSelectedKey(null);
    setPhase('thanks');
    // 🧊 `invalidateQueries` ne relit RIEN sur une requete en veille (memoire
    // du projet) : on redemande explicitement.
    queryClient.invalidateQueries({ queryKey: PENDING_TRAINING_REVIEWS_QUERY_KEY });
    refetch();
  }, [activePrompt, comment, items, phase, queryClient, rating, refetch]);

  const openNextSession = useCallback((/** @type {any} */ item) => {
    setThanks(null);
    setSelectedKey(item?.key || null);
    setRating(null);
    setComment('');
    setPhase('form');
  }, []);

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
        // FINITIONS6 · point 7 (tournee 8, reseau) — UNE lecture au retour, et seulement
        // si la donnee a plus que sa fraicheur (30 s). Avant : `invalidateQueries`
        // relancait deja la lecture (requete observee), puis `refetch()` une seconde ;
        // journal T8 : 386 appels, toujours par paires, a chaque retour — et des retours
        // toutes les 1 a 3 s (fenetre systeme, permission) relisaient a chaque fois.
        const requete = queryClient.getQueryCache()
          .find({ queryKey: PENDING_TRAINING_REVIEWS_QUERY_KEY });
        if (!requete || requete.isStaleByTime(TRAINING_REVIEW_STALE_MS)) refetch();
      }
    });

    return () => subscription.remove();
  }, [auth?.token, isBootstrapResolved, queryClient, refetch]);

  if (!auth?.token || !(activePrompt || thanks) || !isVisible) return null;

  const isSending = phase === 'sending';
  const isError = phase === 'error';
  const boutonPlein = { minHeight: isCompactMobile ? 54 : 56 };

  /**
   * « Entraînement U13 · jeu. 1 oct., fin à 17:00 ».
   * @param {any} item - La seance a noter.
   * @returns {{ end: string, label: string }} - Son nom, et sa fin.
   */
  const nommerLaSeance = (item) => {
    const team = String(item?.teamName || '').trim();
    const { day, time } = jourEtHeureDeFin(item?.endedAt);
    return {
      end: day ? t('stRetours.prompt.sessionEnd', { day, time, ...SANS_ECHAPPEMENT }) : '',
      label: team
        ? t('stRetours.prompt.sessionLabel', { team, ...SANS_ECHAPPEMENT })
        : String(item?.eventName || '').trim(),
    };
  };

  /**
   * La ligne « qui peut lire » : un cadenas, et la phrase.
   * @param {string} texte - La phrase.
   * @returns {import('react').ReactElement} - La ligne.
   */
  const ligneAnonymat = (texte) => (
    <View style={[Alignments.row, Alignments.justifyCenter, { gap: 8 }]}>
      <Icone
        color={Colors.neutral300}
        height={14}
        name="shield"
        style={{ marginTop: 2 }}
        width={14}
      />
      <Text style={[Fonts.p3, Fonts.neutral300, { flexShrink: 1 }]}>{texte}</Text>
    </View>
  );

  let contenu;
  if (thanks) {
    const restantes = thanks.remaining;
    contenu = (
      <View style={[Spaces.gap[isCompactMobile ? 16 : 24]]}>
        <View
          style={[
            Alignments.row,
            {
              backgroundColor: withAlpha(Colors.success500, 0.1),
              borderColor: withAlpha(Colors.success500, 0.4),
              borderRadius: 12,
              borderWidth: 1,
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
          ]}
        >
          <Icone
            color={Colors.success500}
            height={20}
            name="check"
            style={{ marginTop: 2 }}
            width={20}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('stRetours.prompt.thanksTitle')}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {thanks.trainerFirstname
                ? t('stRetours.prompt.thanksHint', {
                  trainer: thanks.trainerFirstname,
                  ...SANS_ECHAPPEMENT,
                })
                : t('stRetours.prompt.thanksHintNoName')}
            </Text>
          </View>
        </View>

        {restantes.length ? (
          <View style={{ gap: 12 }}>
            <Text
              style={[
                Fonts.label,
                Fonts.neutral300,
                { letterSpacing: 1.2, textTransform: 'uppercase' },
              ]}
            >
              {t('stRetours.prompt.nextCount', { count: restantes.length })}
            </Text>
            {restantes.map((item) => {
              const seance = nommerLaSeance(item);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={item.key}
                  onPress={() => openNextSession(item)}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    {
                      backgroundColor: Colors.neutral800,
                      borderColor: Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 1,
                      gap: 12,
                      minHeight: 56,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    },
                  ]}
                  testID="training-review-next-session"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{seance.label}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>{capitaliser(seance.end)}</Text>
                  </View>
                  <Icone color={Colors.primary500} height={12} name="arrow-right" width={12} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <Button
          onPress={dismissPromptForSession}
          style={boutonPlein}
          title={t('stRetours.prompt.close')}
          variant="Ghost"
        />
        <View pointerEvents="none" style={{ height: modalBottomSpacer }} />
      </View>
    );
  } else {
    const seance = nommerLaSeance(activePrompt);
    const trainer = String(activePrompt?.trainerFirstname || '').trim();
    contenu = (
      <View style={[Spaces.gap[isCompactMobile ? 16 : 24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text
            style={[
              Fonts.p3Bold,
              Fonts.primary200,
              { letterSpacing: 0.4, textTransform: 'uppercase' },
            ]}
          >
            {[seance.label, seance.end].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t('stRetours.prompt.title')}</Text>
        </View>

        <View
          accessibilityLabel={t('stRetours.prompt.ratingGroup')}
          accessibilityRole="radiogroup"
          style={{ gap: 8 }}
        >
          {RANGEES_DE_NOTES.map((rangee) => (
            <View
              key={rangee[0]}
              style={[Alignments.row, { gap: 8 }]}
              testID="training-review-rating-row"
            >
              {rangee.map((valeur) => {
                const estActive = rating === valeur;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: estActive, disabled: isSending }}
                    disabled={isSending}
                    key={valeur}
                    onPress={() => setRating(valeur)}
                    style={[
                      Alignments.justifyCenter,
                      Alignments.alignCenter,
                      {
                        backgroundColor: estActive ? Colors.primary500 : 'transparent',
                        borderColor: estActive ? Colors.primary500 : Colors.neutral500,
                        borderRadius: 22,
                        borderWidth: 1,
                        flex: 1,
                        height: 44,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p2Bold, estActive ? Fonts.primary900 : Fonts.neutral00]}>
                      {valeur}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {isError ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: withAlpha(Colors.error500, 0.08),
              borderColor: withAlpha(Colors.error500, 0.35),
              borderRadius: 16,
              borderWidth: 1,
              gap: 4,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('stRetours.prompt.errorTitle')}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{t('stRetours.prompt.errorHint')}</Text>
          </View>
        ) : (
          <TextInput
            editable={!isSending}
            multiline
            numberOfLines={3}
            onChangeText={setComment}
            placeholder={t('stRetours.prompt.commentPlaceholder')}
            placeholderTextColor={Colors.neutral400}
            style={[
              Fonts.p2,
              Fonts.neutral00,
              Spaces.padding[16],
              {
                borderColor: Colors.neutral300,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 84,
                textAlignVertical: 'top',
              },
            ]}
            value={comment}
          />
        )}

        <View style={[{ gap: 12 }]}>
          {!isError && !isSending ? ligneAnonymat(trainer
            ? t('stRetours.prompt.anonymous', { trainer, ...SANS_ECHAPPEMENT })
            : t('stRetours.prompt.anonymousNoName')) : null}
          <Button
            disabled={rating === null || isSending}
            isLoading={isSending}
            onPress={handleSubmit}
            style={boutonPlein}
            title={isError ? t('stRetours.prompt.retry') : t('stRetours.prompt.submit')}
            variant="Primary"
          />
          {!isSending ? (
            <Button
              onPress={dismissPromptForSession}
              style={boutonPlein}
              title={t('stRetours.prompt.later')}
              variant="Ghost"
            />
          ) : null}
          {/* La marge vit sur un ENFANT : le `contentContainerStyle` de l appelant
              est ecrase par la feuille (memoire du projet). */}
          <View pointerEvents="none" style={{ height: modalBottomSpacer }} />
        </View>
      </View>
    );
  }

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
      {contenu}
    </BottomModal>
  );
}

export default TrainingReviewPromptHost;
