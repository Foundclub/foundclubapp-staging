import Slider from '@react-native-community/slider';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput
  from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetActivities } from '@/services/activity/activityQueries';

import coordonneesDeLaVille from './cityCoordinates';
import FiltersSheet from './FiltersSheet';

/**
 * La feuille de filtres du marche « Reservation », a la forme du pack
 * Rechercher.
 *
 * Elle remplace l'ECRAN plein `ReservationFilters` comme destination du bouton
 * de filtres de la liste. L'ecran lui-meme reste enregistre : l'ecran de carte
 * l'ouvre encore (`SearchMapScreen`), et sa route ne bouge donc pas.
 *
 * ⚠️ Elle part TOUJOURS de `filters` et ne reecrit que ses propres clefs : `q`
 * (le texte de la barre de recherche) et `activitySlug` (les pastilles de sport
 * au-dessus de la liste) vivent dans la MEME poche sans jamais passer par ici.
 * Un payload reconstruit de zero les effacerait — c'est exactement ce que
 * faisait l'ecran plein pour `q` (defaut fige par le filet E6, corrige ici).
 *
 * Le pack dessine cinq rangees ; deux seulement ont un sens ici, plus une
 * troisieme que l'ecran plein proposait et qu'aucun critere ne doit perdre :
 * « Prix maximum ». « Profil », « Categorie » et « Niveau » n'ont aucun
 * equivalent cote reservations, et le pack demande de RETIRER une rangee sans
 * equivalent plutot que de l'afficher grisee.
 */

const TOUS_SPORTS = 'Tous les sports';
const TOUTES_VILLES = 'Toutes les villes';
const SANS_LIMITE = 'Sans limite';
const RAYON_PAR_DEFAUT = 20;

/**
 * Assemble les rangees du marche « Reservation » et les confie a la coquille
 * commune `FiltersSheet`.
 * @param {{
 *  filters?: Record<string, any>;
 *  isVisible: boolean;
 *  onApply: (filters: Record<string, any>) => void;
 *  onClose: () => void;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function ReservationFiltersSheet({
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
  const [maxPrice, setMaxPrice] = useState('');
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
    setCity(filters?.city?.value ? filters.city : undefined);
    setMaxPrice(filters?.maxPrice === undefined || filters?.maxPrice === null
      ? ''
      : String(filters.maxPrice));
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

  const libellePrix = String(maxPrice).trim()
    ? `${String(maxPrice).trim()} €`
    : SANS_LIMITE;

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
      maxPrice,
      radius,
    });
    onClose();
  };

  // « Reinitialiser » vide TOUT, comme le faisait « Effacer les filtres » de
  // l'ecran plein : la barre de recherche partait deja avec le reste.
  const reinitialiser = () => {
    setActivity('');
    setCity(undefined);
    setMaxPrice('');
    setRadius(RAYON_PAR_DEFAUT);
    onApply({});
  };

  const rows = [
    {
      content: (
        <AutocompleteSelect
          isSearchable
          label={t('eventFilters.fields.activity.label', 'Sport')}
          options={sportOptionsFiltrees}
          placeholder={t('eventFilters.fields.activity.placeholder', 'Sélectionne un sport')}
          searchValue={rechercheSport}
          setSearchValue={setRechercheSport}
          setValue={(/** @type {any} */ option) => setActivity(option?.value || '')}
          value={libelleSport}
        />
      ),
      key: 'activity',
      label: t('eventFilters.fields.activity.label', 'Sport'),
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
              rangee Ville (« Marseille · 30 km »). Il reste REGLABLE ici, sur
              la rampe PROPRE A CE MARCHE — 20 a 50 km, de 2 en 2. */}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {`${t(
              'clubFilters.fields.radius.label',
              'Dans un rayon autour de : ',
            )}${String(radius)} km`}
          </Text>
          <Slider
            accessibilityLabel={t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}
            disabled={!city?.value}
            maximumTrackTintColor={Colors.primary700}
            maximumValue={50}
            minimumTrackTintColor={Colors.primary500}
            minimumValue={20}
            onValueChange={setRadius}
            step={2}
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
    {
      content: (
        <Input
          keyboardType="numeric"
          label={t('reservationFilters.fields.maxPrice.label', 'Prix maximum par personne')}
          onChangeText={setMaxPrice}
          placeholder={t('reservationFilters.fields.maxPrice.placeholder', 'Ex: 50')}
          value={String(maxPrice)}
        />
      ),
      key: 'maxPrice',
      label: t('reservationFilters.fields.maxPrice.label', 'Prix maximum par personne'),
      value: libellePrix,
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

export default ReservationFiltersSheet;
