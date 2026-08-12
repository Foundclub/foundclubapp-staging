import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * Un groupe de pastilles, a choix unique ou a choix MULTIPLE.
 *
 * Extrait de FriendlyMatchFiltersSheet (lot L4), ou le meme rendu etait une
 * fonction locale : le lot L5 en a besoin dans 4 ecrans de plus (« je peux
 * recevoir », format, categorie, niveau, et le choix « qui recoit » de la
 * candidature). Une pastille recopiee 5 fois derive 5 fois.
 *
 * D90 ajoute le choix multiple SANS toucher aux appelants existants : passer
 * `selectedValues` (un tableau) fait basculer le groupe en cases a cocher,
 * `selectedValue` (une valeur) le laisse en choix unique. Dessiner un second
 * composant aurait fait deriver la cible tactile et l annonce vocale.
 *
 * Deux choses ne sont PAS negociables ici et c est pourquoi elles sont dans le
 * composant plutot que chez l appelant :
 * · 44 pt de haut au minimum — c est la cible tactile accessible ;
 * · l etat annonce aux lecteurs d ecran — `selected` en choix unique,
 * `checked` en choix multiple, parce qu une pastille qui s ajoute aux autres
 * est une case a cocher, pas un bouton. La couleur seule ne dit rien.
 * @param {object} props
 * @param {boolean} [props.disabled] - Grise tout le groupe.
 * @param {string} [props.hint] - Phrase d aide sous les pastilles.
 * @param {(value: any) => void} props.onSelect
 * @param {Array<{ hint?: string, label: string, value: any }>} props.options
 * @param {any} [props.selectedValue] - Choix unique.
 * @param {any[]} [props.selectedValues] - Choix multiple : bascule le groupe en cases a cocher.
 * @param {string} props.title
 * @returns {import('react').ReactElement}
 */
function ChoiceChipGroup({
  disabled = false,
  hint,
  onSelect,
  options,
  selectedValue,
  selectedValues,
  title,
}) {
  const isWeb = Platform.OS === 'web';
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const isMultiSelect = Array.isArray(selectedValues);
  const selectedKeys = new Set(
    (selectedValues || []).map((/** @type {any} */ value) => String(value)),
  );

  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{title}</Text>

      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {(options || []).map((option) => {
          const isActive = isMultiSelect
            ? selectedKeys.has(String(option.value))
            : String(option.value) === String(selectedValue ?? '');
          return (
            <TouchableOpacity
              accessibilityLabel={`${title} : ${option.label}`}
              accessibilityRole={isMultiSelect ? 'checkbox' : 'button'}
              accessibilityState={isMultiSelect
                ? { checked: isActive, disabled }
                : { disabled, selected: isActive }}
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
