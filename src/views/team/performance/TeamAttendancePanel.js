import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import StatsIcon from '@/components/atoms/SvgIcon/SvgIcon';
import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';

/**
 * ST-VUES — « VIE D EQUIPE », planche 14 du design valide (« FoundClub —
 * Statistiques », page 5, 02/10).
 *
 * L ENCADREMENT (entraineur, dirigeant) lit :
 *   1. trois tuiles : Presence, Entrainements, Matchs (la moyenne de l equipe) ;
 *   2. « À surveiller · N » : sous 85 %, du plus bas au plus haut ;
 *   3. « Les autres · N », dans le meme ordre ;
 *   4. « Depuis le … ».
 * LE JOUEUR lit SA presence et la moyenne de l equipe, jamais la ligne d un
 * coequipier (decision d Adel du 02/10, « a non ») : c est le SERVEUR qui ne la
 * lui envoie pas (`viewerScope: 'self'`) ; ce composant ne fait que la dire.
 *
 * Un pourcentage se dit en chiffre ET en couleur. Sans appel : une phrase, jamais
 * « 0 % ». Apres une remise a zero : « Depuis le 2 oct. » et des tirets.
 *
 * Purement presentationnel : aucune requete, aucun service.
 */

/** Sous cette part, un joueur passe dans « À surveiller » (meme seuil que le ton). */
const WATCH_BELOW = 0.85;

/**
 * Le ton d une presence : vert, ambre, rouge (handoff 9e, repris tel quel).
 * @param {any} Colors - Les couleurs du theme.
 * @param {number} ratio - La part de presence, de 0 a 1.
 * @returns {string} - La couleur.
 */
export const presenceToneOf = (Colors, ratio) => {
  if (ratio >= WATCH_BELOW) return Colors.success500;
  if (ratio >= 0.65) return Colors.warning400;
  return Colors.error500;
};

/**
 * Une ligne du serveur, lue pour l ecran.
 * @param {any} row - La ligne de `GET /teams/:id/stats`.
 * @returns {any} - La ligne, avec sa part de presence (null sans appel).
 */
export const readAttendanceRow = (row) => {
  const attended = Number(row?.attendanceCount || 0);
  const pointed = attended + Number(row?.absenceCount || 0);
  return {
    attended,
    lateCount: Number(row?.lateCount ?? row?.retardCount ?? 0),
    lateMinutesTotal: Number(row?.lateMinutesTotal || 0),
    matchAttended: Number(row?.matchAttendanceCount || 0),
    matchTotal: Number(row?.matchCount || 0),
    name: `${row?.user?.firstname || ''} ${row?.user?.lastname || ''}`.trim(),
    pointed,
    ratio: pointed > 0 ? attended / pointed : null,
    recentAbsences: Array.isArray(row?.recentAbsences) ? row.recentAbsences : [],
    row,
    trainingAttended: Number(row?.trainingAttendanceCount || 0),
    trainingTotal: Number(row?.trainingCount || 0),
    user: row?.user || null,
  };
};

/**
 * « 2 oct. » ou « 1 septembre » : la date d un debut de periode.
 * @param {unknown} value - La date ISO.
 * @param {'long' | 'short'} month - Le mois en toutes lettres, ou abrege.
 * @returns {string} - La date, ou vide si elle est illisible.
 */
const formatDay = (value, month) => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeDesFormats(), { day: 'numeric', month }).format(date);
};

/**
 * L onglet « Vie d'équipe ».
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.stats] - `GET /teams/:id/stats`, tel quel.
 * @param {boolean} [props.isLoading] - La lecture est en cours.
 * @param {string} [props.refusedMessage] - Le serveur a refuse : on le dit (VA1).
 * @param {boolean} [props.sportWithoutMatchStats] - Un sport sans stats de match.
 * @param {(entry: any) => void} [props.onPressPlayer] - Ouvrir la feuille d un joueur.
 * @param {'stacked' | 'wide'} [props.variant] - `wide` : la colonne du site, avec un tableau.
 * @returns {import('react').ReactElement} - L onglet.
 */
function TeamAttendancePanel({
  isLoading = false, onPressPlayer, refusedMessage = '', sportWithoutMatchStats = false, stats, variant = 'stacked',
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const rows = (Array.isArray(stats?.data) ? stats.data : []).map(readAttendanceRow);
  const isSelfView = stats?.viewerScope === 'self';
  const average = stats?.teamAverage || {};
  const pointedTotal = rows.reduce((total, entry) => total + entry.pointed, 0);
  const teamPointed = isSelfView
    ? Number(stats?.totals?.attendanceCount || 0) + Number(stats?.totals?.absenceCount || 0)
    : pointedTotal;
  const percent = (/** @type {number | null | undefined} */ ratio) => (
    ratio === null || ratio === undefined ? '—' : `${Math.round(Number(ratio) * 100)} %`
  );
  const sinceLong = formatDay(stats?.periodStartAt, 'long');
  const resetDay = stats?.baselineAt ? formatDay(stats.baselineAt, 'short') : '';

  const gauge = (/** @type {number} */ ratio, /** @type {string} */ color) => (
    <View
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.1),
        borderRadius: 999,
        height: 6,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          backgroundColor: color,
          height: 6,
          width: `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`,
        }}
      />
    </View>
  );
  const tile = (/** @type {string} */ value, /** @type {string} */ label, /** @type {string} */ key) => (
    <View
      key={key}
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Spaces.padding[12],
        Spaces.gap[4],
        { flex: 1 },
      ]}
    >
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{value}</Text>
      <Text numberOfLines={1} style={[Fonts.p4, Fonts.primary100]}>{label}</Text>
    </View>
  );
  const sportSentence = sportWithoutMatchStats ? (
    <Text style={[Fonts.p3, Fonts.neutral300]}>
      {t(
        'teamStatsPanel.noMatchStatsSport',
        'Pour ce sport, l’app suit la présence ; les scores et stats de match couvrent le football et le basket.',
      )}
    </Text>
  ) : null;

  if (isLoading) {
    return (
      <View accessibilityState={{ busy: true }} style={[Spaces.gap[12]]} testID="team-attendance-loading">
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 16, flex: 1, height: 76,
              }}
            />
          ))}
        </View>
        <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 16, height: 160 }} />
      </View>
    );
  }

  if (refusedMessage) {
    return <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>{refusedMessage}</Text>;
  }

  // Aucun appel. Apres une remise a zero, la periode le dit ; sinon une phrase dit d ou viendra la presence.
  if (teamPointed === 0) {
    if (resetDay) {
      return (
        <View style={[Spaces.gap[16]]} testID="team-attendance-after-reset">
          {sportSentence}
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {t('teamStatsPanel.since', 'Depuis le {{date}}', { date: resetDay, ...SANS_ECHAPPEMENT })}
          </Text>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            {tile('—', t('teamStatsPanel.presence', 'Présence'), 'presence')}
            {tile('—', t('teamStatsPanel.trainings', 'Entraînements'), 'trainings')}
            {tile('—', t('teamStatsPanel.matches', 'Matchs'), 'matches')}
          </View>
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {t(
              'teamStatsPanel.afterResetBody',
              'Aucun appel depuis la remise à zéro. La présence se recalcule au prochain entraînement.',
            )}
          </Text>
        </View>
      );
    }
    return (
      <View style={[Spaces.gap[16]]}>
        {sportSentence}
        <View style={[Alignments.alignCenter, Spaces.gap[8], Spaces.paddingVertical[24]]} testID="team-attendance-empty">
          <StatsIcon color={Colors.primary200} height={40} name="users" width={40} />
          <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t('teamStatsPanel.attendanceEmptyTitle', 'Pas encore de présence')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
            {t('teamStatsPanel.attendanceEmptyBody', 'Elle se calcule à chaque appel, à l’entraînement comme au match.')}
          </Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------- LE JOUEUR
  if (isSelfView) {
    const mine = rows[0] || null;
    return (
      <View style={[Spaces.gap[16]]} testID="team-attendance-self">
        {sportSentence}
        <View
          accessibilityLabel={t('teamStatsPanel.myPresence', 'Ma présence')}
          style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16], Spaces.gap[8]]}
        >
          <Text style={[Fonts.p4Bold, Fonts.primary200]}>{t('teamStatsPanel.myPresence', 'Ma présence')}</Text>
          <Text
            style={[Fonts.h1Bold, {
              color: mine?.ratio === null || mine?.ratio === undefined
                ? Colors.neutral00
                : presenceToneOf(Colors, mine.ratio),
            }]}
          >
            {percent(mine?.ratio)}
          </Text>
          {mine ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {`${t('teamStatsPanel.eventsOutOf', '{{attended}} sur {{count}} événement', {
                attended: mine.attended,
                count: mine.pointed,
              })} · ${t('teamStatsPanel.lateCount', '{{count}} retard', { count: mine.lateCount })}`}
            </Text>
          ) : null}
          {mine?.ratio !== null && mine?.ratio !== undefined ? gauge(mine.ratio, presenceToneOf(Colors, mine.ratio)) : null}
          <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.1), height: 1, marginVertical: 4 }} />
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('teamStatsPanel.teamAverageLead', 'L’équipe :')}
            {' '}
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{percent(average?.presenceRate)}</Text>
            {` ${t('teamStatsPanel.teamAverageTail', 'en moyenne.')}`}
          </Text>
        </View>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <StatsIcon color={Colors.neutral300} height={16} name="shield" width={16} />
          <Text style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}>
            {t('teamStatsPanel.staffOnly', 'Le détail joueur par joueur est réservé à l’encadrement.')}
          </Text>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------------ L ENCADREMENT
  const sorted = rows
    .filter((entry) => entry.ratio !== null)
    .sort((left, right) => left.ratio - right.ratio || left.name.localeCompare(right.name, 'fr'));
  const toWatch = sorted.filter((entry) => entry.ratio < WATCH_BELOW);
  const others = sorted.filter((entry) => entry.ratio >= WATCH_BELOW);
  const playerRow = (/** @type {any} */ entry, /** @type {number} */ index) => {
    const tone = presenceToneOf(Colors, entry.ratio);
    const name = entry.name || t('teamStatsPanel.playerFallback', 'Joueur');
    const lateLabel = t('teamStatsPanel.lateCount', '{{count}} retard', { count: entry.lateCount });
    return (
      <TouchableOpacity
        accessibilityLabel={t('teamStatsPanel.playerRowLabel', '{{name}}, {{percent}} de présence, {{late}}', {
          late: lateLabel,
          name,
          percent: percent(entry.ratio),
          ...SANS_ECHAPPEMENT,
        })}
        accessibilityRole="button"
        disabled={!onPressPlayer}
        key={entry.user?.documentId || `presence-${index}`}
        onPress={() => onPressPlayer?.(entry)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.04),
            borderRadius: 14,
            minHeight: 56,
            paddingHorizontal: 12,
            paddingVertical: 8,
          },
        ]}
        testID={`team-attendance-player-${entry.user?.documentId || index}`}
      >
        <MemberAvatar firstname={entry.user?.firstname || name} lastname={entry.user?.lastname} size={36} />
        <View style={[Spaces.gap[4], { flex: 1, minWidth: 0 }]}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{name}</Text>
          {gauge(entry.ratio, tone)}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Fonts.p2Bold, { color: tone }]}>{percent(entry.ratio)}</Text>
          <Text style={[Fonts.p4, Fonts.neutral300]}>{lateLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ST-VUES (ordinateur, etat 1) — une colonne : les tuiles, puis un TABLEAU trie du
  // plus bas au plus haut (Presence, Entr., Matchs, Retards), et ce qu il compte.
  if (variant === 'wide') {
    const columns = [
      { flex: 2, key: 'name', label: t('teamStatsPanel.columnPlayer', 'Joueur') },
      { flex: 1, key: 'presence', label: t('teamStatsPanel.presence', 'Présence') },
      { flex: 1, key: 'trainings', label: t('teamStatsPanel.columnTrainings', 'Entr.') },
      { flex: 1, key: 'matches', label: t('teamStatsPanel.matches', 'Matchs') },
      { flex: 1, key: 'late', label: t('teamStatsPanel.columnLate', 'Retards') },
    ];
    const fraction = (/** @type {number} */ attended, /** @type {number} */ total) => (total > 0 ? `${attended}/${total}` : '—');
    return (
      <View style={[Spaces.gap[16]]} testID="team-attendance-wide">
        {sportSentence}
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{t('teamStatsPanel.attendanceTitle', 'Vie d’équipe')}</Text>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {tile(percent(average?.presenceRate), t('teamStatsPanel.presence', 'Présence'), 'presence')}
          {tile(percent(average?.trainingRate), t('teamStatsPanel.trainings', 'Entraînements'), 'trainings')}
          {tile(percent(average?.matchRate), t('teamStatsPanel.matches', 'Matchs'), 'matches')}
        </View>
        <View testID="team-attendance-table">
          <View style={[Alignments.row, Spaces.paddingVertical[8]]}>
            {columns.map((column) => (
              <Text
                key={column.key}
                style={[Fonts.p4Bold, Fonts.neutral300, { flex: column.flex, textAlign: column.key === 'name' ? 'left' : 'right' }]}
              >
                {column.label}
              </Text>
            ))}
          </View>
          {sorted.map((/** @type {any} */ entry, /** @type {number} */ index) => (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!onPressPlayer}
              key={entry.user?.documentId || `presence-${index}`}
              onPress={() => onPressPlayer?.(entry)}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.paddingVertical[8],
                { borderTopColor: withAlpha(Colors.neutral00, 0.08), borderTopWidth: 1, minHeight: 44 },
              ]}
            >
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 2 }]}>
                {entry.name || t('teamStatsPanel.playerFallback', 'Joueur')}
              </Text>
              <Text style={[Fonts.p2Bold, { color: presenceToneOf(Colors, entry.ratio), flex: 1, textAlign: 'right' }]}>
                {percent(entry.ratio)}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}>
                {fraction(entry.trainingAttended, entry.trainingTotal)}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}>
                {fraction(entry.matchAttended, entry.matchTotal)}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}>
                {String(entry.lateCount)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {sinceLong
            ? t('teamStatsPanel.sortedSince', 'Triée du plus bas au plus haut · depuis le {{date}}.', {
              date: sinceLong,
              ...SANS_ECHAPPEMENT,
            })
            : t('teamStatsPanel.sorted', 'Triée du plus bas au plus haut.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[Spaces.gap[16]]} testID="team-attendance">
      {sportSentence}
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {tile(percent(average?.presenceRate), t('teamStatsPanel.presence', 'Présence'), 'presence')}
        {tile(percent(average?.trainingRate), t('teamStatsPanel.trainings', 'Entraînements'), 'trainings')}
        {tile(percent(average?.matchRate), t('teamStatsPanel.matches', 'Matchs'), 'matches')}
      </View>

      {toWatch.length ? (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('teamStatsPanel.toWatch', 'À surveiller · {{count}}', { count: toWatch.length })}
          </Text>
          {toWatch.map(playerRow)}
        </View>
      ) : null}

      {others.length ? (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral300]}>
            {t('teamStatsPanel.others', 'Les autres · {{count}}', { count: others.length })}
          </Text>
          {others.map(playerRow)}
        </View>
      ) : null}

      {sinceLong ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('teamStatsPanel.sinceSentence', 'Depuis le {{date}}.', { date: sinceLong, ...SANS_ECHAPPEMENT })}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * ST-VUES — LA FEUILLE D UN JOUEUR (planche 14, etat 2), son haut : l identite, la
 * part de presence, les entrainements et les matchs SEPARES, les retards et leurs
 * minutes, puis les dernieres absences. Le geste « Écrire à … » reste a l ecran
 * qui ouvre la feuille.
 * @param {object} props - Les proprietes du composant.
 * @param {any} props.entry - La ligne lue par `readAttendanceRow`.
 * @param {string | null} [props.avatarUrl] - La photo du joueur.
 * @param {string | null} [props.periodStartAt] - Le debut de la periode comptee.
 * @returns {import('react').ReactElement} - Le haut de la feuille.
 */
export function TeamAttendanceSheetSummary({ avatarUrl = null, entry, periodStartAt = null }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const name = entry?.name || t('teamStatsPanel.playerFallback', 'Joueur');
  const since = formatDay(periodStartAt, 'long');
  const hasRatio = entry?.ratio !== null && entry?.ratio !== undefined;
  const ratio = (/** @type {number} */ attended, /** @type {number} */ total) => (
    total > 0 ? `${attended}/${total}` : '—'
  );
  const kindLabel = (/** @type {string} */ kind) => {
    if (kind === 'match') return t('teamStatsPanel.kindMatch', 'Match');
    if (kind === 'training') return t('teamStatsPanel.kindTraining', 'Entraînement');
    return t('teamStatsPanel.kindOther', 'Événement');
  };
  const absenceDay = (/** @type {unknown} */ value) => {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(localeDesFormats(), { day: 'numeric', month: 'short', weekday: 'short' })
      .format(date);
  };
  const tiles = [
    {
      key: 'trainings',
      label: t('teamStatsPanel.trainings', 'Entraînements'),
      value: ratio(Number(entry?.trainingAttended || 0), Number(entry?.trainingTotal || 0)),
    },
    {
      key: 'matches',
      label: t('teamStatsPanel.matches', 'Matchs'),
      value: ratio(Number(entry?.matchAttended || 0), Number(entry?.matchTotal || 0)),
    },
    {
      key: 'late',
      label: t('teamStatsPanel.lateWithMinutes', 'Retards · {{minutes}} min', {
        minutes: Number(entry?.lateMinutesTotal || 0),
      }),
      value: String(Number(entry?.lateCount || 0)),
    },
  ];
  const absences = Array.isArray(entry?.recentAbsences) ? entry.recentAbsences : [];

  return (
    <View style={[Spaces.gap[16]]} testID="team-attendance-sheet">
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <MemberAvatar
          avatarUrl={avatarUrl}
          firstname={entry?.user?.firstname || name}
          lastname={entry?.user?.lastname}
          size={40}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[Fonts.h4Bold, Fonts.neutral00]}>{name}</Text>
          {since ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('teamStatsPanel.since', 'Depuis le {{date}}', { date: since, ...SANS_ECHAPPEMENT })}
            </Text>
          ) : null}
        </View>
        <Text style={[Fonts.h3Bold, { color: hasRatio ? presenceToneOf(Colors, entry.ratio) : Colors.neutral00 }]}>
          {hasRatio ? `${Math.round(entry.ratio * 100)} %` : '—'}
        </Text>
      </View>

      <View style={[Alignments.row, Spaces.gap[8]]}>
        {tiles.map((tile) => (
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
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{tile.value}</Text>
            <Text numberOfLines={2} style={[Fonts.p4, Fonts.primary100]}>{tile.label}</Text>
          </View>
        ))}
      </View>

      {absences.length ? (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral300]}>
            {t('teamStatsPanel.recentAbsences', 'Dernières absences')}
          </Text>
          {absences.map((/** @type {any} */ absence, /** @type {number} */ index) => (
            <View
              key={absence?.documentId || `absence-${index}`}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[12],
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.04),
                  borderRadius: 14,
                  minHeight: 44,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <StatsIcon color={Colors.neutral300} height={16} name="calendar" width={16} />
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{kindLabel(absence?.kind)}</Text>
                <Text style={[Fonts.p4, Fonts.neutral300]}>{absenceDay(absence?.date)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default TeamAttendancePanel;
