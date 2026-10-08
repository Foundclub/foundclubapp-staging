import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { isRsvpEnabled } from '@/domains/event/presenceRule';
import useMessaging from '@/domains/messaging/useMessaging';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import { readPlacementsFromPack } from '@/views/matchCallUp/matchCompositionUtils';

import { useGetChatMessages } from '@/services/chat/chatQueriesCompat';
import { createChatMessage } from '@/services/chat/chatService';
import { useGetEvents, useGetEventTeamComposition } from '@/services/event/eventQueries';
import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import ConvocationDetailsStep from './ConvocationDetailsStep';
import ConvocationEventRecap from './ConvocationEventRecap';
import ConvocationEventStep from './ConvocationEventStep';
import ConvocationPlacementStep from './ConvocationPlacementStep';
import ConvocationPlayersStep from './ConvocationPlayersStep';
import {
  buildConvocationPack,
  buildConvocationRows,
  buildDetailsMessageText,
  buildPitchPlacements,
  buildSelectionFromPack,
  CONVOCATION_STEPS,
  DEFAULT_MEETING_POINT,
  filterTeamEvents,
  findLastPublishedManualPlayers,
  isConvocableEvent,
  splitSelection,
} from './convocationWizardUtils';

/** @type {any[]} */
const EMPTY_LIST = [];

/**
 * Les evenements de toutes les pages d'une requete infinie.
 * @param {any} pages
 * @returns {any[]}
 */
const flattenPages = (pages) => (Array.isArray(pages?.pages) ? pages.pages : [])
  .flatMap((/** @type {any} */ page) => (Array.isArray(page?.data) ? page.data : []));

/**
 * MESSAGERIE-1C — L'ASSISTANT « CONVOCATION » DU GROUPE D'EQUIPE (pack messagerie §3.12).
 *
 * 4 etapes : Evenement, Joueurs, Placement, Details. Il s'ouvre par-dessus le fil (une feuille
 * plein ecran, pas une route : aucun fichier-carrefour de navigation n'est touche), et publie par
 * le chemin du plateau existant — le brouillon, puis la publication. Le serveur poste alors la
 * carte « Composition publiee » dans CE fil, puisque c'est le fil de l'equipe.
 *
 * ✏️ MODIFIER (`mode = 'edit'`) : l'evenement est fixe, l'assistant s'ouvre a l'etape demandee
 * (Joueurs, ou Placement quand on touche le terrain), chaque etape offre « Mettre a jour ». Les
 * reponses deja donnees sont gardees PAR CONSTRUCTION : le serveur les range hors du pack.
 * @param {object} props
 * @param {string} props.chatId - Le fil d'equipe d'ou l'assistant est ouvert.
 * @param {any} [props.eventSummary] - En modification : l'evenement tel que la carte publiee le
 *   porte (`eventDisplayName`, `eventDate`, `eventAddress`), pour le rappel en tete d'etape.
 * @param {string} [props.initialEventId] - L'evenement d'une convocation a modifier.
 * @param {'create' | 'edit'} [props.mode]
 * @param {(result?: { published: boolean }) => void} props.onClose
 * @param {number} [props.startStep] - En modification : 2 (Joueurs) ou 3 (Placement).
 * @param {string} props.teamId - L'equipe du fil.
 * @param {string} [props.teamName]
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function ConvocationWizard({
  chatId,
  eventSummary = null,
  initialEventId = '',
  mode = 'create',
  onClose,
  startStep = 2,
  teamId,
  teamName = '',
  visible,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  const { sendMessage } = useMessaging();

  const isEditMode = mode === 'edit';
  const minStep = isEditMode ? 2 : 1;
  const [step, setStep] = useState(isEditMode ? Math.max(2, Math.min(3, startStep)) : 1);
  const [eventId, setEventId] = useState(initialEventId);
  const [initializedFor, setInitializedFor] = useState('');
  const [selection, setSelection] = useState(/** @type {Record<string, string>} */ ({}));
  const [placements, setPlacements] = useState(/** @type {any[]} */ (EMPTY_LIST));
  const [addedManualPlayers, setAddedManualPlayers] = useState(/** @type {any[]} */ (EMPTY_LIST));
  const [removedIds, setRemovedIds] = useState(/** @type {string[]} */ (EMPTY_LIST));
  const [meetingPoint, setMeetingPoint] = useState(isEditMode ? '' : DEFAULT_MEETING_POINT);
  const [infos, setInfos] = useState('');
  const [askResponses, setAskResponses] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [paywallDecision, setPaywallDecision] = useState(/** @type {any} */ (null));

  // --- Les evenements de l'equipe (etape 1). Deux lectures, fusionnees : celle de la feuille
  // « Evenement » du fil (memes parametres, donc meme cache) attrape les matchs ou l'equipe est
  // INVITEE ; celle par equipe couvre le super-admin, qui n'est membre de rien.
  const sharedParams = {
    compact: true,
    excludeType: 'Réservation',
    myTeams: true,
    pageSize: 20,
    sort: 'date:asc',
  };
  const { data: myTeamsPages, isFetching: isLoadingMyEvents } = useGetEvents(
    /** @type {any} */ (sharedParams),
    { enabled: visible && !isEditMode, refetchOnMount: false, staleTime: 30_000 },
  );
  const { data: teamPages, isFetching: isLoadingTeamEvents } = useGetEvents(
    /** @type {any} */ ({ ...sharedParams, myTeams: undefined, teamIds: [teamId] }),
    { enabled: visible && !isEditMode && Boolean(teamId), refetchOnMount: false },
  );
  const events = useMemo(() => filterTeamEvents([
    ...flattenPages(myTeamsPages),
    ...flattenPages(teamPages),
  ], teamId).filter(isConvocableEvent), [myTeamsPages, teamId, teamPages]);
  const selectedEvent = events.find((event) => String(event?.documentId) === String(eventId))
    || null;

  // --- La composition de l'evenement choisi : l'effectif, la convocation deja publiee, les
  // reponses, et le « dernier match » du serveur.
  const {
    data: compositionPayload,
    isError: isCompositionError,
    isFetching: isLoadingComposition,
    refetch: refetchComposition,
  } = useGetEventTeamComposition(eventId, teamId, {
    enabled: visible && Boolean(eventId) && Boolean(teamId),
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const payload = /** @type {any} */ (compositionPayload);
  const isPayloadReady = Boolean(payload) && !isLoadingComposition;
  const published = payload?.published || null;
  const isUpdate = isEditMode || Boolean(published);

  // --- Les messages DEJA charges du fil (aucune requete : `enabled: false`).
  const { data: messagesPages } = useGetChatMessages({ chatId }, { enabled: false });
  const loadedMessages = useMemo(() => flattenPages(messagesPages), [messagesPages]);

  const reproposedManualPlayers = useMemo(() => findLastPublishedManualPlayers({
    bootstrap: payload?.bootstrap, messages: loadedMessages, teamId,
  }), [loadedMessages, payload?.bootstrap, teamId]);

  const rows = useMemo(() => buildConvocationRows({
    addedManualPlayers,
    eligiblePlayers: payload?.eligiblePlayers || EMPTY_LIST,
    publishedPack: published,
    reinforcementPlayers: payload?.reinforcementPlayers || EMPTY_LIST,
    removedIds,
    reproposedManualPlayers,
  }), [addedManualPlayers, payload, published, removedIds, reproposedManualPlayers]);

  const sport = String(
    published?.sportContext
    || payload?.draft?.sportContext
    || payload?.bootstrap?.composition?.sportContext
    || selectedEvent?.team?.activities?.[0]?.name
    || eventSummary?.sportContext
    || '',
  );
  const category = String(selectedEvent?.team?.category?.name || '');
  const responsesAreOpen = isRsvpEnabled(payload);

  // --- L'amorce : une seule fois par evenement, quand sa composition arrive. Une convocation
  // deja publiee rouvre sa selection, son terrain et son reglage de reponse.
  useEffect(() => {
    if (!eventId || !isPayloadReady || initializedFor === eventId) return;
    setInitializedFor(eventId);
    setSelection(buildSelectionFromPack(published));
    setPlacements(readPlacementsFromPack(published));
    setAskResponses(published ? published.requireResponse !== false : true);
  }, [eventId, initializedFor, isPayloadReady, published]);

  const { bench, pitch } = splitSelection(rows, selection);
  const calledUpCount = pitch.length + bench.length;

  // Les pastilles suivent la liste : un nouveau titulaire prend un poste libre de la compo type,
  // un joueur retire du terrain perd sa pastille.
  // 🐛 Attendre l'amorce de l'evenement : sinon, dans le meme passage, l'amorce pose les places
  // PUBLIEES et cet effet (encore sans titulaire) les efface — le temoin « Mettre a jour » l'a vu.
  const starterKey = pitch.map((row) => row.id).join('|');
  const isInitialized = Boolean(eventId) && initializedFor === eventId;
  useEffect(() => {
    if (!isInitialized) return;
    setPlacements((current) => buildPitchPlacements({
      category, placements: current, sport, starterIds: starterKey ? starterKey.split('|') : [],
    }));
  }, [category, isInitialized, sport, starterKey]);

  const stepKey = CONVOCATION_STEPS[step - 1];
  const stepName = t(`conversationConvocation.steps.${stepKey}`);
  const isEventReady = Boolean(eventId) && isPayloadReady && !isCompositionError;
  let canGoNext = true;
  if (step === 1) canGoNext = isEventReady;
  else if (step === 2) canGoNext = isEventReady && calledUpCount > 0;
  else canGoNext = isEventReady && calledUpCount > 0;

  const handleBack = useCallback(() => {
    if (isPublishing) return;
    if (step > minStep) {
      setStep(step - 1);
      return;
    }
    onClose();
  }, [isPublishing, minStep, onClose, step]);

  const handleSelectEvent = useCallback((/** @type {any} */ event) => {
    const nextId = String(event?.documentId || '');
    if (!nextId || nextId === eventId) return;
    setEventId(nextId);
    setInitializedFor('');
    setSelection({});
    setPlacements(EMPTY_LIST);
    setAddedManualPlayers(EMPTY_LIST);
    setRemovedIds(EMPTY_LIST);
  }, [eventId]);

  /**
   * Le message « Rendez-vous / Infos ». Il part par la messagerie du fil (le meme envoi que la
   * barre de saisie) ; sans prise temps reel, par la route d'envoi.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  const sendDetailsMessage = useCallback(async (/** @type {string} */ text) => {
    const optimisticId = sendMessage(chatId, text, { sender: userData });
    if (optimisticId) return true;
    try {
      await createChatMessage({ chatId, message: text });
      return true;
    } catch {
      return false;
    }
  }, [chatId, sendMessage, userData]);

  const handlePublish = useCallback(async () => {
    if (isPublishing || !eventId || !teamId || !isEventReady || calledUpCount === 0) return;
    setIsPublishing(true);
    try {
      const pack = buildConvocationPack({
        basePack: published || payload?.draft || null,
        category,
        placements,
        requireResponse: responsesAreOpen && askResponses,
        rows,
        selection,
        sport,
        teamName: payload?.team?.name || teamName,
      });
      // La compo part TOUJOURS avant la convocation : publier ce qui n'a pas ete enregistre
      // publierait l'etat precedent (meme ordre que le plateau).
      await saveEventCompositionDraft(eventId, { draft: pack, teamId });
      await publishEventConvocation(eventId, { teamId });
      invalidateAfterAction(queryClient, 'publishComposition').catch(() => {});

      const detailsText = buildDetailsMessageText({
        infos,
        infosLabel: t('conversationConvocation.details.infosLabel'),
        meetingLabel: t('conversationConvocation.details.meetingLabel'),
        meetingPoint,
      });
      if (detailsText) {
        const sent = await sendDetailsMessage(detailsText);
        if (!sent) {
          Alert.alert(
            t('conversationConvocation.alerts.detailsNotSentTitle'),
            t('conversationConvocation.alerts.detailsNotSent'),
          );
        }
      }
      onClose({ published: true });
    } catch (error) {
      const decision = extractSubscriptionDecisionFromError(error);
      if (decision) {
        setPaywallDecision(decision);
        return;
      }
      Alert.alert(
        t('conversationConvocation.alerts.errorTitle'),
        t('conversationConvocation.alerts.errorMessage'),
      );
    } finally {
      setIsPublishing(false);
    }
  }, [
    askResponses, calledUpCount, category, eventId, infos, isEventReady, isPublishing, meetingPoint,
    onClose, payload, placements, published, queryClient, responsesAreOpen, rows, selection,
    sendDetailsMessage, sport, t, teamId, teamName,
  ]);

  const handleNext = useCallback(() => {
    if (!canGoNext || isPublishing) return;
    if (step < CONVOCATION_STEPS.length) {
      setStep(step + 1);
      return;
    }
    handlePublish();
  }, [canGoNext, handlePublish, isPublishing, step]);

  // Le mur payant ouvre l'offre : l'assistant se referme d'abord, sinon il la masquerait.
  const paywallNavigation = useMemo(() => ({
    ...navigation,
    navigate: (/** @type {any[]} */ ...args) => {
      onClose();
      // @ts-ignore
      navigation.navigate(...args);
    },
  }), [navigation, onClose]);

  const title = isUpdate
    ? t('conversationConvocation.titleEdit')
    : t('conversationConvocation.titleNew');
  const subtitle = t('conversationConvocation.stepOf', {
    name: stepName, step, ...SANS_ECHAPPEMENT,
  });

  let primaryLabel = t('conversationConvocation.next');
  if (step === CONVOCATION_STEPS.length) {
    primaryLabel = isUpdate
      ? t('conversationConvocation.updateSend')
      : t('conversationConvocation.send');
  }
  const showCounter = step === 2 && !isUpdate;
  const showUpdate = isUpdate && step < CONVOCATION_STEPS.length;

  const recapEvent = selectedEvent || eventSummary || null;
  const recap = step > 1 ? (
    <View style={styles.recap}>
      <ConvocationEventRecap
        event={recapEvent}
        onChange={isEditMode ? undefined : () => setStep(1)}
      />
    </View>
  ) : null;

  let body = null;
  if (step === 1) {
    body = (
      <ConvocationEventStep
        events={events}
        isLoading={(isLoadingMyEvents || isLoadingTeamEvents) && events.length === 0}
        onSelect={handleSelectEvent}
        selectedEventId={eventId}
      />
    );
  } else if (step === 2) {
    body = (
      <ConvocationPlayersStep
        bench={bench}
        isLoading={!isPayloadReady}
        isUpdate={isUpdate}
        onAddManualPlayer={(player) => {
          setAddedManualPlayers((/** @type {any[]} */ current) => [...current, player]);
          setSelection((/** @type {Record<string, string>} */ current) => ({
            ...current, [player.documentId]: 'pitch',
          }));
        }}
        onRemoveManualPlayer={(playerId) => {
          setRemovedIds((/** @type {string[]} */ current) => [...current, playerId]);
          setSelection((/** @type {Record<string, string>} */ current) => {
            const next = { ...current };
            delete next[playerId];
            return next;
          });
        }}
        onSelectionChange={setSelection}
        pitch={pitch}
        responses={published ? payload?.responses : null}
        rows={rows}
        selection={selection}
      />
    );
  } else if (step === 3) {
    body = (
      <ConvocationPlacementStep
        bench={bench}
        onMove={setPlacements}
        pitch={pitch}
        placements={placements}
        sport={sport}
      />
    );
  } else {
    body = (
      <ConvocationDetailsStep
        askResponses={responsesAreOpen && askResponses}
        benchCount={bench.length}
        infos={infos}
        meetingPoint={meetingPoint}
        onChangeAsk={setAskResponses}
        onChangeInfos={setInfos}
        onChangeMeetingPoint={setMeetingPoint}
        pitchCount={pitch.length}
        responsesLocked={!responsesAreOpen}
      />
    );
  }

  const showLoadError = step > 1 && isCompositionError && !isLoadingComposition;

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleBack}
      presentationStyle="fullScreen"
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <View
        style={[styles.root, { backgroundColor: Colors.primary900 }]}
        testID="convocation-wizard"
      >
        <View
          style={[
            styles.header,
            {
              borderBottomColor: withAlpha(Colors.neutral00, 0.06),
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <TouchableOpacity
            accessibilityLabel={step > minStep
              ? t('conversationConvocation.back')
              : t('conversationConvocation.close')}
            accessibilityRole="button"
            disabled={isPublishing}
            onPress={handleBack}
            style={[styles.backButton, { borderColor: Colors.primary500 }]}
            testID="convocation-wizard-back"
          >
            <SvgIcon color={Colors.primary500} height={20} name="arrow-left" width={20} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={[Fonts.p1Bold, { color: Colors.neutral00 }]}
            >
              {title}
            </Text>
            <Text
              numberOfLines={1}
              style={[Fonts.p3, styles.subtitle, { color: withAlpha(Colors.neutral00, 0.6) }]}
            >
              {subtitle}
            </Text>
          </View>
        </View>

        <View
          accessibilityLabel={subtitle}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: CONVOCATION_STEPS.length, min: 1, now: step }}
          style={styles.progress}
        >
          {CONVOCATION_STEPS.map((key, index) => (
            <View
              key={key}
              style={[
                styles.progressSegment,
                {
                  backgroundColor: index < step
                    ? Colors.primary500
                    : withAlpha(Colors.neutral00, 0.15),
                },
              ]}
            />
          ))}
        </View>

        {step === 3 ? (
          <View style={styles.fixedBody}>
            {recap}
            {body}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
          >
            {showLoadError ? (
              <View style={styles.loadError}>
                <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>
                  {t('conversationConvocation.alerts.loadError')}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => refetchComposition()}
                  style={[styles.retry, { borderColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                    {t('conversationConvocation.alerts.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {recap}
                {body}
              </>
            )}
          </ScrollView>
        )}

        <View
          style={[
            styles.footer,
            {
              backgroundColor: Colors.primary900,
              borderTopColor: withAlpha(Colors.neutral00, 0.06),
              paddingBottom: Math.max(insets.bottom, 12) + 10,
            },
          ]}
        >
          {showCounter ? (
            <Text
              style={[Fonts.p2, styles.counter, { color: withAlpha(Colors.neutral00, 0.75) }]}
              testID="convocation-wizard-counter"
            >
              {t('conversationConvocation.players.calledUp', { count: calledUpCount })}
            </Text>
          ) : null}
          {showUpdate ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !canGoNext || isPublishing }}
              disabled={!canGoNext || isPublishing}
              onPress={handlePublish}
              style={[
                styles.footerButton,
                styles.footerOutline,
                { borderColor: Colors.primary500, opacity: canGoNext ? 1 : 0.4 },
              ]}
              testID="convocation-wizard-update"
            >
              <Text style={[Fonts.p2Bold, styles.footerLabel, { color: Colors.primary500 }]}>
                {t('conversationConvocation.update')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: isPublishing, disabled: !canGoNext || isPublishing }}
            disabled={!canGoNext || isPublishing}
            onPress={handleNext}
            style={[
              styles.footerButton,
              showCounter ? styles.footerButtonCompact : styles.footerButtonWide,
              { backgroundColor: Colors.primary500, opacity: canGoNext ? 1 : 0.4 },
            ]}
            testID="convocation-wizard-next"
          >
            {isPublishing && step === CONVOCATION_STEPS.length ? (
              <ActivityIndicator color={Colors.primary900} />
            ) : (
              <>
                <Text style={[Fonts.p2Bold, styles.footerLabel, { color: Colors.primary900 }]}>
                  {primaryLabel}
                </Text>
                {step < CONVOCATION_STEPS.length ? (
                  <SvgIcon color={Colors.primary900} height={16} name="arrow-right" width={16} />
                ) : null}
              </>
            )}
          </TouchableOpacity>
        </View>

        <SubscriptionPaywallSheet
          close={() => setPaywallDecision(null)}
          clubDocumentId={paywallDecision?.clubDocumentId || null}
          decision={paywallDecision}
          isVisible={Boolean(paywallDecision)}
          navigation={paywallNavigation}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  counter: {
    flex: 1,
    fontSize: 13.5,
  },
  fixedBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  // 🐞 Recolte 1W (08/10) : PAS de `flex: 0` — react-native-web le passe tel quel au navigateur
  // (0 1 0 %) et le bouton se repliait sur ses marges (« ivant » a 1 280 px). Taille du texte,
  // jamais retreci, 44 au moins (cible tactile).
  footerButtonCompact: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 44,
  },
  footerButtonWide: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 15.5,
  },
  footerOutline: {
    borderWidth: 1.5,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  loadError: {
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 24,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  progressSegment: {
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
  recap: {
    marginBottom: 12,
  },
  retry: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 1,
  },
});

export default ConvocationWizard;
