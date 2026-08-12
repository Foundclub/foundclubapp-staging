import Slider from '@react-native-community/slider';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetActivities } from '@/services/activity/activityQueries';

import coordonneesDeLaVille from './cityCoordinates';
import FiltersSheet from './FiltersSheet';

/**
 * La feuille de filtres du marche « Club », a la forme du pack Rechercher.
 *
 * Elle remplace l'ECRAN plein `ClubFilters` comme destination du bouton de
 * filtres de la liste. L'ecran lui-meme reste enregistre : il sert encore au
 * navigateur public et a l'ecran de carte, et sa route ne bouge donc pas.
 *
 * ⚠️ Elle part TOUJOURS de `filters` et ne reecrit que ses propres clefs. La
 * barre de recherche range son texte dans la MEME poche (`name`) : un payload
 * reconstruit de zero l'effacerait a chaque validation.
 *
 * Le pack dessine cinq rangees, mais quatre seulement ont un sens ici. La
 * recherche de clubs ne connait que le sport et la zone (`activity`, `geohash`,
 * `lat`/`lon`/`radius`) : « Profil », « Categorie » et « Niveau » n'ont aucun
 * equivalent cote serveur, et le pack demande de RETIRER une rangee sans
 * equivalent plutot que de l'afficher grisee.
 */

const TOUS_SPORTS = 'Tous les sports';
const TOUTES_VILLES = 'Toutes les villes';
const RAYON_PAR_DEFAUT = 20;

/**
 * @param {{
 *  filters?: Record<string, any>;
 *  isVisible: boolean;
 *  onApply: (filters: Record<string, any>) => void;
 *  onClose: () => void;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function ClubFiltersSheet({
  filters = {},
  isVisible,
  onApply,
  onClose,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: allActivities } = useGetActivities();

  const [activity, setActivity] = useState('');
  const [city, setCity] = useState(/** @type {any} */ (undefined));
  const [radius, setRadius] = useState(RAYON_PAR_DEFAUT);
  const [rechercheSport, setRechercheSport] = useState('');
  const etaitOuverteRef = useRef(false);

  // Le brouillon repart de ce que la recherche applique vraiment a CHAQUE
  // ouverture. Le garde sur la transition est indispensable : `filters` vient
  // du contexte et change de reference a chaque rendu du parent.
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (!isVisible) return;
    setActivity(String(filters?.activity || ''));
    setCity(filters?.city || undefined);
    setRadius(Number(filters?.radius) || RAYON_PAR_DEFAUT);
    setRechercheSport('');
  }, [filters, isVisible]);

  const sportOptions = useMemo(() => (allActivities || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  })), [allActivities]);

  const sportOptionsFiltrees = useMemo(() => {
    const terme = rechercheSport.trim().toLowerCase();
    if (!terme) return sportOptions;
    return sportOptions.filter((option) => option.label.toLowerCase().includes(terme));
  }, [rechercheSport, sportOptions]);

  const libelleSport = useMemo(
    () => sportOptions.find((option) => option.value === activity)?.label || '',
    [activity, sportOptions],
  );

  const libelleVille = city?.label
    ? `${String(city.label)} · ${String(radius)} km`
    : TOUTES_VILLES;

  const appliquer = () => {
    const coordonnees = coordonneesDeLaVille(city);
    const geohash = coordonnees
      ? getGeohashForPointAndRadius(coordonnees.lat, coordonnees.lon, radius)
      : undefined;

    // Une ville retiree doit RETIRER sa zone : laisser trainer l'ancien
    // `geohash` ferait mentir la pastille et filtrerait sur une zone que plus
    // aucun libelle n'annonce.
    onApply({
      ...filters,
      activity,
      city: city || { label: '', value: '' },
      geohash: geohash || undefined,
      lat: coordonnees ? coordonnees.lat : undefined,
      lon: coordonnees ? coordonnees.lon : undefined,
      radius,
    });
    onClose();
  };

  // « Reinitialiser » vide TOUT, comme le faisait « Effacer les filtres » de
  // l'ecran plein : la barre de recherche partait deja avec le reste.
  const reinitialiser = () => {
    setActivity('');
    setCity(undefined);
    setRadius(RAYON_PAR_DEFAUT);
    onApply({});
  };

  const rows = [
    {
      content: (
        <AutocompleteSelect
          isSearchable
          label={t('clubFilters.fields.activity.label', 'Sport')}
          options={sportOptionsFiltrees}
          placeholder={t('clubFilters.fields.activity.placeholder', 'Sélectionne un sport')}
          searchValue={rechercheSport}
          setSearchValue={setRechercheSport}
          setValue={(/** @type {any} */ option) => setActivity(option?.value || '')}
          value={libelleSport}
        />
      ),
      key: 'activity',
      label: t('clubFilters.fields.activity.label', 'Sport'),
      value: libelleSport || TOUS_SPORTS,
    },
    {
      content: (
        <View style={[Spaces.gap[12]]}>
          <AutocompleteAddressInput
            address={city}
            label={t('clubFilters.fields.city.label', 'Ville')}
            placeholder={t('clubFilters.fields.city.placeholder', 'Entre une ville')}
            setAddress={setCity}
          />
          {/* Le rayon n'est plus un reglage a part : le pack le lit dans la
              rangee Ville (« Marseille · 25 km »). Il reste REGLABLE ici, sur
              la meme rampe qu'avant (2 a 50 km, au kilometre pres). */}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {`${t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}${String(radius)} km`}
          </Text>
          <Slider
            accessibilityLabel={t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}
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
      label: t('clubFilters.fields.city.label', 'Ville'),
      value: libelleVille,
    },
  ];

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

export default ClubFiltersSheet;
