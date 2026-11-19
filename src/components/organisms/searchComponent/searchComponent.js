import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import TourTarget from '@/components/molecules/tour/TourTarget';

const normalizeSearchValue = (value) => {
  const normalized = String(value || '');
  return normalized.length > 0 && normalized.length < 2 ? '' : normalized;
};

/**
 * Search component for clubs.
 * @param {object} props - The props
 * @param {number} [props.filterNumber] - The number of filters applied
 * @param {() => void} props.openFilters - Function to open the filters
 * @param {(text: string) => void} props.handleSearchField - Function to handle search field changes
 * @param {string} [props.searchDefaultValue] - Default value for the search field
 * @param {string} [props.placeholder] - Placeholder text for the search input
 * @param {'default' | 'compact'} [props.inputDensity] - Input density
 * @param {import('react-native').TextStyle | import('react-native').TextStyle[]} [props.inputStyle]
 * @param {boolean} [props.filtresDansLeChamp] - IMPL-4-ACCUEIL (page 7) : la loupe, le texte,
 *   « effacer » et les filtres dans une seule case bordée, pleine largeur. Posé par la recherche
 *   seulement (SearchHubScreen) ; absent, la barre ne change pas.
 * @returns {import('react').ReactElement} Search component
 */
function SearchComponent({
  filterNumber = undefined,
  filtresDansLeChamp = false,
  handleSearchField,
  inputDensity = 'compact',
  inputStyle,
  openFilters,
  placeholder,
  searchDefaultValue = '',
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(searchDefaultValue);
  const [champActif, setChampActif] = useState(false);
  const searchHandlerRef = useRef(handleSearchField);
  const isSyncingDefaultValueRef = useRef(false);
  const lastEmittedValueRef = useRef(normalizeSearchValue(searchDefaultValue));
  const previousDefaultValueRef = useRef(String(searchDefaultValue || ''));
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  useEffect(() => {
    const nextDefaultValue = String(searchDefaultValue || '');
    if (previousDefaultValueRef.current === nextDefaultValue) {
      return;
    }

    previousDefaultValueRef.current = nextDefaultValue;
    lastEmittedValueRef.current = normalizeSearchValue(nextDefaultValue);

    // C04 Q3-16 — « a » part comme « » : la liste qui renvoie « » ne doit pas vider la barre.
    if (normalizeSearchValue(search) === nextDefaultValue) {
      return;
    }

    isSyncingDefaultValueRef.current = true;
    setSearch(nextDefaultValue);
  }, [search, searchDefaultValue]);

  useEffect(() => {
    searchHandlerRef.current = handleSearchField;
  }, [handleSearchField]);

  useEffect(() => {
    if (isSyncingDefaultValueRef.current) {
      isSyncingDefaultValueRef.current = false;
      return undefined;
    }

    const normalizedValue = normalizeSearchValue(search);
    if (normalizedValue === lastEmittedValueRef.current) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      lastEmittedValueRef.current = normalizedValue;
      searchHandlerRef.current?.(normalizedValue);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  /**
   * Handles the change in the search input.
   * @param {string} text
   */
  const handleChange = (text) => {
    setSearch(text);
  };

  const handleSubmit = () => {
    const normalizedValue = normalizeSearchValue(search);
    lastEmittedValueRef.current = normalizedValue;
    searchHandlerRef.current?.(normalizedValue);
  };

  // RECRUTER-TUNNEL (audit V1) — sans libelle, le lecteur d'ecran annoncait « bouton » tout court
  // (`content-desc` vide), et la pastille du nombre ne se lit pas avec lui.
  const libelleFiltres = filterNumber
    ? t('search.filters.buttonActive', {
      count: filterNumber,
      defaultValue_one: 'Filtrer, {{count}} filtre actif',
      defaultValue_other: 'Filtrer, {{count}} filtres actifs',
    })
    : t('search.filters.button', 'Filtrer');
  const pastilleFiltres = filterNumber ? (
    <View style={[
      Alignments.absolute,
      Alignments.alignCenter,
      Alignments.justifyCenter,
      Spaces.paddingHorizontal[4],
      ApplicationStyle.backgroundColor.primary500,
      ApplicationStyle.borderRadius32,
      {
        right: 0, top: 0, width: 18, zIndex: 1,
      },
    ]}
    >
      <Text style={[Fonts.p3, Fonts.primary900]}>
        {filterNumber}
      </Text>
    </View>
  ) : null;

  if (filtresDansLeChamp) {
    // IMPL-4-ACCUEIL, page 7 (planche 7a-7c, Adel 18/11) — le champ sur toute la largeur, les
    // filtres dedans : case de 48 px, rayon 12 (le champ du thème), bord bleu, plein au focus.
    return (
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            borderColor: champActif ? Colors.primary500 : withAlpha(Colors.primary500, 0.5),
            borderRadius: 12,
            borderWidth: 1,
            minHeight: 48,
            paddingRight: 4,
          },
        ]}
        testID="champ-de-recherche"
      >
        <View style={[Alignments.fill]}>
          <Input
            density="compact"
            icon="search"
            lightMode
            onBlur={() => {
              setChampActif(false);
              handleSubmit();
            }}
            onChangeText={handleChange}
            onFocus={() => setChampActif(true)}
            onSubmitEditing={handleSubmit}
            placeholder={placeholder}
            placeholderTextColor={Colors.neutral300}
            style={inputStyle}
            value={search}
          />
        </View>
        {search ? (
          <TouchableOpacity
            accessibilityLabel={t('implAccueil.rechercheEffacer', 'Effacer la recherche')}
            accessibilityRole="button"
            onPress={() => setSearch('')}
            style={[Alignments.alignCenter, Alignments.justifyCenter, styles.cible44]}
          >
            <Image
              source={Images.close}
              style={{
                height: 16, tintColor: Colors.neutral300, width: 16,
              }}
            />
          </TouchableOpacity>
        ) : null}
        <TourTarget id="search.filters">
          <TouchableOpacity
            accessibilityLabel={libelleFiltres}
            accessibilityRole="button"
            onPress={openFilters}
            style={[Alignments.alignCenter, Alignments.justifyCenter, styles.cible44]}
          >
            {pastilleFiltres}
            <Image
              source={Images.filter}
              style={{
                height: 22, tintColor: Colors.primary500, width: 22,
              }}
            />
          </TouchableOpacity>
        </TourTarget>
      </View>
    );
  }

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
      ]}
    >

      <View style={[Alignments.fill]}>
        <Input
          density={inputDensity}
          icon="search"
          onBlur={handleSubmit}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral300}
          style={inputStyle}
          value={search}
        />
      </View>
      <View style={[Alignments.relative]}>
        {pastilleFiltres}
        {/* 8 listes partagent ce bouton (libellé : `libelleFiltres`). */}
        <TourTarget id="search.filters">
          <Button
            accessibilityLabel={libelleFiltres}
            icon="filter"
            onPress={openFilters}
            size="sm"
            variant="Secondary"
          />
        </TourTarget>
      </View>
    </View>
  );
}

// IMPL-4-ACCUEIL : la cible tactile du thème (44 px) des deux gestes dans le champ.
const styles = StyleSheet.create({
  cible44: {
    minHeight: 44,
    minWidth: 44,
  },
});

export default SearchComponent;
