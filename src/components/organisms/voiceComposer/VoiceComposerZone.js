import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
} from 'react-native-reanimated';

import useVoiceRecorder, { VOICE_PHASES } from './useVoiceRecorder';
import VoiceActionButton from './VoiceActionButton';
import VoiceHoldTip from './VoiceHoldTip';
import { easeIn, easeOut } from './voiceMotion';

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

/**
 * Les valeurs animées du vocal : une seule boîte, partagée par tous les morceaux.
 * @param {boolean} visible - Le micro est-il montré au départ.
 * @returns {any} Les valeurs.
 */
const useVoiceMotion = (visible) => {
  const active = useSharedValue(false);
  const axe = useSharedValue(/** @type {'x' | 'y' | null} */ (null));
  const bulle = useSharedValue(0);
  const echelle = useSharedValue(1);
  const envoyer = useSharedValue(0);
  const fini = useSharedValue(false);
  const halo = useSharedValue(0);
  const haloEchelle = useSharedValue(1);
  const indiceArrete = useSharedValue(0);
  const repos = useSharedValue(0);
  const rouge = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const visibleSv = useSharedValue(visible ? 1 : 0);
  return useMemo(() => ({
    active,
    axe,
    bulle,
    echelle,
    envoyer,
    fini,
    halo,
    haloEchelle,
    indiceArrete,
    repos,
    rouge,
    tx,
    ty,
    visible: visibleSv,
  }), [
    active, axe, bulle, echelle, envoyer, fini, halo, haloEchelle, indiceArrete, repos, rouge, tx,
    ty, visibleSv,
  ]);
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

  const montrerBulle = useCallback(() => {
    motion.bulle.value = withSequence(easeOut(1, 160), withDelay(2000, easeIn(0, 160)));
  }, [motion]);

  const micro = useVoiceRecorder({ onError, onSend, onTooShort: montrerBulle });

  // Une lettre tapée : le micro laisse sa place au bouton Envoyer du champ
  // (fondu de 120 ms).
  useEffect(() => {
    motion.visible.value = easeOut(visible ? 1 : 0, 120);
  }, [motion, visible]);

  const contexte = useMemo(() => ({ repos: motion.repos }), [motion]);
  const enAttente = micro.phase === VOICE_PHASES.locked || micro.phase === VOICE_PHASES.review;

  return (
    <VoiceZoneContext.Provider value={contexte}>
      <View>
        {children}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <VoiceHoldTip visibilite={motion.bulle} />
          <VoiceActionButton
            actif={actif}
            mode={enAttente ? 'envoyer' : 'micro'}
            motion={motion}
            onAbortArming={micro.abortArming}
            onActivateHold={micro.activateHold}
            onCancel={micro.cancel}
            onInterrupt={micro.interrupt}
            onLock={micro.lock}
            onPressIn={micro.pressIn}
            onRelease={micro.release}
            onScreenReaderStart={micro.startLocked}
            onSend={micro.send}
            onShowTip={montrerBulle}
            onUnavailable={onUnavailable}
            visible={visible || micro.phase !== VOICE_PHASES.rest}
          />
        </View>
      </View>
    </VoiceZoneContext.Provider>
  );
}
