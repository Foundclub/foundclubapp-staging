import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import StatsIcon from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * ST-VUES2 — « RÉSULTATS DU WEEK-END », ÉCRAN 18 DU DESIGN VALIDÉ (« Club et dirigeant »).
 *
 * Sur « Gestion du club », le score de chaque équipe du club le dernier week-end, et
 * celles où il manque. Décision d'Adel du 02/10, « score A » : le dirigeant qui
 * n'entraîne pas l'équipe ne saisit pas, il RELANCE l'entraîneur (la cloche) ; celui
 * qui l'entraîne a « Saisir ». Un week-end sans match annonce le prochain ; un club sans
 * équipe dit par où commencer. C'est le SERVEUR qui dit qui peut quoi
 * (`viewerIsTrainer`, `canRemind` : GET /cm/:cmId/weekend-results) ; la carte le dit.
 *
 * ST-VUES3-ORDI (03/10) — sur ORDINATEUR (planche P5-club-ordi, `variant="table"`), les
 * mêmes lignes en TABLEAU : Équipe, Match, Score, puis « Voir » sur un score saisi,
 * « Saisir » chez l'entraîneur, « Relancer Karim » chez le dirigeant. Le téléphone ne change pas.
 */

/**
 * @typedef {{ documentId?: string, firstname?: string | null }} WeekendTrainer
 * @typedef {{
 *   canRemind?: boolean, date?: string | null, eventId: string,
 *   opponentName?: string | null, result?: 'draw' | 'loss' | 'win' | null,
 *   scoreAgainst?: number | null, scoreFor?: number | null, sport?: string | null,
 *   status: 'missing' | 'official_pending' | 'scored' | 'upcoming', teamId: string,
 *   teamName?: string | null, trainers?: WeekendTrainer[], viewerIsTrainer?: boolean,
 * }} WeekendRow
 * @typedef {{
 *   date?: string | null, eventId?: string, opponentName?: string | null,
 *   teamName?: string | null,
 * }} WeekendNextMatch
 * @typedef {{
 *   nextMatch?: WeekendNextMatch | null, rows?: WeekendRow[], teamCount?: number,
 *   teamsWithoutMatchScores?: Array<{ sport?: string, teamId?: string, teamName?: string | null }>,
 *   weekend?: { saturday?: string, sunday?: string },
 * }} WeekendResults
 */

/**
 * La clé d'une ligne : un match, vu d'une équipe du club.
 * @param {{ eventId: string, teamId: string }} row - La ligne.
 * @returns {string} `eventId:teamId`.
 */
export const weekendRowKey = (row) => `${row.eventId}:${row.teamId}`;

/**
 * Une majuscule au début, pour un libellé de jour (« sam. » devient « Sam. »).
 * @param {string} value - Un texte.
 * @returns {string} Le même, avec une majuscule.
 */
const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * Une date du serveur, lue sans jamais lever.
 * @param {unknown} value - Une date ISO.
 * @returns {Date | null} La date, ou rien si elle est illisible.
 */
const asDate = (value) => {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date : null;
};

/**
 * Une date, à l'heure de l'appareil (comme le reste de l'app).
 * @param {Date} date - La date.
 * @param {Intl.DateTimeFormatOptions} options - Ce qu'on en montre.
 * @returns {string} Le texte.
 */
const formatDate = (date, options) => new Intl.DateTimeFormat(localeDesFormats(), options)
  .format(date);

/**
 * L'heure d'un match.
 * @param {Date} date - La date.
 * @returns {string} « 19:00 ».
 */
const formatTime = (date) => formatDate(date, { hour: '2-digit', minute: '2-digit' });

/**
 * Le jour d'un match.
 * @param {Date} date - La date.
 * @returns {string} « sam. 5 sept. ».
 */
const formatDay = (date) => formatDate(date, { day: 'numeric', month: 'short', weekday: 'short' });

/**
 * Les jours (de l'appareil) où tombent les matchs.
 * @param {WeekendRow[]} rows - Les lignes.
 * @returns {Set<string>} Un jour par clé.
 */
const daysOf = (rows) => new Set(rows.flatMap((row) => {
  const date = asDate(row.date);
  return date ? [`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`] : [];
}));

/**
 * « Sam. 5 sept. » quand tous les matchs tombent le même jour ; sinon le week-end,
 * « 26 – 27 sept. ». Les deux jours du serveur sont des dates de Paris (`AAAA-MM-JJ`) :
 * lues à midi UTC et écrites en UTC, elles ne glissent pas d'un jour.
 * @param {WeekendResults['weekend']} weekend - Le week-end du serveur.
 * @param {WeekendRow[]} rows - Les lignes.
 * @returns {string} Le libellé.
 */
export const formatWeekendLabel = (weekend, rows) => {
  const firstDate = asDate(rows[0]?.date);
  if (firstDate && daysOf(rows).size === 1) return capitalize(formatDay(firstDate));

  const saturday = asDate(`${weekend?.saturday || ''}T12:00:00.000Z`);
  const sunday = asDate(`${weekend?.sunday || ''}T12:00:00.000Z`);
  if (!saturday || !sunday) return '';
  const dayOnly = { day: 'numeric', timeZone: 'UTC' };
  const dayMonth = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const sameMonth = saturday.getUTCMonth() === sunday.getUTCMonth();
  const startOptions = /** @type {Intl.DateTimeFormatOptions} */ (sameMonth ? dayOnly : dayMonth);
  const start = formatDate(saturday, startOptions);
  return `${start} – ${formatDate(sunday, /** @type {Intl.DateTimeFormatOptions} */ (dayMonth))}`;
};

/**
 * La carte « Résultats du week-end » du dirigeant.
 * @param {object} props - Les propriétés du composant.
 * @param {WeekendResults | null} [props.data] - La réponse du serveur.
 * @param {boolean} [props.isLoading] - La lecture est en cours.
 * @param {unknown} [props.error] - La lecture a échoué.
 * @param {() => void} [props.onRetry] - Relire.
 * @param {(row: WeekendRow) => void} props.onOpenMatch - Ouvrir un match au score saisi.
 * @param {(row: WeekendRow) => void} props.onEnterScore - « Saisir » (l'entraîneur).
 * @param {(row: WeekendRow) => void} props.onRemind - « Relancer » (le dirigeant seul).
 * @param {string | null} [props.remindingKey] - La ligne dont la relance part.
 * @param {Set<string>} [props.remindedKeys] - Les lignes déjà relancées.
 * @param {{ label: string, onPress: () => void } | null} [props.emptyAction] - Le geste
 *   d'un club sans équipe.
 * @param {'stacked' | 'table'} [props.variant] - `table` : la colonne du site, en tableau.
 * @returns {import('react').ReactElement | null} La carte.
 */
function WeekendResultsCard({
  data,
  emptyAction = null,
  error = null,
  isLoading = false,
  onEnterScore,
  onOpenMatch,
  onRemind,
  onRetry,
  remindedKeys = new Set(),
  remindingKey = null,
  variant = 'stacked',
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  const cardStyle = [
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius16,
    Spaces.padding[16],
    Spaces.gap[12],
  ];

  if (isLoading) {
    return (
      <View
        accessibilityState={{ busy: true }}
        style={[cardStyle, { height: 140 }]}
        testID="cm-weekend-results-loading"
      />
    );
  }

  if (error) {
    return (
      <View style={cardStyle} testID="cm-weekend-results-error">
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('weekendResults.loadError', 'Les résultats du week-end ne se chargent pas.')}
        </Text>
        {onRetry ? (
          <Button
            onPress={onRetry}
            size="sm"
            title={t('common.actions.retry', 'Réessayer')}
            variant="SecondaryLight"
          />
        ) : null}
      </View>
    );
  }

  if (!data) return null;

  // État 4 — un club sans équipe : rien à compter encore, la carte dit par où commencer.
  if (!Number(data.teamCount || 0)) {
    return (
      <View
        style={[Alignments.alignCenter, Spaces.gap[8], Spaces.paddingVertical[16]]}
        testID="cm-weekend-results-no-team"
      >
        <StatsIcon color={Colors.primary200} height={40} name="trophy" width={40} />
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('weekendResults.noTeamTitle', 'Pas encore d’équipe')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
          {t(
            'weekendResults.noTeamBody',
            'Crée une équipe : ses résultats apparaîtront ici chaque week-end.',
          )}
        </Text>
        {emptyAction ? (
          <Button
            onPress={emptyAction.onPress}
            size="sm"
            title={emptyAction.label}
            variant="SecondaryLight"
          />
        ) : null}
      </View>
    );
  }

  const rows = Array.isArray(data.rows) ? data.rows : [];
  const spansTwoDays = daysOf(rows).size > 1;
  const isTable = variant === 'table';
  // Les lettres et les couleurs de la forme d'équipe (onglet Performance, ST-VUES).
  /** @typedef {{ background: string, color: string, label: string, letter: string }} FormLetter */
  /** @type {Record<string, FormLetter>} */
  const formLetter = {
    draw: {
      background: withAlpha(Colors.neutral00, 0.1),
      color: Colors.neutral100,
      label: t('teamStatsPanel.formDraw', 'nul'),
      letter: t('teamStatsPanel.formDrawLetter', 'N'),
    },
    loss: {
      background: withAlpha(Colors.error500, 0.18),
      color: Colors.error300,
      label: t('teamStatsPanel.formLoss', 'défaite'),
      letter: t('teamStatsPanel.formLossLetter', 'D'),
    },
    win: {
      background: withAlpha(Colors.success500, 0.18),
      color: Colors.success200,
      label: t('teamStatsPanel.formWin', 'victoire'),
      letter: t('teamStatsPanel.formWinLetter', 'V'),
    },
  };
  const unknownForm = {
    background: withAlpha(Colors.neutral00, 0.06),
    color: Colors.neutral300,
    letter: '?',
  };

  const opponentOf = (/** @type {WeekendRow} */ row) => row.opponentName
    || t('weekendResults.opponentUnknown', 'adversaire à confirmer');
  const trainerNames = (/** @type {WeekendRow} */ row) => (row.trainers || [])
    .map((trainer) => trainer?.firstname)
    .filter(Boolean)
    .join(', ');
  const whenOf = (/** @type {WeekendRow} */ row) => {
    const date = asDate(row.date);
    if (!date) return '';
    if (!spansTwoDays) return formatTime(date);
    return `${formatDate(date, { weekday: 'short' })} ${formatTime(date)}`;
  };
  const muted = (/** @type {string} */ text) => (
    <Text style={[Fonts.p3, Fonts.neutral300]}>{text}</Text>
  );

  const renderStatus = (/** @type {WeekendRow} */ row) => {
    if (row.status !== 'missing') {
      return muted([row.sport, whenOf(row)].filter(Boolean).join(' · '));
    }
    const names = trainerNames(row);
    const text = row.canRemind && names
      ? t('weekendResults.scoreToEnterBy', 'Score à saisir · {{names}}', {
        names,
        ...SANS_ECHAPPEMENT,
      })
      : t('weekendResults.scoreToEnter', 'Score à saisir');
    return <Text style={[Fonts.p3, { color: Colors.warning400 }]}>{text}</Text>;
  };

  // « U15 contre Test-COMPO : victoire 2 - 1. Ouvrir le match. »
  const openMatchLabel = (/** @type {WeekendRow} */ row) => t(
    'weekendResults.openMatchA11y',
    '{{team}} contre {{opponent}} : {{result}} {{score}}. Ouvrir le match.',
    {
      opponent: opponentOf(row),
      result: row.result ? formLetter[row.result].label : '',
      score: `${row.scoreFor} - ${row.scoreAgainst}`,
      team: row.teamName || '',
      ...SANS_ECHAPPEMENT,
    },
  );

  const renderAction = (/** @type {WeekendRow} */ row) => {
    const key = weekendRowKey(row);
    if (row.status === 'scored') {
      if (!isTable) {
        return (
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {`${row.scoreFor} - ${row.scoreAgainst}`}
          </Text>
        );
      }
      // Le tableau a sa colonne Score : la ligne se termine par « Voir » (planche ordinateur).
      if (!row.result) return null;
      return (
        <TouchableOpacity
          accessibilityLabel={openMatchLabel(row)}
          accessibilityRole="link"
          onPress={() => onOpenMatch(row)}
          style={{ justifyContent: 'center', minHeight: 40 }}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('weekendResults.see', 'Voir')}
          </Text>
        </TouchableOpacity>
      );
    }
    // Sur le tableau, « À venir » et « Score officiel attendu » sont dans la colonne Score.
    if (isTable && row.status !== 'missing') return null;
    if (row.status === 'upcoming') return muted(t('weekendResults.upcoming', 'À venir'));
    if (row.status === 'official_pending') {
      return muted(t('weekendResults.officialPending', 'Score officiel attendu'));
    }
    if (row.viewerIsTrainer) {
      return (
        <Button
          accessibilityLabel={t('weekendResults.enterScoreA11y', 'Saisir le score de {{team}}', {
            team: row.teamName || '',
            ...SANS_ECHAPPEMENT,
          })}
          onPress={() => onEnterScore(row)}
          size="sm"
          title={t('weekendResults.enterScore', 'Saisir')}
          variant="SecondaryLight"
        />
      );
    }
    if (remindedKeys.has(key)) return muted(t('weekendResults.reminded', 'Relancé'));
    if (!row.canRemind) return null;
    // Sur le tableau, la colonne Score ne nomme pas l'entraîneur : le bouton le fait
    // (« Relancer Karim », planche ordinateur).
    const names = trainerNames(row);
    return (
      <Button
        accessibilityLabel={t('weekendResults.remindA11y', 'Relancer {{names}} pour le score', {
          names,
          ...SANS_ECHAPPEMENT,
        })}
        icon="bell"
        iconPosition="before"
        isLoading={remindingKey === key}
        onPress={() => onRemind(row)}
        size="sm"
        title={isTable && names
          ? t('weekendResults.remindNamed', 'Relancer {{names}}', { names, ...SANS_ECHAPPEMENT })
          : t('weekendResults.remind', 'Relancer')}
        variant="SecondaryLight"
      />
    );
  };

  // La colonne Score du tableau : le score, ou ce qui l'attend.
  const renderScoreCell = (/** @type {WeekendRow} */ row) => {
    const cell = { flexShrink: 0, textAlign: /** @type {const} */ ('right'), width: 132 };
    if (row.status === 'scored') {
      return (
        <Text style={[Fonts.p2Bold, Fonts.neutral00, cell]}>
          {`${row.scoreFor} - ${row.scoreAgainst}`}
        </Text>
      );
    }
    if (row.status === 'missing') {
      return (
        <Text style={[Fonts.p2, { color: Colors.warning400 }, cell]}>
          {t('weekendResults.scoreToEnterShort', 'à saisir')}
        </Text>
      );
    }
    return (
      <Text style={[Fonts.p3, Fonts.neutral300, cell]}>
        {row.status === 'upcoming'
          ? t('weekendResults.upcoming', 'À venir')
          : t('weekendResults.officialPending', 'Score officiel attendu')}
      </Text>
    );
  };

  // Le Match du tableau : « contre Test-COMPO · 19:00 », ou « adversaire à confirmer · 21:00 ».
  const matchOf = (/** @type {WeekendRow} */ row) => [
    row.opponentName
      ? t('weekendResults.versus', 'contre {{opponent}}', {
        opponent: row.opponentName,
        ...SANS_ECHAPPEMENT,
      })
      : opponentOf(row),
    whenOf(row),
  ].filter(Boolean).join(' · ');

  const renderFormChip = (/** @type {WeekendRow} */ row) => {
    const form = row.status === 'scored' && row.result ? formLetter[row.result] : unknownForm;
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: form.background,
          borderRadius: 6,
          height: 24,
          justifyContent: 'center',
          width: 24,
        }}
      >
        <Text style={[Fonts.p4Bold, { color: form.color }]}>{form.letter}</Text>
      </View>
    );
  };

  const tableLine = [
    Alignments.row,
    Alignments.alignCenter,
    Spaces.gap[12],
    { paddingHorizontal: 4 },
  ];
  const columnTeam = { flex: 1, minWidth: 0 };
  const columnMatch = { flex: 2, minWidth: 0 };
  const columnAction = { alignItems: /** @type {const} */ ('flex-end'), flexShrink: 0, width: 156 };

  const renderTableHead = () => {
    const head = [
      Fonts.p4Bold,
      Fonts.neutral300,
      { letterSpacing: 1, textTransform: /** @type {const} */ ('uppercase') },
    ];
    return (
      <View
        style={[
          tableLine,
          {
            borderBottomColor: withAlpha(Colors.neutral00, 0.12),
            borderBottomWidth: 1,
            paddingVertical: 8,
          },
        ]}
      >
        <View style={{ width: 24 }} />
        <Text style={[head, columnTeam]}>{t('weekendResults.columnTeam', 'Équipe')}</Text>
        <Text style={[head, columnMatch]}>{t('weekendResults.columnMatch', 'Match')}</Text>
        <Text style={[head, { flexShrink: 0, textAlign: 'right', width: 132 }]}>
          {t('weekendResults.columnScore', 'Score')}
        </Text>
        <View style={columnAction} />
      </View>
    );
  };

  const renderTableRow = (/** @type {WeekendRow} */ row, /** @type {number} */ index) => (
    <View
      key={weekendRowKey(row)}
      style={[
        tableLine,
        {
          borderTopColor: withAlpha(Colors.neutral00, 0.07),
          borderTopWidth: index === 0 ? 0 : 1,
          minHeight: 52,
          paddingVertical: 6,
        },
      ]}
    >
      {renderFormChip(row)}
      <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, columnTeam]}>
        {row.teamName || ''}
      </Text>
      <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral100, columnMatch]}>
        {matchOf(row)}
      </Text>
      {renderScoreCell(row)}
      <View style={columnAction}>{renderAction(row)}</View>
    </View>
  );

  const renderRow = (/** @type {WeekendRow} */ row, /** @type {number} */ index) => {
    const content = (
      <>
        {renderFormChip(row)}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
            {`${row.teamName || ''} — ${opponentOf(row)}`}
          </Text>
          {renderStatus(row)}
        </View>
        {renderAction(row)}
      </>
    );
    const rowStyle = [
      Alignments.row,
      Alignments.alignCenter,
      Spaces.gap[12],
      {
        borderTopColor: withAlpha(Colors.neutral00, 0.08),
        borderTopWidth: index === 0 ? 0 : 1,
        minHeight: 56,
        paddingVertical: 8,
      },
    ];

    // Un score saisi se touche : il ouvre le match (planche, état 1).
    if (row.status === 'scored' && row.result) {
      return (
        <TouchableOpacity
          accessibilityLabel={openMatchLabel(row)}
          accessibilityRole="button"
          key={weekendRowKey(row)}
          onPress={() => onOpenMatch(row)}
          style={rowStyle}
        >
          {content}
        </TouchableOpacity>
      );
    }
    return <View key={weekendRowKey(row)} style={rowStyle}>{content}</View>;
  };

  const next = data.nextMatch;
  const nextDate = asDate(next?.date);
  const nextValues = nextDate ? {
    day: formatDay(nextDate),
    opponent: next?.opponentName || '',
    team: next?.teamName || '',
    time: formatTime(nextDate),
    ...SANS_ECHAPPEMENT,
  } : null;
  const withoutScores = (data.teamsWithoutMatchScores || [])
    .map((team) => `${team.teamName || ''} (${String(team.sport || '').toLowerCase()})`)
    .join(', ');

  return (
    <View style={cardStyle} testID="cm-weekend-results">
      <View
        style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween, Spaces.gap[8]]}
      >
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flexShrink: 1 }]}>
          {t('weekendResults.title', 'Résultats du week-end')}
        </Text>
        {muted(formatWeekendLabel(data.weekend, rows))}
      </View>

      {rows.length && isTable ? (
        <View>
          {renderTableHead()}
          {rows.map(renderTableRow)}
        </View>
      ) : null}
      {rows.length && !isTable ? (
        <View>{rows.map(renderRow)}</View>
      ) : null}
      {rows.length ? null : (
        // État 3 — un week-end sans match le dit et annonce le prochain, au lieu de disparaître.
        <View style={Spaces.gap[4]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('weekendResults.noMatch', 'Aucun match ce week-end.')}
          </Text>
          {nextValues && next?.opponentName ? muted(t(
            'weekendResults.next',
            'Prochain : {{day}} à {{time}}, {{team}} contre {{opponent}}.',
            nextValues,
          )) : null}
          {nextValues && !next?.opponentName ? muted(t(
            'weekendResults.nextNoOpponent',
            'Prochain : {{day}} à {{time}}, {{team}}.',
            nextValues,
          )) : null}
        </View>
      )}

      {rows.length && withoutScores ? muted(t(
        'weekendResults.noScoreSports',
        'Les {{teams}} n’ont pas de score de match.',
        { teams: withoutScores, ...SANS_ECHAPPEMENT },
      )) : null}
    </View>
  );
}

export default WeekendResultsCard;
