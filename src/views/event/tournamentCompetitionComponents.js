import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  formatTournamentScore,
  getTournamentMatchStatusMeta,
} from './tournamentUtils';

const formatMatchWindow = (scheduledAt, endAt) => {
  if (!scheduledAt) {
    return i18next.t(
      'tournamentCompetitionComponents.timeToBeSet',
      'Horaire à définir',
    );
  }
  try {
    const startDate = new Date(scheduledAt);
    const startLabel = format(startDate, 'EEE d MMM - HH:mm', { locale: fr });
    if (!endAt) return startLabel;
    return `${startLabel} - ${format(new Date(endAt), 'HH:mm')}`;
  } catch {
    return i18next.t('tournamentCompetitionComponents.timeToBeSet', 'Horaire à définir');
  }
};

/**
 *
 * @param root0
 * @param root0.flex
 * @param root0.text
 * @param root0.textStyle
 */
function StandingCell({ flex = 1, text, textStyle }) {
  const { Fonts, Spaces } = useTheme();
  return (
    <View style={{ flex }}>
      <Text numberOfLines={1} style={[Fonts.p4, Spaces.paddingVertical[4], textStyle]}>
        {text}
      </Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.tone
 */
export function TournamentPhaseChip({ label, tone }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  return (
    <Tag
      style={tournamentDs.getToneTagStyle(tone)}
      text={label}
      textColor="neutral00"
      textStyle={{ color: tone }}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.ctaLabel
 * @param root0.match
 * @param root0.onPress
 */
export function TournamentMatchCard({
  ctaLabel = 'Ouvrir',
  match,
  onPress,
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const statusMeta = getTournamentMatchStatusMeta(match?.status, Colors);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={tournamentDs.styles.compactPanelCard}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>
            {match?.roundLabel || match?.group?.label || t(
              'tournamentCompetitionComponents.tournamentMatch',
              'Match tournoi',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {match?.group?.label
              ? t('tournamentCompetitionComponents.groupLabel', 'Poule {{label}}', {
                label: match.group.label,
                ...SANS_ECHAPPEMENT,
              })
              : t('tournamentCompetitionComponents.knockoutStage', 'Phase finale')}
          </Text>
        </View>
        <TournamentPhaseChip label={statusMeta.label} tone={statusMeta.tone} />
      </View>

      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {match?.teamA?.name || t('tournamentCompetitionComponents.teamA', 'Équipe A')}
        </Text>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {match?.teamB?.name || t('tournamentCompetitionComponents.teamB', 'Équipe B')}
        </Text>
      </View>

      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <Text style={[Fonts.h4Bold, Fonts.primary500]}>
          {formatTournamentScore(match)}
        </Text>
        <Text style={[Fonts.p4, Fonts.neutral200]}>
          {formatMatchWindow(match?.scheduledAt, match?.endAt)}
        </Text>
      </View>

      {match?.facility?.name ? (
        <Text style={[Fonts.p4, Fonts.neutral200]}>
          {`Installation: ${match.facility.name}`}
        </Text>
      ) : null}

      {onPress ? (
        <Button
          onPress={onPress}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={ctaLabel}
          variant="Secondary"
        />
      ) : null}
    </TouchableOpacity>
  );
}

/**
 *
 * @param root0
 * @param root0.standings
 */
export function TournamentStandingsTable({ standings = [] }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  if (!Array.isArray(standings) || standings.length === 0) {
    return (
      <View style={tournamentDs.styles.compactPanelCard}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'tournamentCompetitionComponents.noStandingsComputedYet',
            'Aucun classement calcule pour le moment.',
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={Spaces.gap[12]}>
      {standings.map((standing) => (
        <View
          key={standing?.documentId || standing?.label}
          style={tournamentDs.styles.panelCard}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {standing?.label
              ? t('tournamentCompetitionComponents.groupLabel', 'Poule {{label}}', {
                label: standing.label,
                ...SANS_ECHAPPEMENT,
              })
              : t('tournamentCompetitionComponents.standings', 'Classement')}
          </Text>

          <View
            style={[
              Spaces.paddingBottom[8],
              {
                borderBottomColor: tournamentDs.colors.borderSoft,
                borderBottomWidth: 1,
                flexDirection: 'row',
                gap: 8,
              },
            ]}
          >
            <StandingCell flex={0.8} text="#" textStyle={Fonts.neutral200} />
            <StandingCell
              flex={2.8}
              text={t(
                'tournamentCompetitionComponents.teamFallback',
                'Equipe',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell
              text={t(
                'tournamentCompetitionComponents.p',
                'PJ',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell
              text={t(
                'tournamentCompetitionComponents.winShort',
                'V',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell
              text={t(
                'tournamentCompetitionComponents.drawShort',
                'N',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell
              text={t(
                'tournamentCompetitionComponents.lossShort',
                'D',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell
              text={t(
                'tournamentCompetitionComponents.gd',
                'Diff',
              )}
              textStyle={Fonts.neutral200}
            />
            <StandingCell text="Pts" textStyle={Fonts.neutral200} />
          </View>

          {(standing?.rows || []).map((row) => (
            <View
              key={`${standing?.documentId || standing?.label}-${row?.teamDocumentId}`}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <StandingCell flex={0.8} text={row?.rank || '-'} textStyle={Fonts.primary500} />
              <StandingCell flex={2.8} text={row?.teamName || t('tournamentCompetitionComponents.teamFallback', 'Equipe')} textStyle={Fonts.neutral00} />
              <StandingCell text={row?.matchesPlayed || 0} textStyle={Fonts.neutral100} />
              <StandingCell text={row?.wins || 0} textStyle={Fonts.neutral100} />
              <StandingCell text={row?.draws || 0} textStyle={Fonts.neutral100} />
              <StandingCell text={row?.losses || 0} textStyle={Fonts.neutral100} />
              <StandingCell text={row?.goalDifference || 0} textStyle={Fonts.neutral100} />
              <StandingCell text={row?.points || 0} textStyle={Fonts.p4Bold} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.bracket
 * @param root0.onMatchPress
 */
export function TournamentBracketBoard({ bracket = [], onMatchPress }) {
  const { t } = useTranslation();
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  if (!Array.isArray(bracket) || bracket.length === 0) {
    return (
      <View style={tournamentDs.styles.compactPanelCard}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'tournamentCompetitionComponents.noKnockoutBracketGeneratedYet',
            'Aucun tableau final génère pour le moment.',
          )}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[{ flexDirection: 'row' }, Spaces.gap[12], Spaces.paddingBottom[4]]}>
        {bracket.map((round) => (
          <View
            key={`${round?.roundOrder || 0}-${round?.label || 'round'}`}
            style={[
              ...tournamentDs.styles.panelCard,
              {
                minWidth: 248,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {round?.label || t(
                'tournamentCompetitionComponents.round',
                'Tour',
              )}
            </Text>
            {(round?.matches || []).map((match) => (
              <View
                key={match?.documentId}
                style={tournamentDs.styles.insetPanelCard}
              >
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                  {match?.teamA?.name || match?.sourceMatchA ? t(
                    'tournamentCompetitionComponents.qualifiedA',
                    'Qualifié A',
                  ) : t(
                    'tournamentCompetitionComponents.toBeDecided',
                    'A définir',
                  )}
                </Text>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                  {match?.teamB?.name || match?.sourceMatchB ? t(
                    'tournamentCompetitionComponents.qualifiedB',
                    'Qualifié B',
                  ) : t(
                    'tournamentCompetitionComponents.toBeDecided',
                    'A définir',
                  )}
                </Text>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{formatTournamentScore(match)}</Text>
                <Text style={[Fonts.p4, Fonts.neutral200]}>
                  {getTournamentMatchStatusMeta(match?.status, Colors).label}
                </Text>
                {onMatchPress ? (
                  <Button
                    onPress={() => onMatchPress(match)}
                    size="sm"
                    style={{ alignSelf: 'flex-start' }}
                    title={t('tournamentCompetitionComponents.seeTheMatch', 'Voir le match')}
                    variant="Secondary"
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 *
 * @param root0
 * @param root0.groups
 * @param root0.onGroupPress
 * @param root0.standings
 */
export function TournamentGroupCards({ groups = [], onGroupPress = null, standings = [] }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });

  if (!Array.isArray(groups) || groups.length === 0) {
    return (
      <View style={tournamentDs.styles.compactPanelCard}>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'tournamentCompetitionComponents.noGroupHasBeenDrawn',
            'Aucune poule n à encore été tirée.',
          )}
        </Text>
      </View>
    );
  }

  const standingsByGroupId = new Map(
    (Array.isArray(standings) ? standings : []).map((standing) => [standing?.documentId, standing]),
  );

  return (
    <View style={Spaces.gap[12]}>
      {groups.map((group) => {
        const rows = standingsByGroupId.get(group?.documentId)?.rows || [];
        return (
          <TouchableOpacity
            activeOpacity={onGroupPress ? 0.85 : 1}
            disabled={!onGroupPress}
            key={group?.documentId || group?.label}
            onPress={() => onGroupPress?.(group)}
            style={tournamentDs.styles.compactPanelCard}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {group?.label
                ? t('tournamentCompetitionComponents.groupLabel', 'Poule {{label}}', {
                  label: group.label,
                  ...SANS_ECHAPPEMENT,
                })
                : t('tournamentCompetitionComponents.group', 'Poule')}
            </Text>
            {(rows.length > 0 ? rows : (group?.entries || [])).map((item, index) => (
              <View
                key={item?.teamDocumentId || item?.documentId || `${group?.documentId}-${index}`}
                style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  {rows.length > 0 ? `${item?.rank || index + 1}. ${item?.teamName || t('tournamentCompetitionComponents.teamFallback', 'Equipe')}` : `${index + 1}. ${item?.tournamentTeam?.name || t('tournamentCompetitionComponents.teamFallback', 'Equipe')}`}
                </Text>
                {rows.length > 0 ? (
                  <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                    {`${item?.points || 0} pts`}
                  </Text>
                ) : null}
              </View>
            ))}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
