import {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text } from 'react-native';

import useTheme from '@/theme/themeContext';

import {
  formatVoiceClock,
  isNearTakeLimit,
  VOICE_LIMIT_WARNING_MS,
} from '@/services/chat/voiceWaveform';

// VOCAL — LE CHRONOMÈTRE DE L'ENREGISTREMENT.
//
// Le micro annonce son temps vingt fois par seconde ; le libellé n'en montre
// qu'une (m:ss). Ce composant écoute le micro lui-même et ne se redessine QUE
// quand la seconde affichée change — une fois par seconde, et lui seul.
// Chiffres tabulaires, largeur fixe de 34 : rien ne bouge autour de lui.
//
// VOCAL2 — PRÉVENIR AVANT 10:00 (la maquette ne dit pas comment : proposé).
// Dans les 15 dernières secondes, les chiffres passent au ROUGE, et le
// lecteur d'écran l'annonce, une seule fois par prise. Rien ne bouge, rien ne
// vibre : on prévient sans interrompre celui qui parle.
// Le rouge CLAIR (error300), pas celui du point et du micro (error500) :
// mesuré sur le fond de la bande (primary800), error500 ne donne que 4,29:1
// — sous les 4,5:1 exigés pour un texte de 14 — ; error300 donne 7,35:1.

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
  const annonceFaite = useRef(false);

  useEffect(() => {
    dernierLibelle.current = formatVoiceClock(0);
    annonceFaite.current = false;
    setDureeMs(0);
  }, [generation]);

  useEffect(() => subscribeTick((_niveau, duree) => {
    const libelle = formatVoiceClock(duree);
    if (libelle === dernierLibelle.current) return;
    dernierLibelle.current = libelle;
    setDureeMs(duree);
  }), [subscribeTick]);

  const procheDeLaFin = isNearTakeLimit(dureeMs);
  useEffect(() => {
    if (!procheDeLaFin || annonceFaite.current) return;
    annonceFaite.current = true;
    AccessibilityInfo.announceForAccessibility(t('voiceComposer.limitSoon', {
      defaultValue: "Plus que {{seconds}} secondes d'enregistrement",
      seconds: VOICE_LIMIT_WARNING_MS / 1000,
    }));
  }, [procheDeLaFin, t]);

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
        color: procheDeLaFin ? Colors.error300 : Colors.neutral00,
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
