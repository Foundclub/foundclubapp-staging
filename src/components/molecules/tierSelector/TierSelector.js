import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Segmented control pilule des paliers d'offre (handoff design, decision 1).
 * Variante « plain » uniquement : les segments n'affichent JAMAIS de prix —
 * l'ancre prix unique vit ailleurs sur la surface.
 * @param {object} props
 * @param {Array<{ coverageNotice?: string | null; id: string | number; isSelectable?: boolean;
 *   label: string }>} props.options - Paliers. UPGRADE (2026-09-04) : un palier
 *   peut etre INDIVIDUELLEMENT indisponible (`isSelectable: false`) — c'est le
 *   motif de desactivation pose par CLUBEQ, applique ici aux offres Club qu'un
 *   club deja couvert ne peut plus acheter. `coverageNotice` dit pourquoi, et
 *   part dans le libelle d'accessibilite : un lecteur d'ecran ne voit pas
 *   l'opacite.
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
        const isOptionSelectable = option.isSelectable !== false;
        const isOptionDisabled = disabled || !isOptionSelectable;
        return (
          <TouchableOpacity
            accessibilityLabel={option.coverageNotice
              ? `${option.label} — ${option.coverageNotice}`
              : undefined}
            accessibilityRole="button"
            accessibilityState={{ disabled: isOptionDisabled, selected: isSelected }}
            disabled={isOptionDisabled || !onChange}
            key={String(option.id)}
            onPress={() => onChange?.(option.id)}
            style={{
              alignItems: 'center',
              backgroundColor: isSelected ? Colors.primary500 : 'transparent',
              borderRadius: 999,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
              opacity: isOptionSelectable ? 1 : 0.45,
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
