import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { getTacticalSportKey } from '@/utils/tacticalField';

const LINE_WIDTH = 0.9;

const SPORT_PALETTES = {
  basketball: {
    accentSoft: '#E6A155',
    background: '#6D401D',
    line: '#FFF7E8',
    surface: '#C8853F',
    surfaceAlt: '#D9964E',
  },
  football: {
    accentSoft: '#62C56E',
    background: '#1C4622',
    line: '#F7FBFF',
    surface: '#2C7A37',
    surfaceAlt: '#379645',
  },
  generic: {
    accentSoft: '#62C56E',
    background: '#183F28',
    line: '#F7FBFF',
    surface: '#276C3A',
    surfaceAlt: '#2E8245',
  },
  handball: {
    accentSoft: '#55CDE9',
    background: '#0A2D38',
    line: '#F4FBFF',
    surface: '#176279',
    surfaceAlt: '#1C7892',
  },
  rugby: {
    accentSoft: '#86D29C',
    background: '#193822',
    line: '#F7FBFF',
    surface: '#2A6A38',
    surfaceAlt: '#347E44',
  },
  volleyball: {
    accentSoft: '#F0BF67',
    background: '#0C445A',
    line: '#FFF8EF',
    surface: '#DB8D42',
    surfaceAlt: '#F0A756',
  },
};

const renderStripedSurface = (palette, stripCount = 8) => {
  const stripHeight = 100 / stripCount;

  return Array.from({ length: stripCount }, (_, index) => index * stripHeight).map((y) => (
    <Rect
      fill={(Math.round(y / stripHeight) % 2) === 0 ? palette.surface : palette.surfaceAlt}
      height={stripHeight + 0.2}
      key={`stripe-${y}`}
      width="100"
      x="0"
      y={y}
    />
  ));
};

const renderFootballField = (palette) => (
  <>
    {renderStripedSurface(palette, 10)}
    <Rect fill="none" height="92" rx="2" stroke={palette.line} strokeWidth={LINE_WIDTH} width="90" x="5" y="4" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="5" x2="95" y1="50" y2="50" />
    <Circle cx="50" cy="50" fill="none" r="9" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Circle cx="50" cy="50" fill={palette.line} r="0.9" />
    <Rect fill="none" height="18" stroke={palette.line} strokeWidth={LINE_WIDTH} width="52" x="24" y="4" />
    <Rect fill="none" height="7" stroke={palette.line} strokeWidth={LINE_WIDTH} width="26" x="37" y="4" />
    <Rect fill="none" height="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="14" x="43" y="1" />
    <Rect fill="none" height="18" stroke={palette.line} strokeWidth={LINE_WIDTH} width="52" x="24" y="78" />
    <Rect fill="none" height="7" stroke={palette.line} strokeWidth={LINE_WIDTH} width="26" x="37" y="89" />
    <Rect fill="none" height="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="14" x="43" y="96" />
    <Circle cx="50" cy="16" fill={palette.line} r="0.9" />
    <Circle cx="50" cy="84" fill={palette.line} r="0.9" />
    <Path d="M 40 22 A 10 10 0 0 0 60 22" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 60 78 A 10 10 0 0 0 40 78" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 5 14 A 9 9 0 0 0 14 5" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 95 14 A 9 9 0 0 1 86 5" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 5 86 A 9 9 0 0 1 14 95" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 95 86 A 9 9 0 0 0 86 95" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
  </>
);

const renderRugbyField = (palette) => (
  <>
    {renderStripedSurface(palette, 10)}
    <Rect fill="none" height="92" rx="2" stroke={palette.line} strokeWidth={LINE_WIDTH} width="88" x="6" y="4" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="50" y2="50" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="10" y2="10" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="90" y2="90" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="27" y2="27" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="73" y2="73" />
    <Line opacity="0.75" stroke={palette.line} strokeDasharray="3 3" strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="40" y2="40" />
    <Line opacity="0.75" stroke={palette.line} strokeDasharray="3 3" strokeWidth={LINE_WIDTH} x1="6" x2="94" y1="60" y2="60" />
    <Circle cx="50" cy="50" fill="none" r="6" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Circle cx="50" cy="50" fill={palette.line} r="0.8" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="47" x2="47" y1="4" y2="12" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="53" x2="53" y1="4" y2="12" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="47" x2="53" y1="10" y2="10" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="47" x2="47" y1="88" y2="96" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="53" x2="53" y1="88" y2="96" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="47" x2="53" y1="90" y2="90" />
  </>
);

const renderHandballField = (palette) => (
  <>
    <Rect fill={palette.surfaceAlt} height="100" width="100" x="0" y="0" />
    <Rect fill={palette.surface} height="88" rx="3" width="84" x="8" y="6" />
    <Rect fill="none" height="88" rx="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="84" x="8" y="6" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="8" x2="92" y1="50" y2="50" />
    <Circle cx="50" cy="50" fill="none" r="6" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Rect fill="none" height="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="16" x="42" y="3" />
    <Rect fill="none" height="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="16" x="42" y="94" />
    <Path d="M 34 20 A 16 16 0 0 1 66 20" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 26 29 A 24 24 0 0 1 74 29" fill="none" stroke={palette.line} strokeDasharray="3 2.5" strokeWidth={LINE_WIDTH} />
    <Path d="M 66 80 A 16 16 0 0 1 34 80" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 74 71 A 24 24 0 0 1 26 71" fill="none" stroke={palette.line} strokeDasharray="3 2.5" strokeWidth={LINE_WIDTH} />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="46" x2="54" y1="18" y2="18" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="46" x2="54" y1="82" y2="82" />
  </>
);

const renderVolleyballField = (palette) => (
  <>
    <Rect fill={palette.background} height="100" width="100" x="0" y="0" />
    <Rect fill={palette.surfaceAlt} height="84" rx="3" width="80" x="10" y="8" />
    <Rect fill={palette.surface} height="40" rx="3" width="80" x="10" y="8" />
    <Rect fill={palette.surface} height="40" rx="3" width="80" x="10" y="52" />
    <Rect fill="none" height="84" rx="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="80" x="10" y="8" />
    <Line stroke={palette.line} strokeWidth="1.4" x1="10" x2="90" y1="50" y2="50" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="10" x2="90" y1="34" y2="34" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="10" x2="90" y1="66" y2="66" />
  </>
);

const renderBasketballField = (palette) => (
  <>
    <Rect fill={palette.background} height="100" width="100" x="0" y="0" />
    {Array.from({ length: 12 }, (_, index) => index * (100 / 12)).map((x) => (
      <Rect
        fill={(Math.round(x / (100 / 12)) % 2) === 0 ? palette.surface : palette.surfaceAlt}
        height="100"
        key={`plank-${x}`}
        opacity={0.95}
        width={100 / 12 + 0.4}
        x={x}
        y="0"
      />
    ))}
    <Rect fill="none" height="88" rx="3" stroke={palette.line} strokeWidth={LINE_WIDTH} width="84" x="8" y="6" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="8" x2="92" y1="50" y2="50" />
    <Circle cx="50" cy="50" fill="none" r="10" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Rect fill="none" height="20" stroke={palette.line} strokeWidth={LINE_WIDTH} width="30" x="35" y="6" />
    <Rect fill="none" height="20" stroke={palette.line} strokeWidth={LINE_WIDTH} width="30" x="35" y="74" />
    <Path d="M 22 6 L 22 18 A 28 28 0 0 0 78 18 L 78 6" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Path d="M 22 94 L 22 82 A 28 28 0 0 1 78 82 L 78 94" fill="none" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Circle cx="50" cy="26" fill="none" r="8" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Circle cx="50" cy="74" fill="none" r="8" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="43" x2="57" y1="10" y2="10" />
    <Line stroke={palette.line} strokeWidth={LINE_WIDTH} x1="43" x2="57" y1="90" y2="90" />
    <Circle cx="50" cy="12.5" fill="none" r="1.6" stroke={palette.line} strokeWidth={LINE_WIDTH} />
    <Circle cx="50" cy="87.5" fill="none" r="1.6" stroke={palette.line} strokeWidth={LINE_WIDTH} />
  </>
);

const renderFieldLines = (sportKey, palette) => {
  switch (sportKey) {
    case 'basketball':
      return renderBasketballField(palette);
    case 'handball':
      return renderHandballField(palette);
    case 'rugby':
      return renderRugbyField(palette);
    case 'volleyball':
      return renderVolleyballField(palette);
    case 'football':
    case 'generic':
    default:
      return renderFootballField(palette);
  }
};

function RenderedTacticalField({
  children = null,
  sport = 'generic',
  style,
}) {
  const sportKey = useMemo(() => getTacticalSportKey(sport), [sport]);
  const palette = SPORT_PALETTES[sportKey] || SPORT_PALETTES.generic;
  const gradientId = `field-gradient-${sportKey}`;
  const glowId = `field-glow-${sportKey}`;

  return (
    <View pointerEvents="box-none" style={[styles.container, style]}>
      <Svg
        pointerEvents="none"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={palette.surfaceAlt} />
            <Stop offset="1" stopColor={palette.background} />
          </LinearGradient>
          <LinearGradient id={glowId} x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={`${palette.accentSoft}66`} />
            <Stop offset="1" stopColor="transparent" />
          </LinearGradient>
        </Defs>

        <Rect fill={`url(#${gradientId})`} height="100" width="100" x="0" y="0" />
        <Rect fill={`url(#${glowId})`} height="100" opacity="0.38" width="100" x="0" y="0" />
        <G>{renderFieldLines(sportKey, palette)}</G>
        <Rect
          fill="none"
          height="98"
          opacity="0.22"
          rx="4"
          stroke={palette.accentSoft}
          strokeWidth="1.4"
          width="98"
          x="1"
          y="1"
        />
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});

export default memo(RenderedTacticalField);
