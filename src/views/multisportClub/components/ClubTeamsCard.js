import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import { readAttendanceRow } from '@/views/team/performance/TeamAttendancePanel';

import { getTeamPerformanceStats } from '@/services/matchStats/matchStatsService';
import { getTeamStats } from '@/services/stats/statsService';

/**
 * ST-VUES3-ORDI (03/10) — « LES ÉQUIPES », LA COLONNE DE DROITE DE L'ÉCRAN 18 SUR ORDINATEUR
 * (« FoundClub — Statistiques », planche P5-club-ordi).
 *
 * « Les équipes et le lien vers leurs stats, à droite. Le dirigeant suit son club sans ouvrir
 * chaque équipe. » Chaque équipe dit son bilan (« 1 victoire · 0 nul · 0 défaite ») ; un sport
 * sans score de match dit sa présence (« Présence : pas encore d’appel »). « Stats » ouvre
 * l'onglet Stats de l'équipe, ouvert au dirigeant (STATS-ENQUÊTE, défaut 3).
 *
 * Les lectures sont celles de l'onglet Stats (mêmes routes, mêmes clés, donc le même cache),
 * derrière la même porte `can-view-team-stats` (le dirigeant du club y passe). Une lecture
 * refusée ou en cours laisse l'équipe sans ligne de bilan : la carte ne casse jamais.
 */

/**
 * Les seuls sports dont l'app saisit le score : la même règle que le serveur (weekend-results,
 * `SCORED_SPORTS` ; match-stats-report, `normalizeSportLabel`) et que la fiche d'équipe.
 * Ailleurs, `GET /teams/:id/performance-stats` répond 400 : on ne le demande pas.
 * @param {unknown} sport - Le sport de l'équipe.
 * @returns {boolean} Vrai pour le football et le basket.
 */
const hasMatchScores = (sport) => ['basket', 'foot']
  .some((key) => String(sport || '').toLowerCase().includes(key));

const STALE_MS = 5 * 60 * 1000;

/**
 * @typedef {{
 *   club?: any, clubName?: string | null, documentId?: string, logoUrl?: string | null,
 *   name?: string | null, sport?: string | null,
 * }} ClubTeam
 */

/**
 * La carte « Les équipes » du dirigeant, sur ordinateur.
 * @param {object} props - Les propriétés du composant.
 * @param {ClubTeam[]} [props.teams] - Les équipes du club.
 * @param {(team: ClubTeam) => void} props.onOpenTeamStats - Ouvrir l'onglet Stats d'une équipe.
 * @returns {import('react').ReactElement | null} La carte.
 */
function ClubTeamsCard({ onOpenTeamStats, teams = [] }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  // ponytail: une lecture par équipe — un club en a de quelques-unes à une vingtaine, et
  // l'onglet Stats de chacune en profite (même cache). Au-delà, une route serveur « le bilan
  // de toutes les équipes du club » remplacera cette boucle.
  const lectures = useQueries({
    queries: teams.map((team) => {
      const teamId = String(team?.documentId || '');
      return hasMatchScores(team?.sport)
        ? {
          enabled: Boolean(teamId),
          queryFn: () => getTeamPerformanceStats(teamId),
          queryKey: ['teamPerformanceStats', teamId],
          staleTime: STALE_MS,
        }
        : {
          enabled: Boolean(teamId),
          queryFn: () => getTeamStats(teamId),
          queryKey: ['teamStats', teamId],
          staleTime: STALE_MS,
        };
    }),
  });

  if (!teams.length) return null;

  /**
   * Le bilan d'un sport à score, ou la présence des autres.
   * @param {ClubTeam} team - L'équipe.
   * @param {any} stats - Sa lecture, telle que le serveur la rend.
   * @returns {string} La ligne, ou vide tant qu'elle n'est pas lue.
   */
  const summaryOf = (team, stats) => {
    if (!stats) return '';
    if (hasMatchScores(team?.sport)) {
      const totals = stats?.totals || {};
      const matches = Number(totals?.matches ?? totals?.matchesPlayed ?? 0);
      if (!matches) return t('teamStatsPanel.emptyTitle', 'Pas encore de résultat');
      return [
        t('clubTeamsCard.wins', {
          count: Number(totals?.wins || 0),
          defaultValue_one: '{{count}} victoire',
          defaultValue_other: '{{count}} victoires',
        }),
        t('clubTeamsCard.draws', {
          count: Number(totals?.draws || 0),
          defaultValue_one: '{{count}} nul',
          defaultValue_other: '{{count}} nuls',
        }),
        t('clubTeamsCard.losses', {
          count: Number(totals?.losses || 0),
          defaultValue_one: '{{count}} défaite',
          defaultValue_other: '{{count}} défaites',
        }),
      ].join(' · ');
    }
    // Sans appel, une phrase, jamais « 0 % » (même règle que « Vie d'équipe »).
    const rows = (Array.isArray(stats?.data) ? stats.data : []).map(readAttendanceRow);
    const pointed = rows.reduce((total, row) => total + row.pointed, 0);
    if (!pointed) return t('clubTeamsCard.presenceNone', 'Présence : pas encore d’appel');
    const attended = rows.reduce((total, row) => total + row.attended, 0);
    const rate = Number(stats?.teamAverage?.presenceRate ?? attended / pointed);
    return t('clubTeamsCard.presence', 'Présence : {{percent}}', {
      percent: `${Math.round(rate * 100)} %`,
      ...SANS_ECHAPPEMENT,
    });
  };

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        Spaces.gap[12],
      ]}
      testID="club-teams-card"
    >
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('clubTeamsCard.title', 'Les équipes')}
      </Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 12,
        }}
      >
        {teams.map((team, index) => {
          const name = team?.name || '';
          const sport = String(team?.sport || '').trim().toLocaleLowerCase('fr');
          const summary = summaryOf(team, lectures[index]?.data);
          return (
            <TouchableOpacity
              accessibilityLabel={t('clubTeamsCard.openStatsA11y', '{{team}} : ouvrir ses stats', {
                team: name,
                ...SANS_ECHAPPEMENT,
              })}
              accessibilityRole="link"
              key={team?.documentId || `${name}-${index}`}
              onPress={() => onOpenTeamStats(team)}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[12],
                {
                  borderTopColor: withAlpha(Colors.neutral00, 0.08),
                  borderTopWidth: index === 0 ? 0 : 1,
                  minHeight: 52,
                  paddingVertical: 6,
                },
              ]}
            >
              <ClubLogoMark
                club={team?.club}
                logoUrl={team?.logoUrl || undefined}
                name={team?.clubName || team?.club?.name || name}
                size={32}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {sport ? `${name} · ${sport}` : name}
                </Text>
                {summary ? (
                  <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{summary}</Text>
                ) : null}
              </View>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('clubTeamsCard.stats', 'Stats')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default ClubTeamsCard;
