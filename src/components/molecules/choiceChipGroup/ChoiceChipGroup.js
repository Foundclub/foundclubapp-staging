import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * Un groupe de pastilles a choix unique, avec son titre et son aide.
 *
 * Extrait de FriendlyMatchFiltersSheet (lot L4), ou le meme rendu etait une
 * fonction locale : le lot L5 en a besoin dans 4 ecrans de plus (« je peux
 * recevoir », format, categorie, niveau, et le choix « qui recoit » de la
 * candidature). Une pastille recopiee 5 fois derive 5 fois.
 *
 * Deux choses ne sont PAS negociables ici et c est pourquoi elles sont dans le
 * composant plutot que chez l appelant :
 * · 44 pt de haut au minimum — c est la cible tactile accessible ;
 * · `accessibilityState={{ selected }}` — sans lui, un lecteur d ecran
 * annonce « bouton » sans jamais dire lequel est choisi. La couleur seule
 * ne dit rien.
 * @param {object} props
 * @param {boolean} [props.disabled] - Grise tout le groupe.
 * @param {string} [props.hint] - Phrase d aide sous les pastilles.
 * @param {(value: any) => void} props.onSelect
 * @param {Array<{ hint?: string, label: string, value: any }>} props.options
 * @param {any} props.selectedValue
 * @param {string} props.title
 * @returns {import('react').ReactElement}
 */
function ChoiceChipGroup({
  disabled = false,
  hint,
  onSelect,
  options,
  selectedValue,
  title,
}) {
  const isWeb = Platform.OS === 'web';
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{title}</Text>

      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {(options || []).map((option) => {
          const isActive = String(option.value) === String(selectedValue ?? '');
          return (
            <TouchableOpacity
              accessibilityLabel={`${title} : ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: isActive }}
              disabled={disabled}
              key={`${title}-${option.value}`}
              onPress={() => onSelect(option.value)}
              style={{
                alignItems: 'center',
                backgroundColor: isActive
                  ? withAlpha(Colors.primary500, 0.15)
                  : withAlpha(Colors.primary900, 0.94),
                borderColor: isActive
                  ? Colors.primary500
                  : withAlpha(Colors.primary500, 0.15),
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
                opacity: disabled ? 0.5 : 1,
                paddingHorizontal: 16,
                paddingVertical: isWeb ? 10 : 8,
              }}
            >
              <Text style={[
                Fonts.p4Bold,
                { color: isActive ? Colors.primary500 : Colors.neutral200 },
              ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hint ? (
        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export default ChoiceChipGroup;
