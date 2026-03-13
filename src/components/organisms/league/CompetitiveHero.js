import {
  Image, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import LeagueCard from '@/components/atoms/league/LeagueCard';

import { clampLeagueDivision, getNextDivisionTargetElo, isMaxDivision } from '@/utils/league/division';

/**
 * Hero component for League Dashboard.
 * @param {object} props
 * @param {number} [props.elo]
 * @param {number|string} [props.division]
 * @param {number|string} [props.rank]
 * @param {string} [props.teamName]
 * @param {number | null} [props.nextDivisionElo]
 * @returns {import('react').ReactElement}
 */
function CompetitiveHero({
  division = 5,
  elo = 1200,
  nextDivisionElo = null,
  rank = '-',
  teamName,
}) {
  const { Colors, Fonts, Images } = useTheme();
  const heroSurfaceColor = 'rgba(1, 36, 52, 0.92)';
  const heroBorderColor = 'rgba(255, 215, 0, 0.78)';
  const progressTrackColor = 'rgba(173, 177, 178, 0.26)';

  const normalizedDivision = clampLeagueDivision(division);
  const targetElo = Number.isFinite(Number(nextDivisionElo))
    ? Number(nextDivisionElo)
    : getNextDivisionTargetElo(normalizedDivision);
  const maxDivisionReached = isMaxDivision(normalizedDivision);
  const range = 200;
  const minElo = Number.isFinite(targetElo) ? targetElo - range : elo;
  const progress = Number.isFinite(targetElo)
    ? Math.min(Math.max(((elo - minElo) / range) * 100, 0), 100)
    : 100;

  return (
    <LeagueCard
      isGold
      style={[
        styles.container,
        {
          backgroundColor: heroSurfaceColor,
          borderColor: heroBorderColor,
        },
      ]}
    >
      <View style={styles.centered}>
        <View style={styles.divisionBadgeWrap}>
          <DivisionBadge
            division={normalizedDivision}
            logoScale={1.4}
            showChrome={false}
            showLabel={false}
            size={124}
          />
        </View>

        <View style={styles.brandMarkWrap}>
          <Image source={Images.logo} style={styles.brandLogo} />
          <View style={styles.brandGap} />
          <Text style={[Fonts.h3Bold, { color: Colors.gold500 }, styles.brandLeague]}>
            LEAGUE
          </Text>
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
            {maxDivisionReached ? (
              <Text style={[Fonts.p3, { color: Colors.gold500 }]}>Division max</Text>
            ) : (
              <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                {targetElo}
                {' '}
                PTS
                {' '}
                <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                  (PROMOTION)
                </Text>
              </Text>
            )}
          </View>
          <View style={[styles.track, { backgroundColor: progressTrackColor }]}>
            <View style={[styles.bar, { backgroundColor: Colors.gold500, width: `${progress}%` }]} />
          </View>
          <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4, textAlign: 'center' }]}>
            {maxDivisionReached ? (
              <Text style={{ color: Colors.gold500 }}>Tu es déjà au plus haut niveau.</Text>
            ) : (
              <>
                <Text style={{ color: Colors.gold500 }}>{Math.max((targetElo || elo) - elo, 0)}</Text>
                {' '}
                points pour la promotion
              </>
            )}
          </Text>
        </View>

        <View style={[styles.rowBetween, { marginTop: 16 }]}>
          <View>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>SQUAD</Text>
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{teamName || 'Mon équipe'}</Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>RANK</Text>
            <Text style={[Fonts.h4, { color: Colors.gold500 }]}>
              #
              {rank}
            </Text>
          </View>
        </View>
      </View>
    </LeagueCard>
  );
}

const styles = StyleSheet.create({
  alignEnd: {
    alignItems: 'flex-end',
  },
  bar: {
    borderRadius: 3,
    height: '100%',
  },
  brandGap: {
    width: 8,
  },
  brandLeague: {
    fontSize: 18,
    letterSpacing: 1.1,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  brandLogo: {
    height: 16,
    resizeMode: 'contain',
    width: 98,
  },
  brandMarkWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -2,
  },
  centered: {
    alignItems: 'center',
  },
  container: {
    paddingVertical: 24,
  },
  divisionBadgeWrap: {
    marginBottom: 10,
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
