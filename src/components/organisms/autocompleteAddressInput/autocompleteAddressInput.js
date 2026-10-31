import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { useGetPlaces } from '@/services/places/placesQueries';

import { hasValidLocationCoordinates } from '@/utils/location';

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

// ADRESSE-EN-PREMIER — au-delà, le texte tapé est tronqué dans la ligne « Ajouter « … » » (deux
// lignes sur un téléphone) ; le lecteur d'écran et la carte le reçoivent entier.
const TITRE_MAX = 60;

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
 *   R17-ADRESSE (REC17-008, 19/10) — sur ces mêmes champs : aucune proposition ⇒ « Ton lieu
 *   n'est pas répertorié : place-le sur la carte » et un bouton, d'eux-mêmes (dans la liste,
 *   puis sous le champ) ; le texte tapé survit à la fermeture de la liste jusqu'à ce que la carte
 *   soit proposée, et devient le nom du lieu ; une adresse enregistrée SANS point le dit. Jamais
 *   de texte libre : un lieu public sans point disparaît de la recherche par distance.
 *   ADRESSE-EN-PREMIER (20/10) — la porte vers la carte est la 1re ligne de la liste,
 *   « Ajouter « <texte tapé> » », dès 3 caractères ; plus de lien sous les propositions.
 * @param {string} [props.villeConnue] - R17-ADRESSE : la ville de l'objet (club, Ville, équipe),
 *   où la carte s'ouvre quand le texte tapé ne nomme aucune commune.
 * @param {boolean} [props.vouvoyer] - R17-ADRESSE : l'invitation vouvoie (l'espace de la Ville).
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
  villeConnue = '',
  vouvoyer = false,
  wrapperStyle,
}) {
  const DEBOUNCE_MS = 350;
  const safeMinChars = Number.isFinite(minChars) ? Math.max(1, minChars) : 3;

  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const selectRef = useRef(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [listeOuverte, setListeOuverte] = useState(false);
  // ADRESSE-CARTE — la carte ouverte, et la 1re proposition au moment de l'ouvrir (son centre).
  // R17-ADRESSE — et le texte qui l'a ouverte (nom proposé, commune de départ).
  const [carte, setCarte] = useState(
    /** @type {{ premierResultat: { lat: number, lng: number } | null, texte: string } | null} */
    (null),
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
    // FINITIONS-VILLE (T20 C00g) : la base d'adresses rend parfois DEUX fois la même adresse (même
    // point, même libellé) ; deux lignes identiques s'allumaient ensemble. Une seule ligne.
    // CORR-TEXTES (point 30) : le même libellé revient aussi avec un point à quelques
    // mètres près (notre serveur puis la base nationale) ; deux lignes identiques ne se
    // distinguent pas à l'écran. Le juge est donc le libellé seul, sans casse ni espaces
    // en trop ; la première ligne (la nôtre) est gardée.
    const vues = new Set();
    return places
      .map(placeToOption)
      .filter((option) => option.label && option.value)
      .filter((option) => {
        const cle = String(option.label).trim().replace(/\s+/g, ' ').toLowerCase();
        if (vues.has(cle)) return false;
        vues.add(cle);
        return true;
      });
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
    // R17-ADRESSE — une adresse choisie : le texte gardé a servi.
    if (normalized) setAddressSearch('');
    if (setAddress) {
      setAddress(normalized);
    } else {
      setUncontrolledAddress(normalized);
    }
    onSelect?.(normalized);
  }, [onSelect, setAddress]);

  const handleFocus = useCallback(() => {
    setListeOuverte(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setListeOuverte(false);
    onBlur?.();
  }, [onBlur]);

  // R17-ADRESSE — la carte proposée, le texte gardé a servi : il part dans la carte (le nom).
  const ouvrirCarte = (
    /** @type {string} */ texte,
    /** @type {{ lat: number, lng: number } | null} */ premierResultat,
  ) => {
    setCarte({ premierResultat, texte });
    setAddressSearch('');
  };

  // ADRESSE-CARTE — le lien se montre une fois la recherche FAITE (frappe posée, réponse rendue),
  // qu'elle ait trouvé ou non : « introuvable » se juge aussi devant une liste qui ne contient pas
  // le lieu.
  const texteTape = addressSearch?.trim() || '';
  const rechercheFaite = debouncedAddressSearch.length >= safeMinChars
    && debouncedAddressSearch === texteTape
    && !isLoading;
  // R17-ADRESSE — RIEN de proposé : l'invitation, d'elle-même (plus seulement un lien).
  const aucuneProposition = permettreLieuSurCarte && rechercheFaite && options.length === 0;
  const invitation = vouvoyer
    ? t(
      'autocompleteAddressInput.lieu.invitationVous',
      'Votre lieu n’est pas répertorié : placez-le sur la carte',
    )
    : t(
      'autocompleteAddressInput.lieu.invitation',
      'Ton lieu n’est pas répertorié : place-le sur la carte',
    );
  const libelleOuvrir = t('autocompleteAddressInput.lieu.ouvrir', 'Placer sur la carte');
  // ADRESSE-EN-PREMIER (REC17-008 bis, Adel le 20/10) — « mettre en premier l'adresse qu'on est en
  // train de taper, avec « ajouter cette adresse » […] plutôt que de devoir scroller jusqu'en
  // bas ». Dès que le texte est tapé (sans attendre la recherche), la 1re ligne de la liste ouvre
  // la carte, le texte comme nom ; la carte part de la 1re proposition s'il y en a une (comme le
  // lien du bas qu'elle remplace), sinon de ce qu'on sait (R17-ADRESSE). Une seule porte.
  const ajouter = (/** @type {string} */ texte) => t(
    'autocompleteAddressInput.lieu.ajouter',
    'Ajouter « {{texte}} »',
    { texte },
  );
  let actionEnTete;
  if (permettreLieuSurCarte && texteTape.length >= safeMinChars) {
    let aide = invitation;
    if (!aucuneProposition) {
      aide = vouvoyer
        ? t('autocompleteAddressInput.lieu.ajouterAideVous', 'Placez-le sur la carte')
        : t('autocompleteAddressInput.lieu.ajouterAide', 'Place-le sur la carte');
    }
    actionEnTete = {
      // Le lecteur d'écran lit le texte ENTIER ; l'écran le tronque proprement.
      accessibilityLabel: `${ajouter(texteTape)}. ${aide}`,
      aide,
      onPress: () => {
        const premier = placesOptions.find(
          (option) => Number.isFinite(option.lat) && Number.isFinite(option.lng),
        );
        ouvrirCarte(
          texteTape,
          premier ? { lat: Number(premier.lat), lng: Number(premier.lng) } : null,
        );
      },
      titre: ajouter(texteTape.length > TITRE_MAX
        ? `${texteTape.slice(0, TITRE_MAX - 1).trimEnd()}…`
        : texteTape),
    };
  }

  // R17-ADRESSE — SOUS le champ, liste refermée : le texte tapé qui n'a rien trouvé, ou une
  // adresse enregistrée sans point (elle ne se trouve pas en cherchant autour de soi).
  const libelleEnregistre = selectedAddress?.label
    || /** @type {any} */ (selectedAddress)?.description
    || '';
  let sousLeChamp = null;
  if (permettreLieuSurCarte && !listeOuverte && !carte) {
    if (aucuneProposition) {
      // Liste refermée, le texte tapé n'est plus sous les yeux : la phrase le rappelle (à côté
      // d'une adresse déjà enregistrée, « Ton lieu » seul laissait croire que c'était elle).
      sousLeChamp = {
        ouvrir: () => ouvrirCarte(texteTape, null),
        texte: vouvoyer
          ? t(
            'autocompleteAddressInput.lieu.invitationTexteVous',
            '« {{texte}} » n’est pas répertorié : placez-le sur la carte',
            { texte: texteTape },
          )
          : t(
            'autocompleteAddressInput.lieu.invitationTexte',
            '« {{texte}} » n’est pas répertorié : place-le sur la carte',
            { texte: texteTape },
          ),
      };
    } else if (libelleEnregistre && !hasValidLocationCoordinates(selectedAddress)) {
      sousLeChamp = {
        ouvrir: () => ouvrirCarte(libelleEnregistre, null),
        texte: t(
          'autocompleteAddressInput.lieu.sansPoint',
          'Cette adresse n’est pas sur la carte : on ne la trouve pas en cherchant autour de soi.',
        ),
      };
    }
  }

  // Le champ garde sa forme d'origine (une constante, même indentation) : seul le lien s'y ajoute.
  const champ = (
    <AutocompleteSelect
      actionEnTete={actionEnTete}
      disabled={disabled}
      error={error}
      garderLaRecherche={permettreLieuSurCarte}
      isLoading={isLoading}
      isSearchable
      label={label || ''}
      lightMode={lightMode}
      onBlur={handleBlur}
      onFocus={handleFocus}
      options={options}
      placeholder={placeholder}
      ref={selectRef}
      searchValue={addressSearch}
      setSearchValue={setAddressSearch}
      setValue={handleSetValue}
      // VILLE-INSTALLATION 5 (07/10, tournée T18) : une adresse ENREGISTRÉE revient du serveur
      // en { description, geometry } (pas de `label`) : le champ montrait l'indice sous un
      // « GPS activé ». On lit la même chose que les cartes (description à défaut du libellé).
      value={selectedAddress?.label
        || /** @type {any} */ (selectedAddress)?.description
        || ''}
      wrapperStyle={wrapperStyle}
    />
  );

  return (
    <>
      {champ}
      {sousLeChamp ? (
        <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{sousLeChamp.texte}</Text>
          <Button onPress={sousLeChamp.ouvrir} title={libelleOuvrir} variant="Secondary" />
        </View>
      ) : null}
      <LieuSurCarte
        onFermer={() => setCarte(null)}
        onLieuPose={(place) => {
          setCarte(null);
          handleSetValue(placeToOption(place));
        }}
        premierResultat={carte?.premierResultat || null}
        texteTape={carte?.texte || ''}
        villeConnue={villeConnue}
        visible={Boolean(carte)}
      />
    </>
  );
}

export default AutocompleteAddressInput;
