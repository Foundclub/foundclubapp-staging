import { StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {import('react').ReactNode} [props.subtitle]
 * @param {import('react').ReactNode} [props.rightElement]
 * @returns {import('react').ReactElement}
 */
function SectionHeader({ rightElement, subtitle, title }) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <View style={[styles.container, Spaces.marginBottom[16]]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { ...Fonts.h3, color: Colors.neutral00 || '#FFF' }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, Fonts.p2, Fonts.neutral300, Spaces.marginTop[4]]}>{subtitle}</Text> : null}
      </View>
      {rightElement && (
        <View style={[styles.rightElement, Spaces.marginLeft[16]]}>
          {rightElement}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rightElement: {
  },
  subtitle: {
  },
  title: {
    textTransform: 'uppercase',
  },
});

export default SectionHeader;
