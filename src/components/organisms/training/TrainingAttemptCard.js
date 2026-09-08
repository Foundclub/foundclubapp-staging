import { useTranslation } from 'react-i18next';
import {
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import TrainingMeasureInput from '@/components/organisms/training/TrainingMeasureInput';

/**
 * UNE CARTE PAR ESSAI — la boucle du terrain, dans le bon sens.
 *
 * 🔎 POURQUOI CE COMPOSANT RENVERSE TOUT. L'écran d'un test présentait UNE MESURE et
 * tous ses essais : « Hauteur : essai 1, essai 2, essai 3 », puis « Masse : essai 1,
 * essai 2, essai 3 ». Or ce n'est pas ainsi qu'on travaille. On fait UN saut, et on
 * note TOUT de ce saut : la hauteur, la masse, la sensation. Puis on recommence. Avec
 * l'ancien ordre, il fallait remonter et redescendre l'écran entre chaque essai — les
 * mains sales, un partenaire qui attend, et le risque de taper la hauteur du saut 2
 * dans la case du saut 1.
 *
 * 🪤 « ESSAI NUL » EST UNE PROPRIÉTÉ DE L'ESSAI, PAS D'UNE MESURE. Un faux départ
 * annule tout le saut, pas seulement sa hauteur. La bascule vit donc sur la CARTE et
 * marque toutes ses mesures d'un coup. Avant, il fallait cocher une petite croix
 * mesure par mesure — et rien n'empêchait d'en oublier une, ce qui laissait au carnet
 * un essai à moitié valide qui fausse toutes les moyennes.
 */

/** Les deux côtés d'une mesure latéralisée, dans l'ordre du protocole. */
const COTES = ['left', 'right'];

/**
 * Une carte d'essai : son numéro, ses mesures, et sa bascule « essai nul ».
 * @param {object} props Les propriétés de la carte.
 * @param {boolean} props.enCours Vrai quand c'est l'essai qu'on est en train de faire.
 * @param {number} props.essai Le numéro de cet essai, à partir de 1.
 * @param {Record<string, any>[]} props.measures Les mesures à saisir sur le terrain.
 * @param {(row: Record<string, any>) => void} props.onRecord Enregistre une valeur.
 * @param {(raison: string) => void} props.onReason Note pourquoi l'essai est nul.
 * @param {() => void} props.onToggleInvalid Bascule TOUT l'essai entre nul et valide.
 * @param {string} props.raison Le motif déjà noté, s'il y en a un.
 * @param {number} props.total Le nombre total d'essais du test.
 * @param {boolean} props.nul Vrai quand l'essai est marqué nul.
 * @param {(key: string) => Record<string, any>} props.valuesFor Les valeurs d'une mesure.
 * @returns {React.ReactElement} la carte de cet essai
 */
function TrainingAttemptCard({
  enCours, essai, measures, nul, onReason, onRecord, onToggleInvalid, raison, total, valuesFor,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  // Une mesure latéralisée se lit en DEUX COLONNES dans la carte : gauche à
  // gauche, droite à droite. Empilées, on ne voit pas qu'elles se comparent — et
  // c'est exactement ce qu'on cherche sur un test d'asymétrie.
  const aDesCotes = measures.some((m) => Boolean(m?.sides));

  return (
    <View
      style={[
        Spaces.gap[12],
        {
          // Un essai nul passe TOUTE la carte en or : on doit le voir en faisant
          // défiler, sans lire. C'est ce qui évite de croire à une valeur ratée.
          backgroundColor: nul ? withAlpha(Colors.gold500, 0.1) : Colors.neutral800,
          borderColor: (() => {
            if (nul) return Colors.gold500;
            return enCours ? Colors.primary500 : withAlpha(Colors.primary500, 0.2);
          })(),
          borderRadius: 12,
          borderWidth: enCours || nul ? 2 : 1,
          padding: 14,
        },
      ]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Text style={[Fonts.p2Bold, { color: nul ? Colors.gold500 : Colors.neutral00, flex: 1 }]}>
          {t('training.attempt.title', { current: essai, total })}
        </Text>
        {nul && (
          <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
            {t('training.logbook.void')}
          </Text>
        )}
      </View>

      <View style={aDesCotes ? { flexDirection: 'row', gap: 12 } : Spaces.gap[12]}>
        {measures.map((measure) => (
          <View key={measure.key} style={measure.sides ? { flex: 1 } : undefined}>
            <TrainingMeasureInput
              attempt={essai}
              measure={measure}
              onRecord={onRecord}
              onToggleInvalid={onToggleInvalid}
              values={valuesFor(measure.key)}
            />
          </View>
        ))}
      </View>

      {/*
        ⛔ UNE RANGÉE PLEINE LARGEUR, PAS UNE PETITE CROIX. Le pack l'interdit
        explicitement, et il a raison : une croix de douze points au bout d'un
        champ se rate une fois sur deux avec les doigts froids, et surtout elle
        se lit comme « effacer » alors qu'elle veut dire « garder, mais nul ».
      */}
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: nul }}
        onPress={onToggleInvalid}
        style={{
          alignItems: 'center',
          borderColor: nul ? Colors.gold500 : withAlpha(Colors.gold500, 0.35),
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 12,
        }}
      >
        <View style={{
          backgroundColor: nul ? Colors.gold500 : 'transparent',
          borderColor: Colors.gold500,
          borderRadius: 4,
          borderWidth: 1,
          height: 18,
          width: 18,
        }}
        />
        <Text style={[Fonts.p3, { color: nul ? Colors.gold500 : Colors.neutral200, flex: 1 }]}>
          {t('training.attempt.void')}
        </Text>
      </TouchableOpacity>

      {/*
        LE MOTIF. Le libellé existait et le serveur acceptait déjà le champ : il
        ne manquait que la case. Un essai nul sans raison est inexploitable trois
        mois plus tard — on ne sait plus si c'était un faux départ ou une caméra
        mal placée, donc on ne sait pas s'il faut refaire le test.
      */}
      {nul && (
        <TextInput
          onChangeText={onReason}
          placeholder={t('training.attempt.reason')}
          placeholderTextColor={Colors.neutral500}
          style={[
            Fonts.p3,
            {
              borderColor: withAlpha(Colors.gold500, 0.4),
              borderRadius: 8,
              borderWidth: 1,
              color: Colors.neutral00,
              minHeight: 44,
              paddingHorizontal: 12,
            },
          ]}
          value={raison}
        />
      )}
    </View>
  );
}

export { COTES };
export default TrainingAttemptCard;
