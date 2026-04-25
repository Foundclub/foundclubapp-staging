import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
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
 * Renders one countdown value.
 * @param {{ label: string, value: string }} root0
 * @param {string} root0.label
 * @param {string} root0.value
 * @returns {import('react').ReactElement}
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
 * Renders the closed League state with a safe exit to classic mode.
 * @param {{ onGoClassic?: () => void, runtime?: Record<string, any> }} root0
 * @param {() => void} [root0.onGoClassic]
 * @param {Record<string, any>} [root0.runtime]
 * @returns {import('react').ReactElement}
 */
function ComingSoonLeagueScreen({ onGoClassic, runtime }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
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
      contentContainerStyle={[Alignments.fill]}
      responsivePadding
      withHeaderPadding={false}
    >
      <ScrollView
        contentContainerStyle={[
          Alignments.grow1,
          Alignments.justifyCenter,
          Spaces.paddingVertical[28],
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.gap[20], { alignSelf: 'center', maxWidth: 560, width: '100%' }]}>
          {onGoClassic ? (
            <TouchableOpacity
              accessibilityHint="Retourne vers FoundClub classique"
              accessibilityLabel="Retour"
              accessibilityRole="button"
              onPress={onGoClassic}
              style={{
                alignItems: 'center',
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(9, 24, 35, 0.86)',
                borderColor: `${Colors.primary500}66`,
                borderRadius: 999,
                borderWidth: 1,
                height: 42,
                justifyContent: 'center',
                width: 42,
              }}
            >
              <Image
                source={Images.arrowLeft}
                style={{ height: 18, tintColor: Colors.primary500, width: 18 }}
              />
            </TouchableOpacity>
          ) : null}

          <View style={[Spaces.gap[10], { alignItems: 'center' }]}>
            <View
              style={{
                backgroundColor: `${Colors.gold500}18`,
                borderColor: `${Colors.gold500}55`,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                Accès League fermé
              </Text>
            </View>

            <Text style={[Fonts.label, { color: Colors.primary500, letterSpacing: 1.2 }]}>
              FOUND CLUB LEAGUE
            </Text>
            <Text style={[Fonts.h1, Fonts.neutral00, { textAlign: 'center' }]}>
              Found Club League arrive bientôt.
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral100, { lineHeight: 26, textAlign: 'center' }]}>
              Le mode League est momentanément fermé. FoundClub classique reste disponible.
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

          {onGoClassic ? (
            <Button
              onPress={onGoClassic}
              style={{ backgroundColor: Colors.gold500, borderColor: `${Colors.gold500}66` }}
              textStyle={{ color: Colors.primary900 }}
              title="Retour à FoundClub classique"
              variant="Primary"
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default ComingSoonLeagueScreen;
