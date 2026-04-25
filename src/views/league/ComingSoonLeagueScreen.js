import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import LeagueCard from '@/components/atoms/league/LeagueCard';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getLeagueClosedMessageLines } from '@/services/league/leaguePlatformService';

const padNumber = (value) => String(value).padStart(2, '0');

const getRemainingParts = (targetDate) => {
  if (!targetDate) return null;
  const targetTimestamp = new Date(String(targetDate)).getTime();
  if (!Number.isFinite(targetTimestamp)) return null;

  const deltaMs = targetTimestamp - Date.now();
  if (deltaMs <= 0) {
    return {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
    };
  }

  const totalSeconds = Math.floor(deltaMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: padNumber(days),
    hours: padNumber(hours),
    minutes: padNumber(minutes),
    seconds: padNumber(seconds),
  };
};

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.value
 */
function CountdownCell({ label, value }) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <View
      style={[
        Spaces.padding[16],
        {
          alignItems: 'center',
          backgroundColor: 'rgba(9, 24, 35, 0.88)',
          borderColor: `${Colors.primary500}33`,
          borderRadius: 18,
          borderWidth: 1,
          flex: 1,
          minWidth: 68,
        },
      ]}
    >
      <Text style={[Fonts.h2Bold, { color: Colors.primary500 }]}>{value}</Text>
      <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.runtime
 */
function ComingSoonLeagueScreen({ runtime }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const openingDate = runtime?.platform?.countdownTarget || runtime?.platform?.openingDate || null;
  const [remaining, setRemaining] = useState(() => getRemainingParts(openingDate));

  useEffect(() => {
    setRemaining(getRemainingParts(openingDate));
    if (!openingDate) return undefined;

    const intervalId = setInterval(() => {
      setRemaining(getRemainingParts(openingDate));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [openingDate]);

  const messageLines = useMemo(
    () => getLeagueClosedMessageLines(runtime, 'platform'),
    [runtime],
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifyCenter,
        Spaces.paddingVertical[32],
      ]}
      responsivePadding
      withHeaderPadding={false}
    >
      <View style={[Spaces.gap[20], { alignSelf: 'center', maxWidth: 560, width: '100%' }]}>
        <View style={[Spaces.gap[10], { alignItems: 'center' }]}>
          <Text style={[Fonts.label, { color: Colors.primary500, letterSpacing: 1.2 }]}>
            FOUND CLUB LEAGUE
          </Text>
          <Text style={[Fonts.h1, Fonts.neutral00, { textAlign: 'center' }]}>
            Found Club League arrive bientôt.
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral100, { lineHeight: 26, textAlign: 'center' }]}>
            Crée ta squad. Défie ta ville. Joue ton prochain match.
          </Text>
        </View>

        <LeagueCard style={{ marginBottom: 0 }}>
          <View style={[Spaces.gap[12]]}>
            {messageLines.map((line) => (
              <Text key={line} style={[Fonts.p1, Fonts.neutral00, { lineHeight: 24 }]}>
                {line}
              </Text>
            ))}
          </View>
        </LeagueCard>

        {remaining ? (
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200, textAlign: 'center' }]}>
              Compte à rebours avant ouverture
            </Text>
            <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
              <CountdownCell label="Jours" value={remaining.days} />
              <CountdownCell label="Heures" value={remaining.hours} />
              <CountdownCell label="Minutes" value={remaining.minutes} />
              <CountdownCell label="Secondes" value={remaining.seconds} />
            </View>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default ComingSoonLeagueScreen;
