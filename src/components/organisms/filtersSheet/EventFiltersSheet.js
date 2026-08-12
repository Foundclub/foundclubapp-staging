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
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClubs } from '@/services/club/clubQueries';
import { useGetEventTypes } from '@/services/event/eventQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import coordonneesDeLaVille from './cityCoordinates';
import FiltersSheet from './FiltersSheet';

/**
 * La feuille de filtres du marche « Evenement », a la forme du pack Rechercher.
 *
 * Elle remplace l'ECRAN plein `EventFilters` comme destination du bouton de
 * filtres de la liste. L'ecran lui-meme reste enregistre, et ce n'est pas un
 * oubli : il porte AUSSI la creation et la modification des ALERTES
 * (`SearchAlerts` l'ouvre avec `createAlertMode` / `editAlertMode`), et
 * l'ecran de carte l'ouvre encore. Sa route ne bouge donc pas.
 *
 * ⚠️ Elle part TOUJOURS de `filters` et ne reecrit que ses propres clefs. Deux
 * poches vivent dans le MEME objet sans jamais passer par cette feuille : `q`
 * (le texte de la barre de recherche) et les bornes de dates. Un payload
 * reconstruit de zero les effacerait — c'est exactement ce que faisait l'ecran
 * plein pour `q` (defaut fige par le filet E6, corrige ici).
 *
 * Le pack dessine cinq rangees ; trois de plus sont gardees ici parce que
 * l'ecran plein les proposait et qu'aucun critere ne doit se perdre :
 * « Type d'evenement », « Club » et « Equipe ». La rangee « Profil » du pack,
 * elle, n'a aucun equivalent cote evenements : le pack demande de RETIRER une
 * rangee sans equivalent plutot que de l'afficher grisee.
 */

const TOUS_SPORTS = 'Tous les sports';
const TOUTES_VILLES = 'Toutes les villes';
const TOUTES = 'Toutes';
const TOUS = 'Tous';
const RAYON_PAR_DEFAUT = 20;

/** @typedef {{ label: string, value: string }} Option */

/**
 * Les valeurs d'un critere a choix multiple, toujours rendues en tableau :
 * l'ecran plein deposait tantot une chaine, tantot un tableau.
 * @param {any} valeur La valeur rangee dans les filtres.
 * @returns {string[]} Les identifiants.
 */
const enTableau = (valeur) => {
  if (Array.isArray(valeur)) return valeur.map(String).filter(Boolean);
  if (typeof valeur === 'string' && valeur) return [valeur];
  return [];
};

/**
 * @param {any[]} options Les options connues.
 * @param {string[]} valeurs Les identifiants retenus.
 * @param {string} repli Le mot affiche quand rien n'est retenu.
 * @returns {string} Le libelle de la rangee.
 */
const libelleDeLaSelection = (options, valeurs, repli) => {
  if (valeurs.length === 0) return repli;
  const noms = valeurs
    .map((valeur) => options.find((option) => option.value === valeur)?.label)
    .filter(Boolean);
  if (noms.length === 0) return repli;
  return noms.join(' · ');
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
function EventFiltersSheet({
  filters = {},
  isVisible,
  onApply,
  onClose,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { getGeohashForPointAndRadius } = usePlaces();

  const [activity, setActivity] = useState(/** @type {string[]} */ ([]));
  const [category, setCategory] = useState(/** @type {string[]} */ ([]));
  const [city, setCity] = useState(/** @type {any} */ (undefined));
  const [club, setClub] = useState(/** @type {Option | null} */ (null));
  const [level, setLevel] = useState(/** @type {string[]} */ ([]));
  const [radius, setRadius] = useState(RAYON_PAR_DEFAUT);
  const [team, setTeam] = useState(/** @type {Option | null} */ (null));
  const [type, setType] = useState(/** @type {string[]} */ ([]));

  const [rechercheSport, setRechercheSport] = useState('');
  const [rechercheCategorie, setRechercheCategorie] = useState('');
  const [rechercheClub, setRechercheClub] = useState('');
  const [rechercheNiveau, setRechercheNiveau] = useState('');
  const [rechercheType, setRechercheType] = useState('');
  const [rechercheEquipe, setRechercheEquipe] = useState('');

  const etaitOuverteRef = useRef(false);

  // Le brouillon repart de ce que la recherche applique vraiment a CHAQUE
  // ouverture. Le garde sur la transition est indispensable : `filters` vient
  // du contexte et change de reference a chaque rendu du parent.
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (!isVisible) return;
    setActivity(enTableau(filters?.activity));
    setCategory(enTableau(filters?.category));
    setCity(filters?.city?.value ? filters.city : undefined);
    setClub(filters?.club || null);
    setLevel(enTableau(filters?.level));
    setRadius(Number(filters?.radius) || RAYON_PAR_DEFAUT);
    setTeam(filters?.team?.value ? filters.team : null);
    setType(enTableau(filters?.type));
    setRechercheSport('');
    setRechercheCategorie('');
    setRechercheClub('');
    setRechercheNiveau('');
    setRechercheType('');
    setRechercheEquipe('');
  }, [filters, isVisible]);

  const { data: allActivities } = useGetActivities();
  const { data: allCategories } = useGetCategories();
  const { data: allLevels } = useGetLevels();
  const { data: allTypes } = useGetEventTypes();
  const { data: clubPages } = useGetClubs(
    { name: rechercheClub || undefined },
    { enabled: true },
  );
  const { data: teamPages } = useGetTeams(
    { clubId: club?.value || undefined },
    { enabled: !!club?.value },
  );

  /**
   * @param {any} collection La reponse du service.
   * @returns {Option[]} Les options.
   */
  const enOptions = (collection) => (collection || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  }));

  const sportOptions = useMemo(() => enOptions(allActivities), [allActivities]);
  const categorieOptions = useMemo(() => enOptions(allCategories), [allCategories]);
  const niveauOptions = useMemo(() => enOptions(allLevels), [allLevels]);
  const typeOptions = useMemo(() => enOptions(allTypes), [allTypes]);
  const clubOptions = useMemo(
    () => enOptions(clubPages?.pages?.[0]?.data),
    [clubPages],
  );
  const equipeOptions = useMemo(
    () => enOptions(teamPages?.pages?.[0]?.data),
    [teamPages],
  );

  /**
   * @param {Option[]} options Les options.
   * @param {string} terme Le texte tape.
   * @returns {Option[]} Les options retenues.
   */
  const filtrer = (options, terme) => {
    const recherche = terme.trim().toLowerCase();
    if (!recherche) return options;
    return options.filter((option) => option.label.toLowerCase().includes(recherche));
  };

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
      category,
      city: city || { label: '', value: '' },
      club,
      geohash: geohash || undefined,
      lat: coordonnees ? coordonnees.lat : undefined,
      level,
      lon: coordonnees ? coordonnees.lon : undefined,
      radius,
      team,
      teamIds: team?.value ? [team.value] : null,
      type,
    });
    onClose();
  };

  // « Reinitialiser » vide TOUT, comme le faisait « Effacer les filtres » de
  // l'ecran plein : la barre de recherche partait deja avec le reste.
  const reinitialiser = () => {
    setActivity([]);
    setCategory([]);
    setCity(undefined);
    setClub(null);
    setLevel([]);
    setRadius(RAYON_PAR_DEFAUT);
    setTeam(null);
    setType([]);
    onApply({});
  };

  /**
   * Une rangee a choix multiple : meme forme pour Sport, Categorie, Niveau et
   * Type. Le pack les veut toutes identiques, seul le contenu change.
   * @param {{
   *  cle: string; libelle: string; options: Option[]; placeholder: string;
   *  recherche: string; repli: string; setRecherche: (valeur: string) => void;
   *  setValeurs: (valeurs: string[]) => void; valeurs: string[];
   * }} config La rangee a batir.
   * @returns {any} La rangee.
   */
  const rangeeMultiple = ({
    cle, libelle, options, placeholder, recherche, repli, setRecherche, setValeurs, valeurs,
  }) => ({
    content: (
      <AutocompleteSelect
        isMulti
        isSearchable
        label={libelle}
        options={filtrer(options, recherche)}
        placeholder={placeholder}
        searchValue={recherche}
        setSearchValue={setRecherche}
        setValue={(/** @type {any} */ option) => setValeurs(
          Array.isArray(option)
            ? option.map((/** @type {any} */ o) => o.value)
            : enTableau(option?.value),
        )}
        value={/** @type {any} */ (valeurs)}
      />
    ),
    key: cle,
    label: libelle,
    value: libelleDeLaSelection(options, valeurs, repli),
  });

  const rows = [
    rangeeMultiple({
      cle: 'activity',
      libelle: t('eventFilters.fields.activity.label', 'Sport'),
      options: sportOptions,
      placeholder: t('eventFilters.fields.activity.placeholder', 'Sélectionner un sport'),
      recherche: rechercheSport,
      repli: TOUS_SPORTS,
      setRecherche: setRechercheSport,
      setValeurs: setActivity,
      valeurs: activity,
    }),
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
              la rampe PROPRE A CE MARCHE — 5 a 50 km, de 2 en 2. Chaque marche
              a la sienne (le club va de 2 en 2 au kilometre pres) : la copier
              d'une feuille a l'autre changerait un filtre en silence. */}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {`${t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}${String(radius)} km`}
          </Text>
          <Slider
            accessibilityLabel={t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}
            disabled={!city?.value}
            maximumTrackTintColor={Colors.primary700}
            maximumValue={50}
            minimumTrackTintColor={Colors.primary500}
            minimumValue={5}
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
    rangeeMultiple({
      cle: 'category',
      libelle: t('eventFilters.fields.category.label', 'Catégorie'),
      options: categorieOptions,
      placeholder: t('eventFilters.fields.category.placeholder', 'Sélectionner une catégorie'),
      recherche: rechercheCategorie,
      repli: TOUTES,
      setRecherche: setRechercheCategorie,
      setValeurs: setCategory,
      valeurs: category,
    }),
    rangeeMultiple({
      cle: 'level',
      libelle: t('eventFilters.fields.level.label', 'Niveau'),
      options: niveauOptions,
      placeholder: t('eventFilters.fields.level.placeholder', 'Sélectionner un niveau'),
      recherche: rechercheNiveau,
      repli: TOUS,
      setRecherche: setRechercheNiveau,
      setValeurs: setLevel,
      valeurs: level,
    }),
    rangeeMultiple({
      cle: 'type',
      libelle: t('eventFilters.fields.type.label', "Type d'événement"),
      options: typeOptions,
      placeholder: t('eventFilters.fields.type.placeholder', "Sélectionner un type d'événement"),
      recherche: rechercheType,
      repli: TOUS,
      setRecherche: setRechercheType,
      setValeurs: setType,
      valeurs: type,
    }),
    {
      content: (
        <AutocompleteSelect
          isSearchable
          label={t('eventFilters.fields.club.label', 'Club')}
          options={clubOptions}
          placeholder={t('eventFilters.fields.club.placeholder', 'Sélectionner un club')}
          searchValue={rechercheClub}
          setSearchValue={setRechercheClub}
          setValue={(/** @type {any} */ option) => {
            setClub(option || null);
            // Changer de club invalide l'equipe : elle appartenait a l'autre.
            setTeam(null);
          }}
          value={club?.label || ''}
        />
      ),
      key: 'club',
      label: t('eventFilters.fields.club.label', 'Club'),
      value: club?.label || TOUS,
    },
    {
      content: (
        <AutocompleteSelect
          disabled={!club?.value}
          isSearchable
          label={t('eventFilters.fields.team.label', 'Équipe')}
          options={filtrer(equipeOptions, rechercheEquipe)}
          placeholder={club?.value
            ? t('eventFilters.fields.team.placeholder', 'Sélectionner une équipe')
            : t('eventFilters.fields.team.selectClubFirst', 'Sélectionner un club avant l\'équipe')}
          searchValue={rechercheEquipe}
          setSearchValue={setRechercheEquipe}
          setValue={(/** @type {any} */ option) => setTeam(option || null)}
          value={team?.label || ''}
        />
      ),
      key: 'team',
      label: t('eventFilters.fields.team.label', 'Équipe'),
      value: team?.label || TOUTES,
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

export default EventFiltersSheet;
