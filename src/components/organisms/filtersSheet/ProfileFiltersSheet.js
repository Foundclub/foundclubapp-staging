import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { getPositionValuesForSport } from '@/constants/positions';

import coordonneesDeLaVille from './cityCoordinates';
import FiltersSheet from './FiltersSheet';

/**
 * La feuille de filtres de la recherche de PROFILS — l'ecran exact que le pack
 * dessine en capture 05 (« Rechercher un profil... », pastille a droite).
 *
 * Elle remplace l'ECRAN plein `MercatoFilters` comme destination du bouton de
 * filtres de la liste de profils. L'ecran reste enregistre : il porte aussi la
 * creation et la modification des ALERTES (`SearchAlerts`), qui ne sont pas ce
 * lot. Sa route ne bouge donc pas.
 *
 * Le pack dessine « Profil » et « Niveau » ; la recherche de profils ne connait
 * ni l'un ni l'autre — ses seuls criteres sont `activity`, `category`, `geohash`
 * et `position`. Le pack demande de RETIRER une rangee sans equivalent cote
 * serveur plutot que de l'afficher grisee : les deux rangees sont donc absentes.
 * ⚠️ A l'inverse, « Poste » existe dans l'ecran actuel et PAS dans le pack : il
 * est conserve tel quel — retirer un critere de recherche ne se decide pas dans
 * un lot d'habillage.
 */

const TOUS_SPORTS = 'Tous les sports';
const TOUTES_VILLES = 'Toutes les villes';
const TOUTES = 'Toutes';
const TOUS = 'Tous';
const RAYON_PAR_DEFAUT = 20;

/**
 * Normalise en tableau de chaines non vides, comme le fait l'ecran plein.
 * @param {unknown} valeur La valeur brute.
 * @returns {string[]} Le tableau.
 */
const enTableau = (valeur) => {
  if (Array.isArray(valeur)) return valeur.map((v) => String(v || '')).filter(Boolean);
  if (typeof valeur === 'string') return valeur ? [valeur] : [];
  return [];
};

/**
 * Les libelles d'une selection multiple, ou le repli « tout ».
 * @param {{ label: string, value: string }[]} options Les choix possibles.
 * @param {string[]} valeurs Les valeurs retenues.
 * @param {string} repli Ce qu'on lit quand rien n'est choisi.
 * @returns {string} Ce qui s'affiche a droite de la rangee.
 */
const libellesDe = (options, valeurs, repli) => {
  const libelles = valeurs
    .map((valeur) => options.find((option) => option.value === valeur)?.label || '')
    .filter(Boolean);
  return libelles.length ? libelles.join(', ') : repli;
};

/**
 * @param {{
 *  filters?: Record<string, any>;
 *  isVisible: boolean;
 *  onApply: (filters: Record<string, any>) => void;
 *  onClose: () => void;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function ProfileFiltersSheet({
  filters = {},
  isVisible,
  onApply,
  onClose,
}) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: allActivities } = useGetActivities();
  const { data: allSections } = useGetSections();

  const [activity, setActivity] = useState(/** @type {string[]} */ ([]));
  const [category, setCategory] = useState(/** @type {string[]} */ ([]));
  const [position, setPosition] = useState(/** @type {string[]} */ ([]));
  const [city, setCity] = useState(/** @type {any} */ (undefined));
  const [radius, setRadius] = useState(RAYON_PAR_DEFAUT);
  const [rechercheSport, setRechercheSport] = useState('');
  const [rechercheCategorie, setRechercheCategorie] = useState('');
  const [recherchePoste, setRecherchePoste] = useState('');
  const etaitOuverteRef = useRef(false);

  // Le brouillon repart de ce que la recherche applique vraiment a CHAQUE
  // ouverture. Le garde sur la transition est indispensable : `filters` vient
  // du contexte et change de reference a chaque rendu du parent.
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (!isVisible) return;
    setActivity(enTableau(filters?.activity || filters?.activityIds));
    setCategory(enTableau(filters?.category || filters?.sectionIds));
    setPosition(enTableau(filters?.position || filters?.positions));
    setCity(filters?.city || undefined);
    setRadius(Number(filters?.radius) || RAYON_PAR_DEFAUT);
    setRechercheSport('');
    setRechercheCategorie('');
    setRecherchePoste('');
  }, [filters, isVisible]);

  const sportOptions = useMemo(() => (allActivities || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  })), [allActivities]);

  const categoryOptions = useMemo(() => (allSections || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  })), [allSections]);

  // Meme source que l'ecran plein : les postes possibles decoulent des sports
  // choisis, et la rangee disparait tant qu'aucun sport n'est retenu.
  const positionOptions = useMemo(() => {
    if (!activity.length || !allActivities) return [];
    const noms = (allActivities || [])
      .filter((/** @type {any} */ item) => activity.includes(String(item.documentId || '')))
      .map((/** @type {any} */ item) => item.name);
    const postes = new Set();
    noms.forEach((/** @type {string} */ nom) => {
      getPositionValuesForSport(nom).forEach((/** @type {string} */ poste) => postes.add(poste));
    });
    return Array.from(postes).map((poste) => ({ label: String(poste), value: String(poste) }));
  }, [activity, allActivities]);

  const filtrer = (/** @type {any[]} */ options, /** @type {string} */ terme) => {
    const propre = terme.trim().toLowerCase();
    if (!propre) return options;
    return options.filter((option) => option.label.toLowerCase().includes(propre));
  };

  const libelleVille = city?.label
    ? `${String(city.label)} · ${String(radius)} km`
    : TOUTES_VILLES;

  const appliquer = () => {
    const coordonnees = coordonneesDeLaVille(city);
    const geohash = coordonnees
      ? getGeohashForPointAndRadius(coordonnees.lat, coordonnees.lon, radius)
      : undefined;

    const activityNames = activity
      .map((id) => sportOptions.find((option) => option.value === id)?.label || '')
      .filter(Boolean);

    // Les memes clefs, dans les memes formes, que l'ecran plein : la liste lit
    // `activityNames || activity`, `sectionIds || category` et
    // `positions || position` — en oublier une viderait le critere en silence.
    onApply({
      ...filters,
      activity,
      activityIds: activity,
      activityNames,
      category,
      city: city || { label: '', value: '' },
      geohash: geohash || undefined,
      position,
      positions: position,
      radius,
      sectionIds: category,
    });
    onClose();
  };

  const reinitialiser = () => {
    setActivity([]);
    setCategory([]);
    setPosition([]);
    setCity(undefined);
    setRadius(RAYON_PAR_DEFAUT);
    onApply({});
  };

  const rows = [
    {
      content: (
        <AutocompleteSelect
          isMulti
          isSearchable
          options={filtrer(sportOptions, rechercheSport)}
          placeholder="Ex: Football, Tennis..."
          searchValue={rechercheSport}
          setSearchValue={setRechercheSport}
          setValue={(/** @type {any} */ option) => {
            setActivity(Array.isArray(option)
              ? option.map((o) => String(o.value))
              : (option?.value ? [String(option.value)] : []));
            setPosition([]);
          }}
          value={activity}
        />
      ),
      key: 'activity',
      label: 'Sport',
      value: libellesDe(sportOptions, activity, TOUS_SPORTS),
    },
    {
      content: (
        <View style={[Spaces.gap[12]]}>
          <AutocompleteAddressInput
            address={city}
            placeholder="Entre une ville"
            setAddress={setCity}
          />
          {/* Le rayon n'est plus un reglage a part : le pack le lit dans la
              rangee Ville (« Marseille · 25 km »). Il reste REGLABLE ici, sur
              la meme rampe qu'avant (2 a 50 km, au kilometre pres). */}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {`Dans un rayon autour de : ${String(radius)} km`}
          </Text>
          <Slider
            accessibilityLabel="Rayon de recherche"
            disabled={!city?.value}
            maximumTrackTintColor={Colors.primary700}
            maximumValue={50}
            minimumTrackTintColor={Colors.primary500}
            minimumValue={2}
            onValueChange={setRadius}
            step={1}
            style={{ height: 44, width: '100%' }}
            tapToSeek
            thumbTintColor={Colors.primary500}
            value={radius}
          />
        </View>
      ),
      key: 'city',
      label: 'Ville',
      value: libelleVille,
    },
    {
      content: (
        <AutocompleteSelect
          isMulti
          isSearchable
          options={filtrer(categoryOptions, rechercheCategorie)}
          placeholder="Ex: Seniors, U17..."
          searchValue={rechercheCategorie}
          setSearchValue={setRechercheCategorie}
          setValue={(/** @type {any} */ option) => setCategory(Array.isArray(option)
            ? option.map((o) => String(o.value))
            : (option?.value ? [String(option.value)] : []))}
          value={category}
        />
      ),
      key: 'category',
      label: 'Catégorie',
      value: libellesDe(categoryOptions, category, TOUTES),
    },
  ];

  if (positionOptions.length) {
    rows.push({
      content: (
        <AutocompleteSelect
          isMulti
          isSearchable
          options={filtrer(positionOptions, recherchePoste)}
          placeholder="Ex: Ailier, Gardien..."
          searchValue={recherchePoste}
          setSearchValue={setRecherchePoste}
          setValue={(/** @type {any} */ option) => setPosition(Array.isArray(option)
            ? option.map((o) => String(o.value))
            : (option?.value ? [String(option.value)] : []))}
          value={position}
        />
      ),
      key: 'position',
      label: 'Poste',
      value: libellesDe(positionOptions, position, TOUS),
    });
  }

  return (
    <FiltersSheet
      isVisible={isVisible}
      onApply={appliquer}
      onClose={onClose}
      onReset={reinitialiser}
      rows={rows}
    />
  );
}

export default ProfileFiltersSheet;
