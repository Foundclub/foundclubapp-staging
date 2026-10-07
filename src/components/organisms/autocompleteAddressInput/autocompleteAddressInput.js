import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { useGetPlaces } from '@/services/places/placesQueries';

import LieuSurCarte from './LieuSurCarte';

/**
 * @typedef {object} Option
 * @property {string | number | null} value
 * @property {string} label
 * @property {string} [city]
 * @property {string} [context]
 * @property {string} [postcode]
 * @property {string} [provider]
 * @property {string | null} [providerId]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {{ north: number, south: number, east: number, west: number } | null} [bbox]
 * @property {string} [type]
 */

const extractBoundingBox = (/** @type {any} */ place) => {
  const rawBbox = place?.bbox || place?.properties?.bbox || place?.properties?.boundingbox;
  if (Array.isArray(rawBbox) && rawBbox.length >= 4) {
    const [westRaw, southRaw, eastRaw, northRaw] = rawBbox;
    const west = Number(westRaw);
    const south = Number(southRaw);
    const east = Number(eastRaw);
    const north = Number(northRaw);
    if ([north, south, east, west].every((value) => Number.isFinite(value))) {
      return {
        east,
        north,
        south,
        west,
      };
    }
  }

  if (rawBbox && typeof rawBbox === 'object') {
    const north = Number(rawBbox.north ?? rawBbox.maxLat ?? rawBbox[3]);
    const south = Number(rawBbox.south ?? rawBbox.minLat ?? rawBbox[1]);
    const east = Number(rawBbox.east ?? rawBbox.maxLon ?? rawBbox.maxLng ?? rawBbox[2]);
    const west = Number(rawBbox.west ?? rawBbox.minLon ?? rawBbox.minLng ?? rawBbox[0]);
    if ([north, south, east, west].every((value) => Number.isFinite(value))) {
      return {
        east,
        north,
        south,
        west,
      };
    }
  }

  return null;
};

/**
 * Une proposition de recherche (BAN, nos lieux) en option du champ. ADRESSE-CARTE (07/10) : sortie
 * du composant, telle quelle, pour qu'un lieu POSÉ sur la carte devienne exactement la même option
 * qu'une adresse choisie dans la liste.
 * @param {any} place - Une proposition (`{ geometry, properties }`).
 * @returns {Option} L'option.
 */
const placeToOption = (place) => {
  const { geometry, properties } = place || {};
  const coordinates = geometry?.coordinates || [];
  const [lng, lat] = coordinates;
  const hasValidCoordinates = Number.isFinite(lng) && Number.isFinite(lat);
  const postcode = properties?.postcode?.trim();
  const rawLabel = properties?.label || '';

  /** @type {Option} */
  const option = {
    bbox: extractBoundingBox(place),
    city: properties?.city || '',
    context: properties?.context || '',
    label: postcode && !rawLabel.includes(postcode)
      ? `${rawLabel} (${postcode})`
      : rawLabel,
    lat: hasValidCoordinates ? lat : undefined,
    lng: hasValidCoordinates ? lng : undefined,
    postcode: postcode || '',
    provider: 'ban',
    providerId: properties?.id || null,
    type: properties?.type || properties?.source || '',
    value: hasValidCoordinates ? `${lng}|${lat}` : '',
  };
  return option;
};

/**
 * Represents the autocomplete address input.
 * @param {object} props - The props of the component.
 * @param {Option | undefined} [props.address] - Controlled selected address.
 * @param {(value: Option | undefined) => void} [props.setAddress] - Controlled state setter.
 * @param {(value: Option | undefined) => void} [props.onSelect] - Optional select callback.
 * @param {string} [props.label] - The label of the input.
 * @param {string} [props.placeholder] - The placeholder of the input.
 * @param {string} [props.error] - The error of the input.
 * @param {boolean} [props.disabled] - Disable state.
 * @param {boolean} [props.lightMode] - Remove the default underline input chrome.
 * @param {number} [props.minChars] - Minimum query length before fetching.
 * @param {string} [props.type] - Optional BAN type hint.
 * @param {() => void} [props.onFocus] - Optional callback when the search modal opens.
 * @param {() => void} [props.onBlur] - Optional callback when the search modal closes.
 * @param {(recherche: string) => Option[]} [props.optionsSupplementaires] - RECHERCHE-UNIQUE
 *   (25/09) : des lieux proposés AVANT les adresses (départements, régions de l'annuaire),
 *   calculés sur le texte tapé. Absent : le champ ne propose que des adresses, comme avant.
 * @param {boolean} [props.permettreLieuSurCarte] - ADRESSE-CARTE (07/10) : sous la liste,
 *   « Adresse introuvable ? Placez-la sur la carte » (une épingle et un nom ; le lieu rejoint la
 *   base de lieux PUBLIQUE). Seulement pour un champ qui enregistre un lieu public — jamais une
 *   adresse personnelle ni une conversation (témoin lieuSurCarte.appelants.test.js).
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.wrapperStyle]
 * @param {object} [props.styles] - Optional compatibility style prop.
 * @returns {import('react').ReactElement}
 */
function AutocompleteAddressInput({
  address,
  disabled = false,
  error,
  label,
  lightMode = false,
  minChars = 3,
  onBlur,
  onFocus,
  onSelect,
  optionsSupplementaires,
  permettreLieuSurCarte = false,
  placeholder,
  setAddress,
  type,
  wrapperStyle,
}) {
  const DEBOUNCE_MS = 350;
  const safeMinChars = Number.isFinite(minChars) ? Math.max(1, minChars) : 3;

  const { t } = useTranslation();
  const selectRef = useRef(null);
  const [addressSearch, setAddressSearch] = useState('');
  // ADRESSE-CARTE — la carte ouverte, et la 1re proposition au moment de l'ouvrir (son centre).
  const [carte, setCarte] = useState(
    /** @type {{ premierResultat: { lat: number, lng: number } | null } | null} */ (null),
  );
  const [debouncedAddressSearch, setDebouncedAddressSearch] = useState('');
  const [uncontrolledAddress, setUncontrolledAddress] = useState(
    /** @type {Option | undefined} */ (undefined),
  );

  useEffect(() => {
    const nextValue = addressSearch?.trim() || '';
    const debounceTimer = setTimeout(() => {
      setDebouncedAddressSearch(nextValue);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [addressSearch]);

  useEffect(() => {
    if (address !== undefined) {
      setUncontrolledAddress(address);
    }
  }, [address]);

  const { data: places, isLoading } = useGetPlaces({
    options: {
      enabled: debouncedAddressSearch.length >= safeMinChars,
    },
    searchParam: debouncedAddressSearch,
    type,
  });

  const placesOptions = useMemo(() => {
    if (!Array.isArray(places) || places.length === 0) return [];
    return places
      .map(placeToOption)
      .filter((option) => option.label && option.value);
  }, [places]);

  const options = useMemo(() => {
    if (typeof optionsSupplementaires !== 'function') return placesOptions;
    return [...optionsSupplementaires(addressSearch?.trim() || ''), ...placesOptions];
  }, [addressSearch, optionsSupplementaires, placesOptions]);

  const selectedAddress = setAddress ? address : uncontrolledAddress;

  /**
   * @param {Option | Option[] | undefined} selectedValue
   */
  const handleSetValue = useCallback((selectedValue) => {
    const normalized = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
    if (setAddress) {
      setAddress(normalized);
    } else {
      setUncontrolledAddress(normalized);
    }
    onSelect?.(normalized);
  }, [onSelect, setAddress]);

  // ADRESSE-CARTE — le lien se montre une fois la recherche FAITE (frappe posée, réponse rendue),
  // qu'elle ait trouvé ou non : « introuvable » se juge aussi devant une liste qui ne contient pas le lieu.
  const rechercheFaite = debouncedAddressSearch.length >= safeMinChars
    && debouncedAddressSearch === (addressSearch?.trim() || '')
    && !isLoading;
  const lienCarte = permettreLieuSurCarte && rechercheFaite
    ? {
      label: t('autocompleteAddressInput.lieu.lien', 'Adresse introuvable ? Placez-la sur la carte'),
      onPress: () => {
        const premier = placesOptions.find((option) => Number.isFinite(option.lat) && Number.isFinite(option.lng));
        setCarte({ premierResultat: premier ? { lat: Number(premier.lat), lng: Number(premier.lng) } : null });
      },
    }
    : undefined;

  // Le champ garde sa forme d'origine (une constante, même indentation) : seul le lien s'y ajoute.
  const champ = (
    <AutocompleteSelect
      disabled={disabled}
      error={error}
      isLoading={isLoading}
      isSearchable
      label={label || ''}
      lienSousLesOptions={lienCarte}
      lightMode={lightMode}
      onBlur={onBlur}
      onFocus={onFocus}
      options={options}
      placeholder={placeholder}
      ref={selectRef}
      searchValue={addressSearch}
      setSearchValue={setAddressSearch}
      setValue={handleSetValue}
      value={selectedAddress?.label || ''}
      wrapperStyle={wrapperStyle}
    />
  );

  return (
    <>
      {champ}
      <LieuSurCarte
        onFermer={() => setCarte(null)}
        onLieuPose={(place) => {
          setCarte(null);
          handleSetValue(placeToOption(place));
        }}
        premierResultat={carte?.premierResultat || null}
        visible={Boolean(carte)}
      />
    </>
  );
}

export default AutocompleteAddressInput;
