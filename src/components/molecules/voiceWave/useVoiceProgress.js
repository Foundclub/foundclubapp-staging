import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { VOICE_EASE_IN_OUT } from '@/components/organisms/voiceComposer/voiceMotion';

// VOCAL — LE REMPLISSAGE D'UNE ONDE PENDANT L'ÉCOUTE (maquette, « Forme d'onde » §4).
//
// Le lecteur natif rend sa position dix fois par seconde : dessiner à ce
// rythme, ce serait dix à-coups par seconde. La progression est donc ANIMÉE
// sur le fil d'animation, en ligne droite, jusqu'à la fin du vocal, à la
// vitesse de lecture — et seulement RECALÉE sur le lecteur quand l'écart
// dépasse 80 ms (une pause, un déplacement, un changement de vitesse).
// Fin de lecture : le remplissage tient 400 ms, la couche « lue » s'efface
// (240 ms easeInOut), puis la progression revient à 0.

/** L'écart toléré entre l'animation et le lecteur avant de recaler. */
export const VOICE_PROGRESS_DRIFT_MS = 80;

/**
 * La progression animée d'un vocal en lecture.
 * @param {{
 *   dureeMs: number,
 *   enLecture: boolean,
 *   finiLe: number,
 *   positionMs: number,
 *   vitesse: number,
 * }} lecteur - Ce que rend le lecteur (durée, lecture, position, vitesse) et
 *   l'instant de la dernière fin de lecture.
 * @returns {{ opaciteLue: any, progression: any }} Les deux valeurs à donner à l'onde.
 */
export default function useVoiceProgress({
  dureeMs, enLecture, finiLe, positionMs, vitesse,
}) {
  const progression = useSharedValue(0);
  const opaciteLue = useSharedValue(1);
  // Le départ de l'animation en cours : d'où, quand, à quelle vitesse.
  const departRef = useRef(/** @type {null | { positionMs: number, t: number, vitesse: number }} */ (null));

  useEffect(() => {
    if (!dureeMs) return;
    if (enLecture) {
      const depart = departRef.current;
      const attendu = depart
        ? depart.positionMs + ((Date.now() - depart.t) * depart.vitesse)
        : Number.POSITIVE_INFINITY;
      const derive = Math.abs(attendu - positionMs);
      if (depart && depart.vitesse === vitesse && derive <= VOICE_PROGRESS_DRIFT_MS) return;
      departRef.current = { positionMs, t: Date.now(), vitesse };
      cancelAnimation(progression);
      opaciteLue.value = 1;
      progression.value = Math.min(1, positionMs / dureeMs);
      progression.value = withTiming(1, {
        duration: Math.max(0, (dureeMs - positionMs) / (vitesse || 1)),
        easing: Easing.linear,
      });
      return;
    }
    // En pause, ou déplacé à la main : la progression suit la position.
    departRef.current = null;
    cancelAnimation(progression);
    progression.value = Math.min(1, positionMs / dureeMs);
  }, [dureeMs, enLecture, opaciteLue, positionMs, progression, vitesse]);

  useEffect(() => {
    if (!finiLe) return;
    departRef.current = null;
    cancelAnimation(progression);
    progression.value = 1;
    opaciteLue.value = withDelay(400, withTiming(0, { duration: 240, easing: VOICE_EASE_IN_OUT }, (fini) => {
      'worklet';

      if (!fini) return;
      progression.value = 0;
      opaciteLue.value = 1;
    }));
  }, [finiLe, opaciteLue, progression]);

  return { opaciteLue, progression };
}
