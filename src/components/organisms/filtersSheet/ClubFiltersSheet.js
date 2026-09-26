import Slider from '@react-native-community/slider';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import usePlaces from '@/domains/places/usePlaces';
import useTheme from '@/theme/themeContext';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetTerritoires } from '@/services/annuaire/annuaireQueries';

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

const RAYON_PAR_DEFAUT = 20;

const normaliser = (/** @type {unknown} */ valeur) => String(valeur || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

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
  const TOUS_SPORTS = t('clubFiltersSheet.allSports', 'Tous les sports');
  const TOUTES_VILLES = t('clubFiltersSheet.allCities', 'Toutes les villes');
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data: allActivities } = useGetActivities();
  // RECHERCHE-UNIQUE (phase 3, decision d'Adel du 25/09 « Q2 = B ») : « un seul filtre, où l'on
  // peut mettre autant Marseille que le département Bouches-du-Rhône ». Le champ Lieu propose les
  // départements et régions de l'annuaire AVANT les adresses ; une ville garde son rayon, un
  // département ou une région n'en a pas.
  const { data: territoires } = useGetTerritoires();

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

  const estTerritoire = Boolean(city?.territoire);
  let libelleVille = TOUTES_VILLES;
  if (estTerritoire) {
    libelleVille = String(city.nom || city.label);
  } else if (city?.label) {
    libelleVille = `${String(city.label)} · ${String(radius)} km`;
  }

  const optionsTerritoires = useCallback((/** @type {string} */ recherche) => {
    const terme = normaliser(recherche);
    if (terme.length < 2) return [];
    const correspond = (/** @type {any} */ item) => normaliser(item?.name).includes(terme)
      || normaliser(item?.code) === terme;
    /**
     * Traduit un lieu de l'annuaire en option du champ Lieu.
     * @param {any} item Un département ou une région de l'annuaire.
     * @param {'departement' | 'region'} territoire Son échelle.
     * @returns {any} L'option du champ Lieu.
     */
    const versOption = (item, territoire) => ({
      code: item.code || null,
      label: `${item.name} (${territoire === 'departement'
        ? t('clubFiltersSheet.department', 'département')
        : t('clubFiltersSheet.region', 'région')})`,
      nom: item.name,
      slug: item.slug,
      territoire,
      value: `${territoire}:${item.slug}`,
    });
    const regions = (territoires?.regions || []).filter(correspond).slice(0, 3);
    const departements = (territoires?.departments || []).filter(correspond).slice(0, 5);
    return [
      ...regions.map((item) => versOption(item, 'region')),
      ...departements.map((item) => versOption(item, 'departement')),
    ];
  }, [t, territoires]);

  const appliquer = () => {
    // Un département ou une région n'a ni point ni rayon : la liste lira l'annuaire par son slug.
    if (city?.territoire) {
      onApply({
        ...filters,
        activity,
        city,
        geohash: undefined,
        lat: undefined,
        lon: undefined,
        radius,
      });
      onClose();
      return;
    }
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
            label={t('clubFiltersSheet.place', 'Lieu')}
            optionsSupplementaires={optionsTerritoires}
            placeholder={t('clubFiltersSheet.placePlaceholder', 'Ville, département ou région')}
            setAddress={setCity}
          />
          {/* Le rayon n'est plus un reglage a part : le pack le lit dans la
              rangee Ville (« Marseille · 25 km »). Il reste REGLABLE ici, sur
              la meme rampe qu'avant (2 a 50 km, au kilometre pres). */}
          {estTerritoire ? null : (
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}
              {`${String(radius)} km`}
            </Text>
          )}
          {estTerritoire ? null : (
            <Slider
              accessibilityLabel={t(
                'clubFilters.fields.radius.label',
                'Dans un rayon autour de : ',
              )}
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
          )}
        </View>
      ),
      key: 'city',
      label: t('clubFiltersSheet.place', 'Lieu'),
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
