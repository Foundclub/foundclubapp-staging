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

import FiltersSheet from './FiltersSheet';
import {
  filtresAvecLieu, libelleDuLieu, optionsDeTerritoires, RAYON_PAR_DEFAUT,
} from './lieuDesFiltresClub';

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
  const libelleVille = libelleDuLieu(city, radius, TOUTES_VILLES);

  const optionsTerritoires = useCallback(
    (/** @type {string} */ recherche) => optionsDeTerritoires({ recherche, t, territoires }),
    [t, territoires],
  );

  // ANNUAIRE-E1 : la règle du lieu (territoire sans rayon, ville avec sa zone) vit dans
  // lieuDesFiltresClub.js, partagée avec les pastilles de filtre.
  const appliquer = () => {
    onApply(filtresAvecLieu({
      activity, city, filters, getGeohashForPointAndRadius, radius,
    }));
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
