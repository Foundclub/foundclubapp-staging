import { StyleSheet, Text, View } from 'react-native';

import LeagueCard from '@/components/atoms/league/LeagueCard';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import useTheme from '@/theme/themeContext';

/**
 * Hero component for League Dashboard.
 * @param {object} props
 * @param {number} [props.elo]
 * @param {number|string} [props.division]
 * @param {number|string} [props.rank]
 * @param {string} [props.teamName]
 * @param {number} [props.nextDivisionElo]
 * @returns {import('react').ReactElement}
 */
const CompetitiveHero = ({
  elo = 1200,
  division = 10,
  rank = '-',
  teamName,
  nextDivisionElo = 1300,
}) => {
  const { Colors, Fonts } = useTheme();

  const range = 200;
  const minElo = nextDivisionElo - range;
  const progress = Math.min(Math.max(((elo - minElo) / range) * 100, 0), 100);

  return (
    <LeagueCard
      isGold
      style={[
        styles.container,
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.gold500,
        },
      ]}
    >
      <View style={styles.centered}>
        <View style={styles.divisionBadgeWrap}>
          <DivisionBadge division={division} size={72} />
        </View>

        <View style={[styles.centered, { marginVertical: 12 }]}>
          <Text style={[Fonts.h1Bold, { color: Colors.neutral00, fontSize: 48, lineHeight: 56 }]}>
            {elo}
          </Text>
          <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
            POINTS ELO
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.rowBetween}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Niveau actuel</Text>
            <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
              {nextDivisionElo} PTS{' '}
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                (PROMOTION)
              </Text>
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: Colors.neutral700 }]}>
            <View style={[styles.bar, { width: `${progress}%`, backgroundColor: Colors.gold500 }]} />
          </View>
          <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4, textAlign: 'center' }]}>
            <Text style={{ color: Colors.gold500 }}>{Math.max(nextDivisionElo - elo, 0)}</Text>{' '}
            points pour la promotion
          </Text>
        </View>

        <View style={[styles.rowBetween, { marginTop: 16 }]}>
          <View>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>SQUAD</Text>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{teamName || 'Mon equipe'}</Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>RANK</Text>
            <Text style={[Fonts.h4, { color: Colors.gold500 }]}>#{rank}</Text>
          </View>
        </View>
      </View>
    </LeagueCard>
  );
};

const styles = StyleSheet.create({
  alignEnd: {
    alignItems: 'flex-end',
  },
  bar: {
    borderRadius: 3,
    height: '100%',
  },
  centered: {
    alignItems: 'center',
  },
  container: {
    paddingVertical: 24,
  },
  divisionBadgeWrap: {
    marginBottom: 4,
  },
  progressContainer: {
    marginTop: 8,
    width: '100%',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  track: {
    borderRadius: 3,
    height: 6,
    marginTop: 6,
    overflow: 'hidden',
    width: '100%',
  },
});

export default CompetitiveHero;
