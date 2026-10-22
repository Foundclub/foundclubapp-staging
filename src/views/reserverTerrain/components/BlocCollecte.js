import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { texteEcheance } from '@/domains/complexe/partieDuJoueur';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

const HEURE_MS = 60 * 60 * 1000;
const REQUIS_MIN = 2;

/**
 * @typedef {{ echeance: string, echeances: string[], plusTard: string, quorum: number }} Collecte
 *   La collecte choisie : la date limite, celles qu'on propose, la plus tardive que le complexe
 *   permet (le serveur la rend), le nombre requis (toi compris).
 */

/**
 * L'OPTION COLLECTE — RESA-L6B-2 (20/10/2026), planche EP04 états 1 et 3, plan E-P04 bloc 4
 * (A-P07, A-P08, RC-P05, Q3) : « Réserver seulement quand assez de joueurs ont répondu présent ».
 * Cochée : « Nombre requis (toi compris) » (de 2 au nombre de joueurs), « Date limite » (au plus
 * tard ce que le complexe permet : le serveur le rend), l'aide qui dit la règle du complexe, et le
 * bandeau d'A-P08 « le créneau reste libre ». Le serveur reborne tout (RG-QUORUM).
 * @param {object} props - Les propriétés.
 * @param {Collecte | null} props.collecte - La collecte, ou null (décochée).
 * @param {boolean} props.enCours - Le serveur rend la date limite (case touchée).
 * @param {number} props.joueurs - Le nombre de joueurs (plafond du nombre requis).
 * @param {(collecte: Collecte) => void} props.onChange - Le nombre ou la date changés.
 * @param {() => void} props.onBasculer - La case touchée.
 * @param {string | null} props.refus - La phrase du serveur quand la collecte n'est pas possible.
 * @param {string | null | undefined} props.startsAt - Le début du créneau (ISO).
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocCollecte({
  collecte, enCours, joueurs, onBasculer, onChange, refus, startsAt,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const cochee = Boolean(collecte);
  const libelle = t(
    'reserverTerrain.collecte.option',
    'Réserver seulement quand assez de joueurs ont répondu présent',
  );
  const heures = collecte
    ? Math.round((new Date(String(startsAt)).getTime() - new Date(collecte.plusTard).getTime())
      / HEURE_MS)
    : NaN;

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.6),
        borderColor: cochee ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
        borderLeftWidth: cochee ? 4 : 1,
        borderRadius: 20,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      <TouchableOpacity
        accessibilityLabel={libelle}
        accessibilityRole="checkbox"
        accessibilityState={{ busy: enCours, checked: cochee }}
        disabled={enCours}
        onPress={onBasculer}
        style={[Alignments.row, { alignItems: 'flex-start', gap: 12, minHeight: 44 }]}
        testID="reserver-collecte"
      >
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: cochee ? Colors.primary500 : 'transparent',
              borderColor: cochee ? Colors.primary500 : Colors.primary200,
              borderRadius: 6,
              borderWidth: 2,
              height: 24,
              marginTop: 2,
              width: 24,
            },
          ]}
        >
          {cochee ? (
            <SvgIcon color={Colors.primary900} height={16} name="check" width={16} />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelle}</Text>
          {!cochee ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'reserverTerrain.collecte.optionAide',
                'Le créneau n’est réservé qu’une fois le nombre atteint.',
              )}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {refus ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
      ) : null}

      {collecte ? (
        <>
          <View style={{ gap: 6 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('reserverTerrain.collecte.requis', 'Nombre requis (toi compris)')}
            </Text>
            <InputStepper
              decrementLabel={t(
                'reserverTerrain.collecte.requisMoins',
                'Un joueur requis de moins',
              )}
              incrementLabel={t('reserverTerrain.collecte.requisPlus', 'Un joueur requis de plus')}
              max={Math.max(REQUIS_MIN, joueurs)}
              min={REQUIS_MIN}
              onDecrement={() => onChange({
                ...collecte, quorum: Math.max(REQUIS_MIN, collecte.quorum - 1),
              })}
              onIncrement={() => onChange({
                ...collecte, quorum: Math.min(Math.max(REQUIS_MIN, joueurs), collecte.quorum + 1),
              })}
              tone="tunnel"
              value={collecte.quorum}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('reserverTerrain.collecte.dateLimite', 'Date limite')}
            </Text>
            <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
              {collecte.echeances.map((echeance) => (
                <PuceChoix
                  choisie={echeance === collecte.echeance}
                  key={echeance}
                  libelle={texteEcheance(t, echeance)}
                  onPress={() => onChange({ ...collecte, echeance })}
                  testID={`reserver-echeance-${echeance}`}
                />
              ))}
            </View>
            {Number.isFinite(heures) && heures > 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'reserverTerrain.collecte.regle',
                  'Au plus tard {{heures}} h avant le créneau : la règle du complexe.',
                  { heures, ...SANS_ECHAPPEMENT },
                )}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary500, 0.1),
              borderColor: withAlpha(Colors.primary500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p2, Fonts.neutral00]}>
              {t(
                'reserverTerrain.collecte.resteLibre',
                'En attendant, le créneau reste libre : quelqu’un peut le réserver avant toi.',
              )}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default BlocCollecte;
