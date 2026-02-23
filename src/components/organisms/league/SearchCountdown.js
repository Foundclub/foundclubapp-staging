import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import LeagueCard from '@/components/atoms/league/LeagueCard';

/**
 * SearchCountdown component.
 * @param {{createdAt?: string | number | Date, serverNow?: string | number | Date | null, onExpired?: () => void}} props
 * @returns {import('react').ReactElement}
 */
function SearchCountdown({ createdAt, serverNow = null }) {
  const { Colors, Fonts } = useTheme();
  const [elapsed, setElapsed] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    if (!serverNow) {
      setServerOffsetMs(0);
      return;
    }
    const parsedServerNow = new Date(serverNow).getTime();
    if (Number.isNaN(parsedServerNow)) return;
    setServerOffsetMs(parsedServerNow - Date.now());
  }, [serverNow]);

  useEffect(() => {
    if (!createdAt) {
      setElapsed(null);
      return undefined;
    }

    const updateElapsed = () => {
      const created = new Date(createdAt).getTime();
      if (Number.isNaN(created)) {
        setElapsed(null);
        return;
      }

      const diff = Math.max(0, (Date.now() + serverOffsetMs) - created);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed({ hours, minutes, seconds });
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [createdAt, serverOffsetMs]);

  const formatNumber = (num) => String(num).padStart(2, '0');
  const displayHours = elapsed ? formatNumber(elapsed.hours) : '--';
  const displayMinutes = elapsed ? formatNumber(elapsed.minutes) : '--';
  const displaySeconds = elapsed ? formatNumber(elapsed.seconds) : '--';

  return (
    <LeagueCard
      style={[
        styles.container,
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.primary500,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={{ color: Colors.neutral00, fontSize: 16, marginRight: 8 }}>{'\u23F1'}</Text>
        <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
          TEMPS DE RECHERCHE
        </Text>
      </View>

      <View style={styles.timerRow}>
        <View style={styles.timerBlock}>
          <Text style={[styles.timerValue, { color: Colors.primary500 }]}>
            {displayHours}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>H</Text>
        </View>

        <Text style={[styles.separator, { color: Colors.primary500 }]}>:</Text>

        <View style={styles.timerBlock}>
          <Text style={[styles.timerValue, { color: Colors.primary500 }]}>
            {displayMinutes}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>M</Text>
        </View>

        <Text style={[styles.separator, { color: Colors.primary500 }]}>:</Text>

        <View style={styles.timerBlock}>
          <Text style={[styles.timerValue, { color: Colors.primary500 }]}>
            {displaySeconds}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>S</Text>
        </View>
      </View>
    </LeagueCard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
  },
  separator: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 2,
  },
  timerBlock: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  timerRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  timerValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});

export default SearchCountdown;
