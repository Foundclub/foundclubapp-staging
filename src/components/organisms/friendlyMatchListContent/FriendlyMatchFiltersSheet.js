import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAllFriendlyMatchFormats } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';

/** L etat « aucun filtre », partage avec la liste. */
export const EMPTY_FRIENDLY_MATCH_FILTERS = Object.freeze({
  category: '',
  format: '',
  hostingIntent: 'any',
  level: '',
  maxDistanceKm: 0,
  periodDays: 0,
});

const HOSTING_INTENT_OPTIONS = [
  { label: 'Peu importe', value: 'any' },
  { label: 'Je veux recevoir', value: 'host' },
  { label: 'Je veux me déplacer', value: 'away' },
];

const PERIOD_OPTIONS = [
  { label: 'Peu importe', value: 0 },
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '3 mois', value: 90 },
];

const DISTANCE_OPTIONS = [
  { label: 'Peu importe', value: 0 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
];

/**
 * Compte les filtres reellement poses, pour la pastille du bouton « filtres ».
 * @param {any} filters
 * @returns {number}
 */
export const countFriendlyMatchFilters = (filters) => Object.entries(filters || {})
  .filter(([key, value]) => {
    if (key === 'hostingIntent') return Boolean(value) && value !== 'any';
    if (key === 'maxDistanceKm' || key === 'periodDays') return Number(value) > 0;
    return Boolean(value);
  })
  .length;

/**
 * Panneau de filtres des matchs amicaux (§4.2).
 *
 * Volontairement un composant, pas un ecran : enregistrer un ecran de plus
 * exigerait son motif web (webRoutes.parity.test.js), et le routage web est le
 * lot L7. Les filtres vivent donc dans l etat local de la liste.
 * @param {object} props
 * @param {any} props.filters
 * @param {() => void} props.onClose
 * @param {(filters: any) => void} props.onApply
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchFiltersSheet({
  filters,
  onApply,
  onClose,
  visible,
}) {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const [draft, setDraft] = useState(filters || EMPTY_FRIENDLY_MATCH_FILTERS);

  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();

  // Rouvrir le panneau repart TOUJOURS des filtres reellement appliques : sans
  // ca, un brouillon abandonne reapparaitrait comme s il etait actif.
  useEffect(() => {
    if (visible) setDraft(filters || EMPTY_FRIENDLY_MATCH_FILTERS);
  }, [filters, visible]);

  const categoryOptions = useMemo(() => [
    { label: 'Toutes', value: '' },
    ...(categories || []).map((/** @type {any} */ category) => ({
      label: category.name,
      value: category.documentId || '',
    })),
  ], [categories]);

  const levelOptions = useMemo(() => [
    { label: 'Tous', value: '' },
    ...(levels || []).map((/** @type {any} */ level) => ({
      label: level.name,
      value: level.documentId || '',
    })),
  ], [levels]);

  const formatOptions = useMemo(() => [
    { label: 'Tous', value: '' },
    ...getAllFriendlyMatchFormats().map((format) => ({ label: format, value: format })),
  ], []);

  /**
   * Modifie une seule cle du brouillon, sans toucher aux autres.
   * @param {string} key
   * @param {any} value
   * @returns {void}
   */
  const updateDraft = (key, value) => setDraft(
    (/** @type {any} */ previous) => ({ ...previous, [key]: value }),
  );

  /**
   * Un groupe de pastilles a choix unique. Les pastilles font 44 pt de haut et
   * annoncent leur etat selectionne aux lecteurs d ecran.
   * @param {string} title
   * @param {Array<{ label: string, value: any }>} options
   * @param {any} selectedValue
   * @param {(value: any) => void} onSelect
   * @returns {import('react').ReactElement}
   */
  const renderChipGroup = (title, options, selectedValue, onSelect) => (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>{title}</Text>
      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {options.map((option) => {
          const isActive = String(option.value) === String(selectedValue ?? '');
          return (
            <TouchableOpacity
              accessibilityLabel={`${title} : ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={`${title}-${option.value}`}
              onPress={() => onSelect(option.value)}
              style={{
                alignItems: 'center',
                backgroundColor: isActive ? `${Colors.primary500}26` : `${Colors.primary900}F0`,
                borderColor: isActive ? Colors.primary500 : `${Colors.primary500}26`,
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
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
    </View>
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={{
        backgroundColor: withAlpha(Colors.neutral900, 0.55),
        flex: 1,
        justifyContent: 'flex-end',
      }}
      >
        <View style={{
          backgroundColor: Colors.primary900,
          borderColor: `${Colors.primary500}30`,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          maxHeight: '88%',
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
        >
          <View style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[16],
          ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>Filtres</Text>
            <TouchableOpacity
              accessibilityLabel="Fermer les filtres"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                alignItems: 'center',
                height: 44,
                justifyContent: 'center',
                width: 44,
              }}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral200 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[16]]}
            showsVerticalScrollIndicator={false}
          >
            {renderChipGroup(
              'Je veux',
              HOSTING_INTENT_OPTIONS,
              draft.hostingIntent,
              (value) => updateDraft('hostingIntent', value),
            )}
            <Text style={[Fonts.p4, { color: `${Colors.neutral100}A0`, marginTop: -12 }]}>
              Les annonces incompatibles avec ton choix sont simplement masquées.
            </Text>

            {renderChipGroup(
              'Quand',
              PERIOD_OPTIONS,
              draft.periodDays,
              (value) => updateDraft('periodDays', value),
            )}

            {renderChipGroup(
              'Distance',
              DISTANCE_OPTIONS,
              draft.maxDistanceKm,
              (value) => updateDraft('maxDistanceKm', value),
            )}

            {renderChipGroup(
              'Catégorie',
              categoryOptions,
              draft.category,
              (value) => updateDraft('category', value),
            )}

            {renderChipGroup(
              'Niveau',
              levelOptions,
              draft.level,
              (value) => updateDraft('level', value),
            )}

            {renderChipGroup(
              'Format',
              formatOptions,
              draft.format,
              (value) => updateDraft('format', value),
            )}
          </ScrollView>

          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            <Button
              onPress={() => onApply({ ...EMPTY_FRIENDLY_MATCH_FILTERS })}
              title="Effacer"
              variant="Secondary"
            />
            <Button
              onPress={() => onApply(draft)}
              title="Appliquer"
              variant="Primary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default FriendlyMatchFiltersSheet;
