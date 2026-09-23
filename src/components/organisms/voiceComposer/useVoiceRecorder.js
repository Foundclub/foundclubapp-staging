import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  cancelRecording,
  deleteVoiceNoteFile,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';
import {
  isTakeTooShort,
  meteringToLevel,
  VOICE_MAX_TAKE_MS,
} from '@/services/chat/voiceWaveform';

import { pauseActivePlayback } from '@/hooks/useAudioPlayback';

// VOCAL — LE CERVEAU DU MICRO : qui enregistre, quand, et ce qu'on en fait.
//
// La maquette décrit cinq moments (repos, maintien, verrouillé, réécoute,
// envoi). Ce crochet les tient, et SEULEMENT eux : il ne dessine rien. Les
// niveaux du micro (20 par seconde) ne passent JAMAIS par un état React : ils
// sont DIFFUSÉS aux abonnés (onde, chronomètre, halo), qui les posent dans
// leurs propres valeurs. C'est la leçon du lot MSGLIVE — cinq secondes de
// vocal redessinaient 101 fois un écran de 7 400 lignes — et la maquette
// l'exige aussi (`levels.modify`, fil d'animation).
//
// 🔗 UNE SEULE FILE POUR LE MICRO NATIF. Démarrer est asynchrone (permission,
// fichier), et un doigt peut se lever avant que le micro soit ouvert. Sans
// file, « annuler » passait AVANT « démarrer » et laissait un micro ouvert que
// personne n'arrêterait (le service ignore une annulation pendant qu'il
// démarre). Chaque geste natif s'enchaîne donc derrière le précédent.

/** Les moments de la maquette. `arming` : le doigt est posé, l'écran ne montre encore rien. */
export const VOICE_PHASES = Object.freeze({
  arming: 'arming',
  hold: 'hold',
  locked: 'locked',
  rest: 'rest',
  review: 'review',
});

/**
 * @typedef {object} VoiceDraft
 * @property {string} uri - Le fichier enregistré.
 * @property {number} durationMs - Sa durée.
 * @property {number[]} levels - Tous ses niveaux, 0 → 1 (20 par seconde).
 * @property {number[]} waveform - L'onde à enregistrer avec le message.
 * @property {string} fileName - Le nom du fichier.
 * @property {string} mime - Son type.
 * @property {number} size - Sa taille, en octets.
 */

/**
 * Le micro et ses cinq moments.
 * @param {{
 *   onError: (code: 'empty' | 'permission' | 'start' | 'stop' | 'unavailable') => void,
 *   onSend: (brouillon: VoiceDraft) => (boolean | void | Promise<boolean | void>),
 *   onTooShort: () => void,
 * }} rappels - Ce que l'écran fait d'un vocal, d'une erreur, d'une prise trop courte.
 * @returns {{
 *   phase: string,
 *   draft: VoiceDraft | null,
 *   activateHold: () => boolean,
 *   abortArming: () => void,
 *   cancel: () => void,
 *   interrupt: () => void,
 *   lock: () => void,
 *   pressIn: () => void,
 *   release: () => void,
 *   send: () => void,
 *   startLocked: () => void,
 *   stopToReview: () => void,
 *   subscribeTick: (ecouteur: (niveau: number, dureeMs: number) => void) => () => void,
 *   trash: () => void,
 * }} Le micro.
 */
export default function useVoiceRecorder({ onError, onSend, onTooShort }) {
  const [phase, setPhaseEtat] = useState(/** @type {string} */ (VOICE_PHASES.rest));
  const [draft, setDraft] = useState(/** @type {VoiceDraft | null} */ (null));
  const phaseRef = useRef(/** @type {string} */ (VOICE_PHASES.rest));
  const draftRef = useRef(/** @type {VoiceDraft | null} */ (null));
  const fileRef = useRef(Promise.resolve());
  const enregistreRef = useRef(false);
  const ecouteursRef = useRef(new Set());
  const rappelsRef = useRef({ onError, onSend, onTooShort });
  rappelsRef.current = { onError, onSend, onTooShort };

  const setPhase = useCallback((/** @type {string} */ suivante) => {
    phaseRef.current = suivante;
    setPhaseEtat(suivante);
  }, []);

  /**
   * Met un geste natif dans la file du micro.
   * @param {() => Promise<void>} tache - Le geste.
   * @returns {Promise<void>} Quand il est fait.
   */
  const enchainer = useCallback((/** @type {() => Promise<void>} */ tache) => {
    const suite = fileRef.current.then(tache).catch(() => {});
    fileRef.current = suite;
    return suite;
  }, []);

  /**
   * Confie un vocal fini à l'écran. Si l'écran répond `false` (envoi
   * impossible), le vocal REVIENT en réécoute : rien n'est perdu.
   * @param {VoiceDraft} brouillon - Le vocal.
   * @returns {void}
   */
  const confier = useCallback((/** @type {VoiceDraft} */ brouillon) => {
    Promise.resolve(rappelsRef.current.onSend(brouillon))
      .then((accepte) => {
        if (accepte !== false) return;
        if (phaseRef.current !== VOICE_PHASES.rest || draftRef.current) return;
        draftRef.current = brouillon;
        setDraft(brouillon);
        setPhase(VOICE_PHASES.review);
      })
      .catch(() => {});
  }, [setPhase]);

  const oublierBrouillon = useCallback(() => {
    const brouillon = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    return brouillon;
  }, []);

  /**
   * Arrête le micro, puis envoie la prise ou l'ouvre en réécoute.
   * @param {'review' | 'send'} destination - Ce qu'on fait de la prise.
   * @returns {Promise<void>} Quand c'est fait.
   */
  const terminer = useCallback((/** @type {'review' | 'send'} */ destination) => enchainer(async () => {
    if (!enregistreRef.current) return;
    enregistreRef.current = false;
    const revenirAuRepos = () => {
      if (phaseRef.current === VOICE_PHASES.review) setPhase(VOICE_PHASES.rest);
    };
    /** @type {any} */
    let brouillon = null;
    try {
      brouillon = await stopRecording();
    } catch (erreur) {
      const code = String(/** @type {any} */ (erreur)?.message || '');
      rappelsRef.current.onError(code === 'VOICE_FILE_EMPTY' ? 'empty' : 'stop');
      revenirAuRepos();
      return;
    }
    if (isTakeTooShort(brouillon?.durationMs)) {
      await deleteVoiceNoteFile(brouillon?.uri);
      rappelsRef.current.onTooShort();
      revenirAuRepos();
      return;
    }
    if (destination === 'send') {
      confier(brouillon);
      return;
    }
    draftRef.current = brouillon;
    setDraft(brouillon);
  }), [confier, enchainer, setPhase]);

  /** La prise s'interrompt sans rien perdre : elle passe en réécoute. */
  const interrupt = useCallback(() => {
    const actuelle = phaseRef.current;
    if (actuelle !== VOICE_PHASES.hold && actuelle !== VOICE_PHASES.locked) return;
    setPhase(VOICE_PHASES.review);
    terminer('review');
  }, [setPhase, terminer]);
  const interrompreRef = useRef(interrupt);
  interrompreRef.current = interrupt;

  const pressIn = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.rest) return;
    // Rien ne change à l'écran avant 200 ms : pas d'état, pas de rendu.
    phaseRef.current = VOICE_PHASES.arming;
    // Un seul son à la fois : parler met en pause le vocal qu'on écoutait.
    pauseActivePlayback();
    enchainer(async () => {
      try {
        await startRecording({
          onMetering: (metering, dureeMs) => {
            const niveau = meteringToLevel(metering);
            ecouteursRef.current.forEach((ecouteur) => ecouteur(niveau, dureeMs));
          },
          onProgress: (dureeMs) => {
            if (dureeMs >= VOICE_MAX_TAKE_MS) interrompreRef.current();
          },
        });
        enregistreRef.current = true;
      } catch (erreur) {
        enregistreRef.current = false;
        const code = String(/** @type {any} */ (erreur)?.message || '');
        if (code === 'VOICE_ALREADY_RECORDING') return;
        rappelsRef.current.onError(code === 'VOICE_MODULE_UNAVAILABLE' ? 'unavailable' : 'permission');
        if (phaseRef.current !== VOICE_PHASES.rest) setPhase(VOICE_PHASES.rest);
      }
    });
  }, [enchainer, setPhase]);

  /** 200 ms d'appui : l'écran devient l'enregistrement. */
  const activateHold = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.arming) return false;
    setPhase(VOICE_PHASES.hold);
    return true;
  }, [setPhase]);

  /** Le doigt s'est levé avant 200 ms : la prise est jetée sans bruit. */
  const abortArming = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.arming) return;
    phaseRef.current = VOICE_PHASES.rest;
    enchainer(async () => {
      if (!enregistreRef.current) return;
      enregistreRef.current = false;
      await cancelRecording();
    });
  }, [enchainer]);

  /** Relâcher pendant le maintien : ça part. */
  const release = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.hold) return;
    setPhase(VOICE_PHASES.rest);
    terminer('send');
  }, [setPhase, terminer]);

  /** Glisser à gauche, ou Supprimer : la prise et son fichier disparaissent. */
  const cancel = useCallback(() => {
    const actuelle = phaseRef.current;
    if (actuelle === VOICE_PHASES.review) {
      setPhase(VOICE_PHASES.rest);
      enchainer(async () => {
        const brouillon = oublierBrouillon();
        if (brouillon?.uri) await deleteVoiceNoteFile(brouillon.uri);
      });
      return;
    }
    if (actuelle !== VOICE_PHASES.hold && actuelle !== VOICE_PHASES.locked) return;
    setPhase(VOICE_PHASES.rest);
    enchainer(async () => {
      if (!enregistreRef.current) return;
      enregistreRef.current = false;
      await cancelRecording();
    });
  }, [enchainer, oublierBrouillon, setPhase]);

  /** Glisser vers le haut : mains libres. */
  const lock = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.hold) return;
    setPhase(VOICE_PHASES.locked);
  }, [setPhase]);

  /** Stop : on réécoute avant de décider. */
  const stopToReview = useCallback(() => {
    if (phaseRef.current !== VOICE_PHASES.locked) return;
    setPhase(VOICE_PHASES.review);
    terminer('review');
  }, [setPhase, terminer]);

  /** Envoyer, depuis le verrouillé ou la réécoute. */
  const send = useCallback(() => {
    const actuelle = phaseRef.current;
    if (actuelle === VOICE_PHASES.locked) {
      setPhase(VOICE_PHASES.rest);
      terminer('send');
      return;
    }
    if (actuelle !== VOICE_PHASES.review) return;
    setPhase(VOICE_PHASES.rest);
    // Dans la file : si l'arrêt de la réécoute n'est pas fini, on l'attend.
    enchainer(async () => {
      const brouillon = oublierBrouillon();
      if (brouillon) confier(brouillon);
    });
  }, [confier, enchainer, oublierBrouillon, setPhase, terminer]);

  /** Lecteur d'écran actif : un double-tap ouvre directement le verrouillé. */
  const startLocked = useCallback(() => {
    pressIn();
    if (activateHold()) lock();
  }, [activateHold, lock, pressIn]);

  const subscribeTick = useCallback((/** @type {(niveau: number, dureeMs: number) => void} */ ecouteur) => {
    ecouteursRef.current.add(ecouteur);
    return () => { ecouteursRef.current.delete(ecouteur); };
  }, []);

  // L'application passe en arrière-plan (appel entrant, écran verrouillé) :
  // la prise s'arrête et passe en réécoute. Rien n'est perdu.
  useEffect(() => {
    const abonnement = AppState.addEventListener?.('change', (etat) => {
      if (etat !== 'active') interrompreRef.current();
    });
    return () => abonnement?.remove?.();
  }, []);

  // En quittant la conversation : ni micro ouvert, ni brouillon oublié dans le cache.
  useEffect(() => () => {
    if (enregistreRef.current) {
      enregistreRef.current = false;
      cancelRecording().catch(() => {});
    }
    const brouillon = draftRef.current;
    draftRef.current = null;
    if (brouillon?.uri) deleteVoiceNoteFile(brouillon.uri).catch(() => {});
  }, []);

  return useMemo(() => ({
    abortArming,
    activateHold,
    cancel,
    draft,
    interrupt,
    lock,
    phase,
    pressIn,
    release,
    send,
    startLocked,
    stopToReview,
    subscribeTick,
    trash: cancel,
  }), [
    abortArming, activateHold, cancel, draft, interrupt, lock, phase, pressIn, release, send,
    startLocked, stopToReview, subscribeTick,
  ]);
}
