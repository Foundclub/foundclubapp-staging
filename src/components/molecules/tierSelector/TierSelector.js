import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Segmented control pilule des paliers d'offre (handoff design, decision 1).
 * Variante « plain » uniquement : les segments n'affichent JAMAIS de prix —
 * l'ancre prix unique vit ailleurs sur la surface.
 * @param {object} props
 * @param {Array<{ id: string | number; label: string }>} props.options - Paliers.
 * @param {string | number | null} props.value - Palier selectionne.
 * @param {(id: string | number) => void} [props.onChange] - Selection d'un palier.
 * @param {boolean} [props.disabled] - Desactive la selection (opacite reduite).
 * @returns {import('react').ReactElement | null}
 */
function TierSelector({
  disabled = false,
  onChange,
  options,
  value,
}) {
  const { Colors, Fonts } = useTheme();

  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        opacity: disabled ? 0.45 : 1,
        padding: 4,
      }}
    >
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: isSelected }}
            disabled={disabled || !onChange}
            key={String(option.id)}
            onPress={() => onChange?.(option.id)}
            style={{
              alignItems: 'center',
              backgroundColor: isSelected ? Colors.primary500 : 'transparent',
              borderRadius: 999,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
              paddingHorizontal: 2,
              paddingVertical: 4,
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                Fonts.p2Bold,
                { color: isSelected ? Colors.primary900 : Colors.neutral00 },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default TierSelector;
