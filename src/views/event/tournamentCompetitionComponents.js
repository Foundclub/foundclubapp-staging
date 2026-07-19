import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  formatTournamentScore,
  getTournamentMatchStatusMeta,
} from './tournamentUtils';

const formatMatchWindow = (scheduledAt, endAt) => {
  if (!scheduledAt) return 'Horaire à définir';
  try {
    const startDate = new Date(scheduledAt);
    const startLabel = format(startDate, 'EEE d MMM - HH:mm', { locale: fr });
    if (!endAt) return startLabel;
    return `${startLabel} - ${format(new Date(endAt), 'HH:mm')}`;
  } catch {
    return 'Horaire à définir';
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
            {match?.roundLabel || match?.group?.label || 'Match tournoi'}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {match?.group?.label ? `Poule ${match.group.label}` : 'Phase finale'}
          </Text>
        </View>
        <TournamentPhaseChip label={statusMeta.label} tone={statusMeta.tone} />
      </View>

      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {match?.teamA?.name || 'Équipe A'}
        </Text>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {match?.teamB?.name || 'Équipe B'}
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
        <Text style={[Fonts.p3, Fonts.neutral200]}>Aucun classement calcule pour le moment.</Text>
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
            {standing?.label ? `Poule ${standing.label}` : 'Classement'}
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
            <StandingCell flex={2.8} text="Equipe" textStyle={Fonts.neutral200} />
            <StandingCell text="PJ" textStyle={Fonts.neutral200} />
            <StandingCell text="V" textStyle={Fonts.neutral200} />
            <StandingCell text="N" textStyle={Fonts.neutral200} />
            <StandingCell text="D" textStyle={Fonts.neutral200} />
            <StandingCell text="Diff" textStyle={Fonts.neutral200} />
            <StandingCell text="Pts" textStyle={Fonts.neutral200} />
          </View>

          {(standing?.rows || []).map((row) => (
            <View
              key={`${standing?.documentId || standing?.label}-${row?.teamDocumentId}`}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <StandingCell flex={0.8} text={row?.rank || '-'} textStyle={Fonts.primary500} />
              <StandingCell flex={2.8} text={row?.teamName || 'Equipe'} textStyle={Fonts.neutral00} />
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
        <Text style={[Fonts.p3, Fonts.neutral200]}>Aucun tableau final génère pour le moment.</Text>
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
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{round?.label || 'Tour'}</Text>
            {(round?.matches || []).map((match) => (
              <View
                key={match?.documentId}
                style={tournamentDs.styles.insetPanelCard}
              >
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                  {match?.teamA?.name || match?.sourceMatchA ? 'Qualifié A' : 'A définir'}
                </Text>
                <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                  {match?.teamB?.name || match?.sourceMatchB ? 'Qualifié B' : 'A définir'}
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
                    title="Voir le match"
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
        <Text style={[Fonts.p3, Fonts.neutral200]}>Aucune poule n à encore été tirée.</Text>
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
              {group?.label ? `Poule ${group.label}` : 'Poule'}
            </Text>
            {(rows.length > 0 ? rows : (group?.entries || [])).map((item, index) => (
              <View
                key={item?.teamDocumentId || item?.documentId || `${group?.documentId}-${index}`}
                style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  {rows.length > 0 ? `${item?.rank || index + 1}. ${item?.teamName || 'Equipe'}` : `${index + 1}. ${item?.tournamentTeam?.name || 'Equipe'}`}
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
