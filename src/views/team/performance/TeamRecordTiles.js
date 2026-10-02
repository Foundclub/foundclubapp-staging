import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

// STATS-VND (24/09) — LE BILAN DE L EQUIPE : VICTOIRES, NULS, DEFAITES.
//
// Decision B d Adel (24/09) : un match compte des que son score est saisi. Le
// serveur sert `totals.wins / draws / losses` depuis STATS-SCORE.
//
// ST-VUES (02/10, planche 13 du design valide) : le CHIFFRE d abord, le mot
// dessous, au singulier ou au pluriel (« 1 Victoire », « 0 Nul », « 2 Défaites ») ;
// la victoire en vert et la defaite en rouge, le mot disant AUSSI ce que la
// couleur dit (« V, N, D distincts par la lettre ET la couleur »).
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
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { draws, losses, wins } = totals || {};
  if (![wins, draws, losses].every((value) => typeof value === 'number')) return null;

  const tiles = [
    {
      color: Colors.success200,
      key: 'wins',
      label: t('teamStatsPanel.recordWins', 'Victoire', { count: Number(wins) }),
      value: Number(wins),
    },
    {
      color: Colors.neutral00,
      key: 'draws',
      label: t('teamStatsPanel.recordDraws', 'Nul', { count: Number(draws) }),
      value: Number(draws),
    },
    {
      color: Colors.error300,
      key: 'losses',
      label: t('teamStatsPanel.recordLosses', 'Défaite', { count: Number(losses) }),
      value: Number(losses),
    },
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
            ApplicationStyle.borderRadius16,
            Spaces.padding[12],
            Spaces.gap[4],
            { flex: 1 },
          ]}
        >
          <Text style={[Fonts.h3Bold, { color: tile.color }]}>{tile.value}</Text>
          <Text numberOfLines={1} style={[Fonts.p4, Fonts.primary100]}>{tile.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default TeamRecordTiles;
