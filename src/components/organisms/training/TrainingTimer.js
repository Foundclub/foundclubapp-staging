import {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text, TouchableOpacity, Vibration, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';

import useSafeTimers from '@/hooks/useSafeTimers';

/**
 * LE CHRONOMÈTRE DE RÉCUPÉRATION.
 *
 * 🔎 POURQUOI IL EXISTE : le protocole donne des récupérations à la seconde
 * (240 s entre deux sprints, 150 s entre deux Nordic, 480 s entre deux jambes).
 * Personne ne les compte de tête, et une récupération raccourcie fausse la mesure
 * suivante. Le téléphone est déjà en main pour saisir : il compte.
 *
 * ⏱️ IL COMPTE SUR L'HORLOGE, PAS SUR LES TICS. Un `setInterval` qui décrémente un
 * compteur dérive dès que l'application passe en arrière-plan ou que le fil est
 * occupé. Ici on garde l'heure de fin et on relit l'horloge : téléphone rangé dans
 * la poche pendant deux minutes, le décompte reste juste.
 *
 * Le nettoyage passe par `useSafeTimers` : un minuteur laissé derrière empêche
 * l'arbre de test de s'éteindre, et c'est une panne connue de ce dépôt.
 */

/**
 * Met un nombre de secondes sous la forme `m:ss`.
 * @param {number} seconds secondes restantes, negatif accepte
 * @returns {string} le decompte pret a afficher
 */
const format = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Affiche le décompte de récupération entre deux séries et le pilote (départ,
 * arrêt, remise à zéro), en relisant l'horloge au lieu de décrémenter un compteur.
 * @param {object} props
 * @param {number} props.seconds durée de récupération prescrite
 * @param {string} [props.label] ce qu'on attend pendant ce temps
 * @param {() => void} [props.onDone] appelé une fois, quand le compte atteint zéro
 * @returns {React.ReactElement}
 */
function TrainingTimer({ label, onDone, seconds }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { clearSafeTimer, setSafeInterval } = useSafeTimers();

  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  /** @type {{ current: number|null }} */
  const endAtRef = useRef(null);
  /** @type {{ current: any }} */
  const timerRef = useRef(null);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    if (timerRef.current) clearSafeTimer(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, [clearSafeTimer]);

  const tick = useCallback(() => {
    if (!endAtRef.current) return;
    const left = (endAtRef.current - Date.now()) / 1000;
    setRemaining(left);
    if (left <= 0) {
      setRemaining(0);
      stop();
      if (!doneRef.current) {
        doneRef.current = true;
        // Deux vibrations courtes : sur un terrain, on n'entend rien et on ne regarde pas.
        Vibration.vibrate([0, 220, 120, 220]);
        if (typeof onDone === 'function') onDone();
      }
    }
  }, [onDone, stop]);

  const start = useCallback(() => {
    doneRef.current = false;
    endAtRef.current = Date.now() + Math.max(1, seconds) * 1000;
    setRemaining(seconds);
    setRunning(true);
    if (timerRef.current) clearSafeTimer(timerRef.current);
    timerRef.current = setSafeInterval(tick, 250);
  }, [clearSafeTimer, seconds, setSafeInterval, tick]);

  const reset = useCallback(() => {
    stop();
    endAtRef.current = null;
    doneRef.current = false;
    setRemaining(seconds);
  }, [seconds, stop]);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => { setRemaining(seconds); }, [seconds]);

  const finished = remaining <= 0 && !running;
  const color = finished ? Colors.success500 : Colors.neutral00;
  // La barre se VIDE : elle part pleine et rétrécit. Une barre qui se remplit
  // dirait « avancement », pas « temps restant » — et sur un terrain on lit la
  // forme avant le chiffre.
  const reste = Math.max(0, Math.min(1, seconds ? remaining / seconds : 0));

  return (
    <View
      style={[
        Spaces.gap[8],
        {
          // ⏰ LE FOND PASSE AU VERT QUAND CA SONNE. On ne regarde pas le
          // telephone pendant une recuperation : on le pose. Ce qui doit
          // rattraper l oeil, c est un aplat de couleur, pas un chiffre.
          backgroundColor: finished ? withAlpha(Colors.success500, 0.15) : Colors.neutral800,
          borderColor: (() => {
            if (finished) return Colors.success500;
            return running ? Colors.primary500 : Colors.neutral600;
          })(),
          borderRadius: 10,
          borderWidth: 1,
          padding: 12,
        },
      ]}
    >
      <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
        {label || t('training.timer.recovery')}
      </Text>

      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        {/*
          72 points : on lit ce chiffre a bout de bras, pose par terre, entre deux
          sauts. A la taille courante il fallait se pencher — donc on ne le
          regardait pas, donc la minuterie ne servait a rien.
        */}
        <Text style={[
          Fonts.h2Bold,
          {
            color,
            fontSize: finished ? 32 : 72,
            fontVariant: ['tabular-nums'],
            lineHeight: finished ? 38 : 78,
          },
        ]}
        >
          {finished ? t('training.timer.done') : format(remaining)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={{
              bottom: 8, left: 8, right: 8, top: 8,
            }}
            onPress={running ? stop : start}
            style={{
              backgroundColor: running ? Colors.neutral600 : Colors.primary500,
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
              {running ? t('training.timer.stop') : t('training.timer.start')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={{
              bottom: 8, left: 8, right: 8, top: 8,
            }}
            onPress={reset}
            style={{
              borderColor: Colors.neutral600,
              borderRadius: 8,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('training.timer.reset')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TrainingProgressBar
        color={finished ? Colors.success500 : Colors.primary500}
        ratio={finished ? 1 : reste}
      />
    </View>
  );
}

export default memo(TrainingTimer);
