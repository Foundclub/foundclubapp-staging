import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

// STATS-VND (24/09) — LE BILAN DE L EQUIPE : VICTOIRES, NULS, DEFAITES.
//
// Decision B d Adel (24/09) : un match compte des que son score est saisi. Le
// serveur sert `totals.wins / draws / losses` depuis STATS-SCORE ; la carte
// « Performance » ne les montrait nulle part. Trois tuiles au style exact des
// tuiles voisines (Matchs, Buts...), pour qu elles se lisent comme une seule
// famille.
//
// ⚠️ Un serveur plus ancien n envoie pas ces champs : on n affiche alors RIEN,
// plutot qu un « 0 victoire » qui mentirait.

/**
 * Le bilan de l equipe en trois tuiles : victoires, nuls, defaites.
 * @param {object} props
 * @param {{ draws?: unknown, losses?: unknown, wins?: unknown } | null} [props.totals]
 *   Les totaux servis par le serveur.
 * @returns {import('react').ReactElement | null} Les trois tuiles, ou rien.
 */
function TeamRecordTiles({ totals }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { draws, losses, wins } = totals || {};
  if (![wins, draws, losses].every((value) => typeof value === 'number')) return null;

  const tiles = [
    { key: 'wins', label: t('teamDetails.perf.stats.wins', 'Victoires'), value: Number(wins) },
    { key: 'draws', label: t('teamDetails.perf.stats.draws', 'Nuls'), value: Number(draws) },
    { key: 'losses', label: t('teamDetails.perf.stats.losses', 'Défaites'), value: Number(losses) },
  ];

  return (
    <View style={[Alignments.row, Spaces.gap[8]]}>
      {tiles.map((tile) => (
        <View
          accessibilityLabel={`${tile.value} ${tile.label}`}
          accessible
          key={tile.key}
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius24,
            Spaces.padding[16],
            Spaces.gap[4],
            { flex: 1 },
          ]}
        >
          <Text numberOfLines={1} style={[Fonts.p4Bold, Fonts.primary100]}>{tile.label}</Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{tile.value}</Text>
        </View>
      ))}
    </View>
  );
}

export default TeamRecordTiles;
