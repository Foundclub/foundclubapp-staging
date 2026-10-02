import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { formatAverage } from '@/views/profile/stats/MySeasonCard';

/**
 * ST-VUES — LA PAGE « MES STATS » (planche 16 du design valide, etats 4 et 5).
 *
 * Ce que le serveur calculait deja sans le montrer (defaut 6 du releve) :
 *   · un filtre par sport ; un sport SANS stats de match le dit franchement,
 *     au lieu d afficher des zeros, et ouvre la fiche de l equipe ;
 *   · Matchs, V · N · D, ma note moyenne ;
 *   · « Mes derniers matchs » : le match, la lettre V / N / D, l equipe, la date,
 *     le score, MES minutes, buts (points au basket), passes, ma note, et mon mot —
 *     « lu par toi et ton entraîneur » (decision d Adel du 02/10, « profil A »).
 *
 * Purement presentationnel : aucune requete, aucun service.
 */

const STATS_SPORTS = ['football', 'basketball'];

/**
 * « Football », « Arts martiaux » : le sport d une equipe, lisible.
 * @param {any} team - Une equipe du joueur.
 * @returns {string} - Le nom de son activite, ou vide.
 */
const teamSportName = (team) => String(team?.activities?.[0]?.name || team?.activity?.name || team?.sport || '')
  .trim();

/**
 * La page « Mes stats ».
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.stats] - Mes stats personnelles.
 * @param {any[]} [props.teams] - Mes equipes de joueur, pour les sports sans stats de match.
 * @param {(team: any) => void} [props.onOpenTeam] - Ouvrir la fiche d une equipe.
 * @returns {import('react').ReactElement} - La page.
 */
function MyStatsPage({ onOpenTeam, stats, teams = [] }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const filters = useMemo(() => {
    const bySport = Array.isArray(stats?.bySport) ? stats.bySport : [];
    const withStats = bySport
      .filter((entry) => STATS_SPORTS.includes(String(entry?.sport || '')))
      .map((entry) => ({ entry, key: String(entry.sport), team: null }));
    const known = new Set(withStats.map((filter) => filter.key));
    (Array.isArray(teams) ? teams : []).forEach((team) => {
      const name = teamSportName(team);
      const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const hasMatchStats = normalized.includes('foot') || normalized.includes('basket');
      if (!name || hasMatchStats || known.has(normalized)) return;
      known.add(normalized);
      withStats.push({
        entry: null, key: normalized, label: name, team,
      });
    });
    return withStats;
  }, [stats?.bySport, teams]);
  const [selectedKey, setSelectedKey] = useState(/** @type {string | null} */ (null));
  const selected = filters.find((filter) => filter.key === selectedKey) || filters[0] || null;

  const sportLabel = (/** @type {any} */ filter) => {
    if (filter.key === 'football') return t('myStats.sportFootball', 'Football');
    if (filter.key === 'basketball') return t('myStats.sportBasketball', 'Basket');
    return filter.label;
  };
  const letter = (/** @type {string | null} */ result) => {
    if (result === 'win') return { color: Colors.success200, text: t('teamStatsPanel.formWinLetter', 'V') };
    if (result === 'loss') return { color: Colors.error300, text: t('teamStatsPanel.formLossLetter', 'D') };
    if (result === 'draw') return { color: Colors.neutral100, text: t('teamStatsPanel.formDrawLetter', 'N') };
    return null;
  };
  const matchDay = (/** @type {unknown} */ value) => {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(localeDesFormats(), { day: 'numeric', month: 'short', weekday: 'short' })
      .format(date);
  };

  if (!selected) {
    return (
      <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter]} testID="my-stats-empty">
        {t('myStats.emptyHint', 'Ta saison se remplit à chaque retour de match que tu envoies.')}
      </Text>
    );
  }

  const { entry } = selected;
  const matches = (Array.isArray(stats?.recentMatches) ? stats.recentMatches : [])
    .filter((match) => String(match?.sport || '') === selected.key);

  return (
    <View style={[Spaces.gap[16]]} testID="my-stats">
      {filters.length > 1 ? (
        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          {filters.map((filter) => {
            const isSelected = filter.key === selected.key;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={filter.key}
                onPress={() => setSelectedKey(filter.key)}
                style={{
                  backgroundColor: isSelected ? Colors.primary500 : withAlpha(Colors.neutral00, 0.06),
                  borderRadius: 999,
                  justifyContent: 'center',
                  minHeight: 36,
                  paddingHorizontal: 16,
                }}
                testID={`my-stats-filter-${filter.key}`}
              >
                <Text style={[isSelected ? Fonts.p3Bold : Fonts.p3, Fonts.neutral00]}>{sportLabel(filter)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {!entry ? (
        <View style={[Spaces.gap[12], Spaces.paddingVertical[16]]} testID="my-stats-no-match-stats">
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('myStats.noMatchStatsTitle', 'Pas de stats de match en {{sport}}', {
              sport: selected.label.toLowerCase(),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'myStats.noMatchStatsBody',
              'La saisie des scores et des stats couvre le football et le basket. Ta présence aux séances des {{team}} se lit dans la fiche de l’équipe.',
              { team: selected.team?.name || '', ...SANS_ECHAPPEMENT },
            )}
          </Text>
          {onOpenTeam && selected.team ? (
            <Button
              onPress={() => onOpenTeam(selected.team)}
              title={t('myStats.openTeam', 'Ouvrir les {{team}}', { team: selected.team?.name || '', ...SANS_ECHAPPEMENT })}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : (
        <>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            {[
              { key: 'matches', label: t('myStats.matches', 'Match', { count: Number(entry.matches || 0) }), value: String(Number(entry.matches || 0)) },
              {
                key: 'record',
                label: t('myStats.record', 'V · N · D'),
                value: `${Number(entry.wins || 0)}·${Number(entry.draws || 0)}·${Number(entry.losses || 0)}`,
              },
              { key: 'rating', label: t('myStats.myAverageRating', 'Ma note moy.'), value: formatAverage(entry.averageSelfRating) },
            ].map((tile) => (
              <View
                key={tile.key}
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderRadius16,
                  Spaces.padding[12],
                  Spaces.gap[4],
                  { flex: 1 },
                ]}
              >
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{tile.value}</Text>
                <Text numberOfLines={1} style={[Fonts.p4, Fonts.primary100]}>{tile.label}</Text>
              </View>
            ))}
          </View>

          {matches.length ? (
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{t('myStats.recentMatches', 'Mes derniers matchs')}</Text>
              {matches.map((match, index) => {
                const chip = letter(match?.result || null);
                const score = match?.scoreFor !== null && match?.scoreFor !== undefined
                  ? `${match.scoreFor} - ${match.scoreAgainst}`
                  : '';
                const figures = [
                  t('myStats.matchMinutes', '{{count}} minutes', { count: Number(match?.minutesPlayed || 0) }),
                  selected.key === 'basketball'
                    ? t('myStats.matchPoints', '{{count}} point', { count: Number(match?.points || 0) })
                    : t('myStats.matchGoals', '{{count}} but', { count: Number(match?.goals || 0) }),
                  t('myStats.matchAssists', '{{count}} passe', { count: Number(match?.assists || 0) }),
                ];
                if (match?.selfRating !== null && match?.selfRating !== undefined) {
                  figures.push(t('myStats.matchRating', '{{rating}} ma note', { rating: match.selfRating }));
                }
                return (
                  <View
                    key={match?.documentId || `match-${index}`}
                    style={[
                      Spaces.gap[8],
                      Spaces.padding[12],
                      { backgroundColor: withAlpha(Colors.neutral00, 0.04), borderRadius: 16 },
                    ]}
                    testID={`my-stats-match-${match?.documentId || index}`}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                      <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                        {match?.matchLabel || t('myStats.matchFallback', 'Match')}
                      </Text>
                      {chip ? <Text style={[Fonts.p3Bold, { color: chip.color }]}>{chip.text}</Text> : null}
                    </View>
                    <Text style={[Fonts.p4, Fonts.neutral300]}>
                      {[match?.teamName, matchDay(match?.matchDate || match?.finalizedAt), score]
                        .filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>{figures.join(' · ')}</Text>
                    {match?.selfComment ? (
                      <Text style={[Fonts.p4, Fonts.neutral300]}>
                        {t('myStats.myWord', 'Mon mot : « {{comment}} » — lu par toi et ton entraîneur.', {
                          comment: match.selfComment,
                          ...SANS_ECHAPPEMENT,
                        })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export default MyStatsPage;
