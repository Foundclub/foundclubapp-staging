import {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import useTheme from '@/theme/themeContext';

import { formatVoiceClock } from '@/services/chat/voiceWaveform';

// VOCAL — LE CHRONOMÈTRE DE L'ENREGISTREMENT.
//
// Le micro annonce son temps vingt fois par seconde ; le libellé n'en montre
// qu'une (m:ss). Ce composant écoute le micro lui-même et ne se redessine QUE
// quand la seconde affichée change — une fois par seconde, et lui seul.
// Chiffres tabulaires, largeur fixe de 34 : rien ne bouge autour de lui.

/**
 * Le chronomètre.
 * @param {{
 *   generation: number,
 *   subscribeTick: (ecouteur: (niveau: number, dureeMs: number) => void) => () => void,
 * }} props - La source du temps ; `generation` change à chaque prise (retour à 0:00).
 * @returns {import('react').ReactElement} Le chronomètre.
 */
function VoiceChrono({ generation, subscribeTick }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const [dureeMs, setDureeMs] = useState(0);
  const dernierLibelle = useRef(formatVoiceClock(0));

  useEffect(() => {
    dernierLibelle.current = formatVoiceClock(0);
    setDureeMs(0);
  }, [generation]);

  useEffect(() => subscribeTick((_niveau, duree) => {
    const libelle = formatVoiceClock(duree);
    if (libelle === dernierLibelle.current) return;
    dernierLibelle.current = libelle;
    setDureeMs(duree);
  }), [subscribeTick]);

  const secondes = Math.floor(dureeMs / 1000);
  return (
    <Text
      // Pas de région « live » : une annonce par seconde serait insupportable.
      accessibilityLabel={t('voiceComposer.duration', {
        count: secondes,
        defaultValue_one: 'Durée : {{count}} seconde',
        defaultValue_other: 'Durée : {{count}} secondes',
      })}
      numberOfLines={1}
      style={{
        ...Fonts.p2Bold,
        color: Colors.neutral00,
        fontVariant: ['tabular-nums'],
        width: 34,
      }}
      testID="voice-chrono"
    >
      {formatVoiceClock(dureeMs)}
    </Text>
  );
}

export default memo(VoiceChrono);
