import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import StatsIcon from '@/components/atoms/SvgIcon/SvgIcon';
import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';
import TeamRecordTiles from '@/views/team/performance/TeamRecordTiles';

/**
 * ST-VUES — L ONGLET « PERFORMANCE » DE L EQUIPE, planche 13 du design valide
 * (« FoundClub — Statistiques », page 5, 02/10).
 *
 * Les blocs, DANS CET ORDRE :
 *   1. « Saison · N matchs » et la FORME (les 5 derniers V / N / D) ;
 *   2. les trois tuiles Victoires / Nuls / Defaites ;
 *   3. « Buts marques · encaisses · difference » (points au basket) ;
 *   4. la note du coach et la note des joueurs ;
 *   5. « Joueurs », trie par buts, passes ou minutes.
 *
 * ⛔ RETIRE (notes « retire » de la planche) : la carte « Performance equipe ·
 * Recap du groupe », « d apres 1 retour post-match » (dit par « Note des
 * joueurs · 1 »), « 0 clean sheets - 1 buts encaisses » (dans la ligne des buts).
 *
 * 🔒 « moyenne B » (decision d Adel du 02/10) : chez le joueur, le serveur masque
 * la moyenne des notes des joueurs sous 3 reponses (`playerCollectiveRatingHidden`) ;
 * la tuile dit alors « Joueurs : des 3 reponses ». Ce composant ne decide rien :
 * il lit ce que le serveur rend.
 *
 * Purement presentationnel : aucune requete, aucun service.
 */

/** Les trois tris du classement, par sport : la cle du chiffre, et son libelle. */
const SORTS_BY_SPORT = {
  basketball: [
    { fallback: 'Points', key: 'points', labelKey: 'teamStatsPanel.sortPoints' },
    { fallback: 'Passes', key: 'assists', labelKey: 'teamStatsPanel.sortAssists' },
    { fallback: 'Min', key: 'minutesPlayed', labelKey: 'teamStatsPanel.sortMinutes' },
  ],
  football: [
    { fallback: 'Buts', key: 'goals', labelKey: 'teamStatsPanel.sortGoals' },
    { fallback: 'Passes', key: 'assists', labelKey: 'teamStatsPanel.sortAssists' },
    { fallback: 'Min', key: 'minutesPlayed', labelKey: 'teamStatsPanel.sortMinutes' },
  ],
};

/**
 * Le nom affiche d une ligne du classement.
 * @param {any} entry - La ligne servie par le serveur.
 * @returns {string} - « Prenom Nom », ou le nom saisi a la main.
 */
const playerNameOf = (entry) => (
  `${entry?.firstname || ''} ${entry?.lastname || ''}`.trim()
  || String(entry?.manualPlayerName || '').trim()
);

/**
 * La carte « Performance » de l onglet Stats de l equipe.
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.stats] - `GET /teams/:id/performance-stats`, tel quel.
 * @param {boolean} [props.isLoading] - La lecture est en cours.
 * @param {string} [props.currentUserDocumentId] - Qui regarde, pour ecrire « toi ».
 * @param {(player: { documentId: string }) => void} [props.onPressPlayer] - Ouvrir un joueur.
 *   Absent : les lignes ne se touchent pas (le joueur lit sans ouvrir ses coequipiers).
 * @returns {import('react').ReactElement} - La carte.
 */
function TeamPerformancePanel({
  currentUserDocumentId = '', isLoading = false, onPressPlayer, stats,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const sport = stats?.sport === 'basketball' ? 'basketball' : 'football';
  const sorts = SORTS_BY_SPORT[sport];
  const [sortKey, setSortKey] = useState(sorts[0].key);
  const activeSort = sorts.find((sort) => sort.key === sortKey) || sorts[0];

  const totals = stats?.totals || {};
  const matches = Number(totals?.matches ?? totals?.matchesPlayed ?? 0);
  const form = Array.isArray(stats?.form) ? stats.form : [];
  const players = useMemo(() => {
    const list = Array.isArray(stats?.players) ? stats.players : [];
    return [...list].sort((left, right) => (
      Number(right?.[activeSort.key] || 0) - Number(left?.[activeSort.key] || 0)
      || playerNameOf(left).localeCompare(playerNameOf(right), 'fr')
    ));
  }, [activeSort.key, stats?.players]);

  const rowBetween = [
    Alignments.row,
    Alignments.alignCenter,
    Alignments.justifyBetween,
    Spaces.gap[8],
  ];
  const tileStyle = [
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius16,
    Spaces.padding[12],
    Spaces.gap[4],
    { flex: 1 },
  ];
  const skeleton = (/** @type {number} */ height, /** @type {any} */ extra = {}) => ({
    backgroundColor: withAlpha(Colors.neutral00, 0.06),
    borderRadius: 16,
    height,
    ...extra,
  });

  if (isLoading) {
    return (
      <View
        accessibilityState={{ busy: true }}
        style={[Spaces.gap[12]]}
        testID="team-performance-loading"
      >
        <View style={skeleton(22, { borderRadius: 8, width: '50%' })} />
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {[0, 1, 2].map((index) => <View key={index} style={skeleton(76, { flex: 1 })} />)}
        </View>
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {[0, 1].map((index) => <View key={index} style={skeleton(76, { flex: 1 })} />)}
        </View>
        <View style={skeleton(160)} />
      </View>
    );
  }

  if (matches === 0 && players.length === 0) {
    return (
      <View
        style={[Alignments.alignCenter, Spaces.gap[8], Spaces.paddingVertical[24]]}
        testID="team-performance-empty"
      >
        <StatsIcon color={Colors.primary200} height={40} name="trophy" width={40} />
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
          {t('teamStatsPanel.emptyTitle', 'Pas encore de résultat')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
          {t(
            'teamStatsPanel.emptyBody',
            'Le bilan se remplit dès que l’entraîneur saisit le score d’un match terminé.',
          )}
        </Text>
      </View>
    );
  }

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
  const knownForm = form.filter((/** @type {string} */ result) => formLetter[result]);

  const scoreFor = Number(totals?.scoreForTotal || 0);
  const scoreAgainst = Number(totals?.scoreAgainstTotal || 0);
  const difference = scoreFor - scoreAgainst;
  const differenceLabel = difference > 0 ? `+${difference}` : String(difference);

  const formatRating = (/** @type {unknown} */ value) => `${Number(value).toLocaleString(
    localeDesFormats(),
    { maximumFractionDigits: 1 },
  )}/10`;
  const coachRating = totals?.averageCollectiveRating;
  const playersRating = totals?.playerCollectiveRatingAverage;
  const playersRatingCount = Number(totals?.playerCollectiveRatingCount || 0);
  const playersRatingLabel = () => {
    if (totals?.playerCollectiveRatingHidden) {
      return t('teamStatsPanel.playersRatingHidden', 'Joueurs : dès 3 réponses');
    }
    if (playersRatingCount > 0) {
      return t(
        'teamStatsPanel.playersRatingCount',
        'Note des joueurs · {{count}}',
        { count: playersRatingCount },
      );
    }
    return t('teamStatsPanel.playersRating', 'Note des joueurs');
  };

  return (
    <View style={[Spaces.gap[16]]} testID="team-performance">
      <View style={rowBetween}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('teamStatsPanel.season', 'Saison · {{count}} match', { count: matches })}
        </Text>
        {knownForm.length ? (
          <View
            accessibilityLabel={t('teamStatsPanel.formLabel', 'Forme : {{results}}', {
              results: knownForm
                .map((/** @type {string} */ result) => formLetter[result].label)
                .join(', '),
            })}
            accessible
            style={[Alignments.row, Spaces.gap[4]]}
            testID="team-performance-form"
          >
            {knownForm.map((/** @type {string} */ result, /** @type {number} */ index) => (
              <View
                // L ordre EST l information : la position sert de cle.
                // eslint-disable-next-line react/no-array-index-key
                key={`${result}-${index}`}
                style={{
                  alignItems: 'center',
                  backgroundColor: formLetter[result].background,
                  borderRadius: 6,
                  height: 24,
                  justifyContent: 'center',
                  width: 24,
                }}
              >
                <Text style={[Fonts.p4Bold, { color: formLetter[result].color }]}>
                  {formLetter[result].letter}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <TeamRecordTiles totals={totals} />

      <Text style={[Fonts.p2, Fonts.neutral200]} testID="team-performance-goals">
        {sport === 'basketball'
          ? t('teamStatsPanel.pointsScored', 'Points marqués')
          : t('teamStatsPanel.goalsScored', 'Buts marqués')}
        {' '}
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{scoreFor}</Text>
        {` · ${t('teamStatsPanel.conceded', 'encaissés')} `}
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{scoreAgainst}</Text>
        {` · ${t('teamStatsPanel.difference', 'différence')} `}
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{differenceLabel}</Text>
      </Text>

      <View style={[Alignments.row, Spaces.gap[8]]}>
        <View style={tileStyle}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {coachRating !== null && coachRating !== undefined ? formatRating(coachRating) : '—'}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p4, Fonts.primary100]}>
            {t('teamStatsPanel.coachRating', 'Note du coach')}
          </Text>
        </View>
        <View style={tileStyle} testID="team-performance-players-rating">
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {playersRating !== null && playersRating !== undefined
              ? formatRating(playersRating)
              : '—'}
          </Text>
          <Text numberOfLines={2} style={[Fonts.p4, Fonts.primary100]}>{playersRatingLabel()}</Text>
        </View>
      </View>

      {players.length ? (
        <View style={[Spaces.gap[8]]}>
          <View style={rowBetween}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('teamStatsPanel.playersTitle', 'Joueurs')}
            </Text>
            <View
              accessibilityLabel={t('teamStatsPanel.sortLabel', 'Trier par')}
              style={[
                Alignments.row,
                {
                  backgroundColor: withAlpha(Colors.neutral00, 0.06),
                  borderRadius: 999,
                  padding: 3,
                },
              ]}
            >
              {sorts.map((sort) => {
                const selected = sort.key === activeSort.key;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={sort.key}
                    onPress={() => setSortKey(sort.key)}
                    style={{
                      backgroundColor: selected ? Colors.primary500 : 'transparent',
                      borderRadius: 999,
                      justifyContent: 'center',
                      minHeight: 32,
                      paddingHorizontal: 12,
                    }}
                    testID={`team-performance-sort-${sort.key}`}
                  >
                    <Text style={[selected ? Fonts.p4Bold : Fonts.p4, Fonts.neutral00]}>
                      {t(sort.labelKey, sort.fallback)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {players.map((/** @type {any} */ entry, /** @type {number} */ index) => {
            const documentId = String(entry?.documentId || '');
            const isMe = Boolean(documentId) && documentId === currentUserDocumentId;
            const name = playerNameOf(entry) || t('teamStatsPanel.playerFallback', 'Joueur');
            const minutes = Number(entry?.minutesPlayed || 0);
            const assists = Number(entry?.assists || 0);
            const canOpen = Boolean(onPressPlayer && documentId && !isMe);
            const Row = canOpen ? TouchableOpacity : View;
            return (
              <Row
                accessibilityRole={canOpen ? 'button' : undefined}
                key={entry?.key || documentId || `joueur-${index}`}
                onPress={canOpen ? () => onPressPlayer?.({ documentId }) : undefined}
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
                testID={`team-performance-player-${documentId || index}`}
              >
                <MemberAvatar
                  firstname={entry?.firstname || name}
                  lastname={entry?.lastname}
                  size={36}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {isMe
                      ? t('teamStatsPanel.playerIsMe', '{{name}} · toi', {
                        name,
                        ...SANS_ECHAPPEMENT,
                      })
                      : name}
                  </Text>
                  <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300]}>
                    {`${t('teamStatsPanel.minutes', '{{count}} min', { count: minutes })} · ${t(
                      'teamStatsPanel.assists',
                      '{{count}} passe',
                      { count: assists },
                    )}`}
                  </Text>
                </View>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                  {Number(entry?.[activeSort.key] || 0)}
                </Text>
              </Row>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default TeamPerformancePanel;
