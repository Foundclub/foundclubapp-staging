import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

/**
 * ST-VUES — « MA SAISON », sur MON profil (planche 16 du design valide, etats 1, 3, 6).
 *
 * La rangee compacte du pack profil (PJ-1), avec ce que la planche y ajoute :
 *   · un titre, « Ma saison · football », et « Tout voir » vers la page « Mes stats » ;
 *   · « V · N · D », les nuls comptes (servis par le serveur depuis ST-VUES) ;
 *   · « Ma note », la moyenne de mes propres notes ;
 *   · la rangee SUIT le sport : points et rebonds pour un basketteur, jamais
 *     « Buts » chez lui ;
 *   · une phrase dit ce qu elle compte. A zero, elle dit comment elle se remplit.
 * ⛔ Retire (planche) : « Défaites » seules, « Buts » chez un basketteur, la rangee
 * sans titre ni explication.
 */

/**
 * Le sport de ma saison : celui ou j ai le plus de matchs, sinon celui de mon equipe.
 * @param {any} stats - `GET /firebase-auth/users/:id/personal-stats`.
 * @param {string} [sportHint] - Le sport de mon equipe, quand je n ai encore aucun match.
 * @returns {{ entry: any, sport: 'basketball' | 'football' }} - Le sport et ses chiffres.
 */
export const pickSeasonSport = (stats, sportHint = '') => {
  const bySport = Array.isArray(stats?.bySport) ? stats.bySport : [];
  const [entry] = [...bySport].sort(
    (left, right) => Number(right?.matches || 0) - Number(left?.matches || 0),
  );
  const raw = String(entry?.sport || sportHint || '').toLowerCase();
  const sport = raw.includes('basket') ? 'basketball' : 'football';
  if (entry) return { entry, sport };
  // Un serveur qui ne rend que `overall` : la saison se lit la, sport par sport.
  const overall = stats?.overall || null;
  if (!overall) return { entry: null, sport };
  return {
    entry: {
      ...(overall[sport] || {}),
      averageSelfRating: overall.averageSelfRating ?? null,
      draws: overall.draws,
      losses: overall.losses,
      matches: overall.matches,
      minutesPlayed: overall.minutesPlayed,
      wins: overall.wins,
    },
    sport,
  };
};

/**
 * « 7,1 » : une note moyenne, a la virgule de la langue.
 * @param {unknown} value - La moyenne.
 * @returns {string} - La note, ou « — ».
 */
export const formatAverage = (value) => (value === null || value === undefined || value === ''
  ? '—'
  : Number(value).toLocaleString(localeDesFormats(), { maximumFractionDigits: 1 }));

/**
 * La carte « Ma saison ».
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.stats] - Mes stats personnelles.
 * @param {string} [props.sportHint] - Le sport de mon equipe.
 * @param {() => void} [props.onPressSeeAll] - Ouvrir la page « Mes stats ».
 * @returns {import('react').ReactElement} - La carte.
 */
function MySeasonCard({ onPressSeeAll, sportHint = '', stats }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { entry, sport } = pickSeasonSport(stats, sportHint);
  const matches = Number(entry?.matches || 0);
  const record = `${Number(entry?.wins || 0)}·${Number(entry?.draws || 0)}·${Number(
    entry?.losses || 0,
  )}`;

  const cells = sport === 'basketball'
    ? [
      {
        key: 'matches',
        label: t('myStats.matches', 'Match', { count: matches }),
        value: String(matches),
      },
      { key: 'record', label: t('myStats.record', 'V · N · D'), value: record },
      {
        key: 'points',
        label: t('myStats.points', 'Point', { count: Number(entry?.points || 0) }),
        value: String(Number(entry?.points || 0)),
      },
      {
        key: 'rebounds',
        label: t('myStats.rebounds', 'Rebond', { count: Number(entry?.rebounds || 0) }),
        value: String(Number(entry?.rebounds || 0)),
      },
      {
        key: 'assists',
        label: t('myStats.assists', 'Passe déc.', { count: Number(entry?.assists || 0) }),
        value: String(Number(entry?.assists || 0)),
      },
      {
        key: 'rating',
        label: t('myStats.myRating', 'Ma note'),
        value: formatAverage(entry?.averageSelfRating),
      },
    ]
    : [
      {
        key: 'matches',
        label: t('myStats.matches', 'Match', { count: matches }),
        value: String(matches),
      },
      { key: 'record', label: t('myStats.record', 'V · N · D'), value: record },
      {
        key: 'minutes',
        label: t('myStats.minutes', 'Minutes'),
        value: String(Number(entry?.minutesPlayed || 0)),
      },
      {
        key: 'goals',
        label: t('myStats.goals', 'But', { count: Number(entry?.goals || 0) }),
        value: String(Number(entry?.goals || 0)),
      },
      {
        key: 'assists',
        label: t('myStats.assists', 'Passe déc.', { count: Number(entry?.assists || 0) }),
        value: String(Number(entry?.assists || 0)),
      },
      {
        key: 'rating',
        label: t('myStats.myRating', 'Ma note'),
        value: formatAverage(entry?.averageSelfRating),
      },
    ];

  return (
    <View style={[Spaces.gap[8]]} testID="my-season">
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {sport === 'basketball'
            ? t('myStats.seasonBasketball', 'Ma saison · basket')
            : t('myStats.seasonFootball', 'Ma saison · football')}
        </Text>
        {matches > 0 && onPressSeeAll ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={onPressSeeAll}
            style={{ justifyContent: 'center', minHeight: 32 }}
            testID="my-season-see-all"
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('myStats.seeAll', 'Tout voir')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          padding: 12,
          rowGap: 8,
        }}
      >
        {cells.map((cell) => (
          <View key={cell.key} style={{ alignItems: 'center', width: '33.33%' }}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>{cell.value}</Text>
            <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300]}>
              {cell.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[Fonts.p4, Fonts.neutral300]}>
        {matches > 0
          ? t('myStats.countedHint', 'Comptés : les matchs où tu as répondu au questionnaire.')
          : t(
            'myStats.emptyHint',
            'Ta saison se remplit à chaque retour de match que tu envoies.',
          )}
      </Text>
    </View>
  );
}

export default MySeasonCard;
