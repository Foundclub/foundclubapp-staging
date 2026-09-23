import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import useVoiceRecorder, { VOICE_PHASES } from '@/components/organisms/voiceComposer/useVoiceRecorder';
import VoiceActionButton from '@/components/organisms/voiceComposer/VoiceActionButton';
import {
  allerMaintien,
  annuler,
  revenir,
  verrouiller,
  versReecoute,
} from '@/components/organisms/voiceComposer/voiceChoreography';
import VoiceHoldTip from '@/components/organisms/voiceComposer/VoiceHoldTip';
import { VoiceStopButton, VoiceTrashButton } from '@/components/organisms/voiceComposer/VoiceLockedControls';
import VoiceLockPillar from '@/components/organisms/voiceComposer/VoiceLockPillar';
import { easeIn, easeOut } from '@/components/organisms/voiceComposer/voiceMotion';
import VoiceRecordingStrip from '@/components/organisms/voiceComposer/VoiceRecordingStrip';
import VoiceReviewPill from '@/components/organisms/voiceComposer/VoiceReviewPill';

import { VOICE_MAX_TAKE_MS, voiceLevelShape } from '@/services/chat/voiceWaveform';

import useReduceMotion from '@/hooks/useReduceMotion';

// VOCAL — LA BARRE DE SAISIE QUI SE TRANSFORME SUR PLACE (maquette de Claude
// Design, 23/09 : `claude design/export/design_handoff_messages_vocaux/`).
//
// Cette zone enveloppe la rangée de la barre de saisie (le +, le champ, le
// bouton de droite) et pose PAR-DESSUS tout ce que le vocal y fait paraître.
// L'écran de conversation ne connaît que trois choses d'elle : où la poser,
// quand le micro doit se montrer (champ vide), et quoi faire d'un vocal fini
// (`onSend`). Tout le reste — le micro, ses gestes, ses animations — vit ici,
// hors du rendu de l'écran (7 400 lignes) : rien de ce qui bouge pendant un
// vocal ne le redessine.
//
// 🧭 LE MICRO EST POSÉ PAR LA ZONE, PAS PAR LA RANGÉE : la rangée garde une
// place vide de 44 à droite (`renderSend`), et le micro vient s'y poser. C'est
// ce qui lui permet de grossir, de glisser et de devenir Envoyer sans que la
// rangée ne bouge.

const VoiceZoneContext = createContext(/** @type {any} */ (null));

/** Le temps de sortie de la pastille (160 ms easeIn), avant de la démonter. */
const SORTIE_PASTILLE_MS = 180;

/**
 * Les valeurs animées du vocal : une seule boîte, partagée par tous les morceaux.
 * @param {boolean} visible - Le micro est-il montré au départ.
 * @returns {any} Les valeurs.
 */
const useVoiceMotion = (visible) => {
  const valeurs = {
    active: useSharedValue(false),
    axe: useSharedValue(/** @type {'x' | 'y' | null} */ (null)),
    balancier: useSharedValue(0),
    bande: useSharedValue(0),
    bandeDecalage: useSharedValue(12),
    bandeGauche: useSharedValue(0),
    bulle: useSharedValue(0),
    cadenas: useSharedValue(0),
    cadenasFerme: useSharedValue(0),
    cadenasRepli: useSharedValue(0),
    cadenasTy: useSharedValue(16),
    chevron: useSharedValue(0),
    corbeille: useSharedValue(0),
    corbeilleEchelle: useSharedValue(0.6),
    echelle: useSharedValue(1),
    envoyer: useSharedValue(0),
    fini: useSharedValue(false),
    halo: useSharedValue(0),
    haloEchelle: useSharedValue(1),
    indice: useSharedValue(0),
    indiceArrete: useSharedValue(0),
    indiceLargeur: useSharedValue(1),
    largeurIndice: useSharedValue(0),
    ondeRepli: useSharedValue(0),
    pastille: useSharedValue(0),
    point: useSharedValue(1),
    repos: useSharedValue(0),
    rouge: useSharedValue(0),
    stop: useSharedValue(0),
    stopEchelle: useSharedValue(0.8),
    supprimer: useSharedValue(0),
    supprimerEchelle: useSharedValue(0.8),
    tx: useSharedValue(0),
    ty: useSharedValue(0),
    visible: useSharedValue(visible ? 1 : 0),
  };
  // Les valeurs partagées sont stables : la boîte l'est aussi.
  return useRef(valeurs).current;
};

/**
 * Le + et le champ : ils s'effacent quand la bande d'enregistrement arrive
 * (opacité 1 → 0, 0 → −12 px) et reviennent quand elle part.
 * Hors d'une zone vocale, c'est une simple vue.
 * @param {{ children: import('react').ReactNode, style?: any }} props - Le contenu.
 * @returns {import('react').ReactElement} Le contenu, qui sait s'effacer.
 */
export function VoiceRestFade({ children, style }) {
  const zone = useContext(VoiceZoneContext);
  const immobile = useSharedValue(0);
  const repos = zone?.repos || immobile;
  const fondu = useAnimatedStyle(() => ({
    opacity: 1 - repos.value,
    transform: [{ translateX: -12 * repos.value }],
  }));
  return <Animated.View style={[style, fondu]}>{children}</Animated.View>;
}

/**
 * Le bouton Envoyer du champ : il apparaît en fondu de 120 ms quand la
 * première lettre est tapée, pendant que le micro s'efface.
 * @param {{ children: import('react').ReactNode, style?: any }} props - Le bouton.
 * @returns {import('react').ReactElement} Le bouton, qui apparaît en fondu.
 */
export function VoiceSendAppear({ children, style }) {
  return <Animated.View entering={FadeIn.duration(120)} style={style}>{children}</Animated.View>;
}

/**
 * La zone vocale de la barre de saisie.
 * @param {{
 *   actif: boolean,
 *   children: import('react').ReactNode,
 *   onError: (code: string) => void,
 *   onSend: (brouillon: any) => (boolean | void | Promise<boolean | void>),
 *   onUnavailable: () => void,
 *   visible: boolean,
 * }} props - `visible` : le micro se montre (champ vide, pas de photo en
 *   attente) ; `actif` : ce téléphone sait enregistrer.
 * @returns {import('react').ReactElement} La rangée et son vocal.
 */
export default function VoiceComposerZone({
  actif,
  children,
  onError,
  onSend,
  onUnavailable,
  visible,
}) {
  const motion = useVoiceMotion(visible);
  const reduire = useReduceMotion();
  // Une nouvelle prise : l'onde et le chronomètre repartent de zéro.
  const [generation, setGeneration] = useState(0);
  const [pastilleMontee, setPastilleMontee] = useState(false);
  // Pourquoi on revient au repos : la sortie n'est pas la même après un
  // glisser-annuler, un Supprimer ou un envoi.
  const raisonRef = useRef(/** @type {null | 'glisse' | 'jeter'} */ (null));
  const precedenteRef = useRef(/** @type {string} */ (VOICE_PHASES.rest));
  const cibleHaloRef = useRef(1);

  const { t } = useTranslation();
  // La bulle d'aide : « Maintiens pour enregistrer » ('' : le texte par
  // défaut), ou, à la durée maximale, pourquoi la prise s'est arrêtée.
  const [texteBulle, setTexteBulle] = useState('');
  const afficherBulle = useCallback((/** @type {string} */ texte) => {
    setTexteBulle(texte);
    motion.bulle.value = withSequence(easeOut(1, 160), withDelay(2000, easeIn(0, 160)));
  }, [motion]);
  const montrerBulle = useCallback(() => afficherBulle(''), [afficherBulle]);
  const signalerLimite = useCallback(() => {
    const texte = t('voiceComposer.limitReached', {
      defaultValue: 'Arrêté à {{minutes}} minutes : réécoute, puis envoie.',
      minutes: VOICE_MAX_TAKE_MS / 60000,
    });
    afficherBulle(texte);
    AccessibilityInfo.announceForAccessibility(texte);
  }, [afficherBulle, t]);

  const micro = useVoiceRecorder({
    onError, onLimitReached: signalerLimite, onSend, onTooShort: montrerBulle,
  });
  // ⚠️ Les rappels du geste doivent rester STABLES : si le geste change
  // pendant que le doigt est posé, Gesture Handler l'annule. Chaque rappel du
  // micro l'est (`useCallback` sur des dépendances fixes) ; on ne passe donc
  // jamais l'objet `micro` lui-même, qui change à chaque moment.
  const {
    cancel, subscribeTick, trash,
  } = micro;

  const annulerParGlisse = useCallback(() => {
    raisonRef.current = 'glisse';
    cancel();
  }, [cancel]);
  const jeter = useCallback(() => {
    raisonRef.current = 'jeter';
    trash();
  }, [trash]);

  // Une lettre tapée : le micro laisse sa place au bouton Envoyer du champ
  // (fondu de 120 ms).
  useEffect(() => {
    motion.visible.value = easeOut(visible ? 1 : 0, 120);
  }, [motion, visible]);

  // Le halo suit la voix : montée 40 ms (linéaire), descente 160 ms (easeOut).
  useEffect(() => subscribeTick((niveau) => {
    const cible = 1 + (0.5 * voiceLevelShape(niveau));
    const monte = cible > cibleHaloRef.current;
    cibleHaloRef.current = cible;
    motion.haloEchelle.value = monte
      ? withTiming(cible, { duration: 40, easing: Easing.linear })
      : easeOut(cible, 160);
  }), [motion, subscribeTick]);

  // Chaque passage d'un moment à l'autre joue sa ligne de la planche.
  useEffect(() => {
    const avant = precedenteRef.current;
    const apres = micro.phase;
    precedenteRef.current = apres;
    if (avant === apres) return undefined;
    const {
      arming, hold, locked, rest, review,
    } = VOICE_PHASES;
    const depuisLeRepos = avant === rest || avant === arming;
    if (apres === hold || (depuisLeRepos && apres !== rest)) {
      setGeneration((g) => g + 1);
      allerMaintien(motion, reduire);
    }
    if (apres === locked || apres === review) {
      if (avant !== locked) verrouiller(motion, reduire);
    }
    if (apres === review) {
      setPastilleMontee(true);
      versReecoute(motion);
      return undefined;
    }
    if (apres !== rest) return undefined;
    const raison = raisonRef.current;
    raisonRef.current = null;
    if (raison === 'glisse') annuler(motion, reduire);
    else revenir(motion, reduire, raison === 'jeter' ? 80 : 0);
    if (avant !== review) return undefined;
    // La pastille s'efface (160 ms), puis on la démonte : son lecteur s'arrête.
    const minuterie = setTimeout(() => setPastilleMontee(false), SORTIE_PASTILLE_MS);
    return () => clearTimeout(minuterie);
  }, [micro.phase, motion, reduire]);

  const contexte = useMemo(() => ({ repos: motion.repos }), [motion]);
  const { phase } = micro;
  const enAttente = phase === VOICE_PHASES.locked || phase === VOICE_PHASES.review;

  return (
    <VoiceZoneContext.Provider value={contexte}>
      <View>
        {children}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <VoiceRecordingStrip
            generation={generation}
            motion={motion}
            subscribeTick={subscribeTick}
          />
          {pastilleMontee ? (
            <VoiceReviewPill
              actif={phase === VOICE_PHASES.review}
              brouillon={micro.draft}
              motion={motion}
              reduire={reduire}
            />
          ) : null}
          <VoiceTrashButton actif={enAttente} motion={motion} onPress={jeter} />
          <VoiceLockPillar motion={motion} />
          <VoiceStopButton
            actif={phase === VOICE_PHASES.locked}
            motion={motion}
            onPress={micro.stopToReview}
          />
          <VoiceHoldTip texte={texteBulle} visibilite={motion.bulle} />
          <VoiceActionButton
            actif={actif}
            mode={enAttente ? 'envoyer' : 'micro'}
            motion={motion}
            onAbortArming={micro.abortArming}
            onActivateHold={micro.activateHold}
            onCancel={annulerParGlisse}
            onInterrupt={micro.interrupt}
            onLock={micro.lock}
            onPressIn={micro.pressIn}
            onRelease={micro.release}
            onScreenReaderStart={micro.startLocked}
            onSend={micro.send}
            onShowTip={montrerBulle}
            onUnavailable={onUnavailable}
            visible={visible || phase !== VOICE_PHASES.rest}
          />
        </View>
      </View>
    </VoiceZoneContext.Provider>
  );
}
