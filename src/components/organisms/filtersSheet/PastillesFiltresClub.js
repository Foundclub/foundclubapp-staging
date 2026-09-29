import Slider from '@react-native-community/slider';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import usePlaces from '@/domains/places/usePlaces';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
// eslint-disable-next-line max-len -- un chemin de module ne se coupe pas
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetTerritoires } from '@/services/annuaire/annuaireQueries';

import {
  filtresAvecLieu, libelleDuLieu, normaliserLieu, optionsDeTerritoires, RAYON_PAR_DEFAUT,
} from './lieuDesFiltresClub';

// Les types de la bibliothèque du curseur ne se lisent pas comme un composant JSX (erreur TS2786,
// déjà relevée 14 fois dans le dépôt, dont ClubFiltersSheet) : même composant, vu comme tel.
const Curseur = /** @type {any} */ (Slider);

/**
 * ANNUAIRE-E1 (maquette validée par Adel le 29/09) — les deux pastilles écrites de la recherche de
 * clubs : « <Sport> ▾ » et « <Lieu> · <rayon> km ▾ ». Chacune ouvre DIRECTEMENT son choix, sans
 * passer par la fenêtre « Filtrer », et choisir un sport s'applique en UN geste.
 *
 * Décision relayée par le chef le 29/09 (option A) : le même composant sert l'app téléphone ET le
 * site. Seul l'emplacement du choix change :
 *   · téléphone (et site sous 1 024 px) : un panneau du bas (BottomModal) ;
 *   · site sur grand écran : une liste déroulante SOUS la pastille (≤ 420 px), jamais une fenêtre
 *     centrée — c'est la seule partie propre au site.
 */

// Au-delà, le site a la place d'une liste sous la pastille (planche « ordinateur »).
const LARGEUR_LISTE_DEROULANTE = 1024;
const LARGEUR_PANNEAU = 340;

// « Les plus cherchés » : la planche nomme ceux-là. Sans mesure d'audience à ce jour, l'ordre est
// celui des sports aux plus gros annuaires (football, basketball, tennis, handball, rugby).
// ponytail: une liste écrite à la main ; voie de sortie = la trier par les recherches réelles.
const SPORTS_LES_PLUS_CHERCHES = [
  'football', 'basketball', 'tennis', 'handball', 'rugby', 'natation',
];
const NOMBRE_LES_PLUS_CHERCHES = 4;

/**
 * Une ligne de choix, cochée ou non (rôle « radio » : un seul choix à la fois).
 * @param {{ coche: boolean, libelle: string, onPress: () => void }} props Les props.
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeChoix({ coche, libelle, onPress }) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  return (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="radio"
      activeOpacity={0.8}
      // `aria-*` et non `accessibilityState` : react-native-web 0.21 ne traduit plus ce dernier
      // (le site n'aurait su ni la case cochée, ni la pastille ouverte).
      aria-checked={coche}
      onPress={onPress}
      style={[
        Spaces.paddingHorizontal[12],
        {
          alignItems: 'center',
          backgroundColor: coche ? withAlpha(Colors.primary500, 0.14) : 'transparent',
          borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.08),
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: 48,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[coche ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00, { flexShrink: 1 }]}
      >
        {libelle}
      </Text>
      {coche ? <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>✓</Text> : null}
    </TouchableOpacity>
  );
}

/**
 * Un intertitre en capitales (« SPORT ACTUEL », « LES PLUS CHERCHÉS »).
 * @param {{ children: string }} props Les props.
 * @returns {import('react').ReactElement} L'intertitre.
 */
function Intertitre({ children }) {
  const { Colors, Fonts } = /** @type {any} */ (useTheme());
  return (
    <Text
      style={[
        Fonts.p4Bold,
        { color: Colors.neutral300, letterSpacing: 1.2, textTransform: 'uppercase' },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Une pastille écrite, avec son chevron.
 * @param {{
 *  accessibilityLabel: string,
 *  libelle: string,
 *  onPress: () => void,
 *  ouverte: boolean,
 * }} props Les props.
 * @returns {import('react').ReactElement} La pastille.
 */
function Pastille({
  accessibilityLabel, libelle, onPress, ouverte,
}) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const encre = ouverte ? Colors.primary900 : Colors.primary300;
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.85}
      aria-expanded={ouverte}
      onPress={onPress}
      style={[
        Spaces.gap[8],
        Spaces.paddingHorizontal[16],
        {
          alignItems: 'center',
          backgroundColor: ouverte ? Colors.primary500 : withAlpha(Colors.primary500, 0.14),
          borderColor: Colors.primary500,
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          maxWidth: '100%',
          minHeight: 40,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[Fonts.p3Bold, { color: encre, flexShrink: 1 }]}
      >
        {libelle}
      </Text>
      <Text style={[Fonts.p3Bold, { color: encre }]}>▾</Text>
    </TouchableOpacity>
  );
}

/**
 * Le choix du sport : la recherche du panneau, le sport actuel coché, les plus cherchés, puis tous
 * les sports de A à Z. Un appui = le sport est appliqué.
 * @param {{
 *  activites: any[],
 *  activiteActuelle: string,
 *  auFocus: boolean,
 *  onChoisir: (documentId: string) => void,
 * }} props Les props.
 * @returns {import('react').ReactElement} Le contenu du choix.
 */
function ChoixDuSport({
  activiteActuelle, activites, auFocus, onChoisir,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const [recherche, setRecherche] = useState('');
  const [toutAfficher, setToutAfficher] = useState(false);
  const TOUS_SPORTS = t('clubFiltersSheet.allSports', 'Tous les sports');

  const sportsAlphabetiques = useMemo(
    () => [...activites].sort(
      (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fr'),
    ),
    [activites],
  );
  const actuel = activites.find((item) => item?.documentId === activiteActuelle) || null;
  const lesPlusCherches = useMemo(() => SPORTS_LES_PLUS_CHERCHES
    .map((slug) => activites.find((item) => normaliserLieu(item?.name) === slug))
    .filter((item) => item && item.documentId !== activiteActuelle)
    .slice(0, NOMBRE_LES_PLUS_CHERCHES), [activites, activiteActuelle]);
  const terme = normaliserLieu(recherche);
  const trouves = terme
    ? sportsAlphabetiques.filter((item) => normaliserLieu(item?.name).includes(terme))
    : [];

  const ligne = (/** @type {any} */ item) => (
    <LigneDeChoix
      coche={item.documentId === activiteActuelle}
      key={item.documentId}
      libelle={item.name}
      onPress={() => onChoisir(item.documentId)}
    />
  );

  return (
    <View style={[Spaces.gap[12]]}>
      <Input
        autoFocus={auFocus}
        density="default"
        icon="search"
        onChangeText={setRecherche}
        placeholder={t('pastillesFiltresClub.sport.search', 'Rechercher un sport')}
        placeholderTextColor={Colors.neutral300}
        value={recherche}
      />
      {terme ? (
        <View style={[Spaces.gap[8]]}>
          {trouves.length ? trouves.map(ligne) : (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('pastillesFiltresClub.sport.none', 'Aucun sport ne correspond.')}
            </Text>
          )}
        </View>
      ) : (
        <View style={[Spaces.gap[8]]}>
          <Intertitre>{t('pastillesFiltresClub.sport.current', 'Sport actuel')}</Intertitre>
          <LigneDeChoix
            coche
            libelle={actuel?.name || TOUS_SPORTS}
            onPress={() => onChoisir(activiteActuelle)}
          />
          {lesPlusCherches.length ? (
            <Intertitre>{t('pastillesFiltresClub.sport.popular', 'Les plus cherchés')}</Intertitre>
          ) : null}
          {lesPlusCherches.map(ligne)}
          {toutAfficher ? (
            <>
              <Intertitre>
                {t('pastillesFiltresClub.sport.all', 'Tous les sports, de A à Z')}
              </Intertitre>
              {activiteActuelle ? (
                <LigneDeChoix coche={false} libelle={TOUS_SPORTS} onPress={() => onChoisir('')} />
              ) : null}
              {sportsAlphabetiques.map(ligne)}
            </>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setToutAfficher(true)}
              style={[Spaces.paddingHorizontal[4], { justifyContent: 'center', minHeight: 44 }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary300 }]}>
                {t('pastillesFiltresClub.sport.all', 'Tous les sports, de A à Z')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Le choix du lieu : le lieu actuel et son rayon (réglable sur place), une autre ville, un
 * département ou une région, ou toute la France.
 * @param {{
 *  filters: Record<string, any>,
 *  onChoisir: (city: any) => void,
 *  onRayon: (rayon: number) => void,
 *  rayon: number,
 * }} props Les props.
 * @returns {import('react').ReactElement} Le contenu du choix.
 */
function ChoixDuLieu({
  filters, onChoisir, onRayon, rayon,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const libelleDuRayon = t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ');
  const { data: territoires } = useGetTerritoires();
  const [rayonAffiche, setRayonAffiche] = useState(rayon);
  const city = filters?.city;
  const aUnLieu = Boolean(city?.territoire || city?.label);
  const estUneVille = Boolean(!city?.territoire && city?.value);

  useEffect(() => { setRayonAffiche(rayon); }, [rayon]);

  const optionsTerritoires = useCallback(
    (/** @type {string} */ recherche) => optionsDeTerritoires({ recherche, t, territoires }),
    [t, territoires],
  );

  return (
    <View style={[Spaces.gap[12]]}>
      {aUnLieu ? (
        <View style={[Spaces.gap[8]]}>
          <Intertitre>{t('pastillesFiltresClub.place.current', 'Lieu actuel')}</Intertitre>
          <LigneDeChoix
            coche
            libelle={libelleDuLieu(city, rayonAffiche, '')}
            onPress={() => onChoisir(city)}
          />
          {estUneVille ? (
            <>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {libelleDuRayon}
                {`${String(rayonAffiche)} km`}
              </Text>
              <Curseur
                accessibilityLabel={libelleDuRayon}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={2}
                onSlidingComplete={(/** @type {number} */ v) => onRayon(Math.round(Number(v)))}
                onValueChange={(/** @type {number} */ v) => setRayonAffiche(Math.round(Number(v)))}
                step={1}
                style={{ height: 44, width: '100%' }}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={rayon}
              />
            </>
          ) : null}
        </View>
      ) : null}
      <AutocompleteAddressInput
        label={t('pastillesFiltresClub.place.other', 'Un autre lieu')}
        optionsSupplementaires={optionsTerritoires}
        placeholder={t('clubFiltersSheet.placePlaceholder', 'Ville, département ou région')}
        setAddress={(lieu) => { if (lieu) onChoisir(lieu); }}
      />
      {aUnLieu ? (
        <LigneDeChoix
          coche={false}
          libelle={t('pastillesFiltresClub.place.everywhere', 'Toute la France')}
          onPress={() => onChoisir(undefined)}
        />
      ) : null}
    </View>
  );
}

/**
 * Les deux pastilles de filtre de la recherche de clubs.
 * @param {{
 *  filters?: Record<string, any> | null,
 *  onApply: (filters: Record<string, any>) => void,
 * }} props Les props.
 * @returns {import('react').ReactElement} Les pastilles et leur choix.
 */
function PastillesFiltresClub({ filters, onApply }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { width } = useWindowDimensions();
  const { getGeohashForPointAndRadius } = usePlaces();
  const { data } = useGetActivities();
  const activites = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [ouvert, setOuvert] = useState(/** @type {'sport' | 'lieu' | null} */ (null));
  const enListeDeroulante = Platform.OS === 'web' && width >= LARGEUR_LISTE_DEROULANTE;
  const fermer = useCallback(() => setOuvert(null), []);

  // Sur le site, la touche Échap referme le choix ouvert.
  useEffect(() => {
    if (Platform.OS !== 'web' || !ouvert || typeof document === 'undefined') return undefined;
    const surTouche = (/** @type {KeyboardEvent} */ evenement) => {
      if (evenement.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [fermer, ouvert]);

  const activiteActuelle = String(filters?.activity || '');
  const rayon = Number(filters?.radius) || RAYON_PAR_DEFAUT;
  const libelleSport = activites.find((item) => item?.documentId === activiteActuelle)?.name
    || t('clubFiltersSheet.allSports', 'Tous les sports');
  const toutesLesVilles = t('clubFiltersSheet.allCities', 'Toutes les villes');
  const libelleLieu = libelleDuLieu(filters?.city, rayon, toutesLesVilles);
  // Le nom dit l'ACTION, et se distingue des rangées « Sport : … » / « Lieu : … » de la feuille
  // « Filtrer », toujours ouverte par le bouton du champ.
  const libelleDuSport = t('pastillesFiltresClub.sport.pill', 'Filtrer par sport');
  const libelleDuLieuChoisi = t('pastillesFiltresClub.place.pill', 'Filtrer par lieu');

  const choisirSport = (/** @type {string} */ documentId) => {
    fermer();
    if (documentId === activiteActuelle) return;
    onApply({ ...(filters || {}), activity: documentId });
  };
  const appliquerLieu = (/** @type {any} */ city, /** @type {number} */ nouveauRayon) => {
    onApply(filtresAvecLieu({
      activity: activiteActuelle, city, filters, getGeohashForPointAndRadius, radius: nouveauRayon,
    }));
  };
  const choisirLieu = (/** @type {any} */ city) => {
    fermer();
    appliquerLieu(city, rayon);
  };

  const titre = ouvert === 'sport'
    ? t('pastillesFiltresClub.sport.title', 'Choisir un sport')
    : t('pastillesFiltresClub.place.title', 'Choisir un lieu');
  /** @type {import('react').ReactElement | null} */
  let contenu = null;
  if (ouvert === 'sport') {
    contenu = (
      <ChoixDuSport
        activiteActuelle={activiteActuelle}
        activites={activites}
        // Sur le téléphone natif, le clavier recouvrirait la liste dès l'ouverture de la feuille :
        // le focus automatique est réservé au site (maquette : « la recherche prend le focus »).
        auFocus={Platform.OS === 'web'}
        onChoisir={choisirSport}
      />
    );
  } else if (ouvert === 'lieu') {
    // Monté seulement à l'ouverture : la liste des départements et régions n'est demandée qu'alors.
    contenu = (
      <ChoixDuLieu
        filters={filters || {}}
        onChoisir={choisirLieu}
        onRayon={(nouveauRayon) => appliquerLieu(filters?.city, nouveauRayon)}
        rayon={rayon}
      />
    );
  }
  const testID = ouvert === 'sport' ? 'choix-sport' : 'choix-lieu';

  const entete = (
    <View
      style={[
        Spaces.gap[12],
        { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
      ]}
    >
      <Text style={[Fonts.h4, Fonts.neutral00, { flexShrink: 1 }]}>{titre}</Text>
      <TouchableOpacity
        accessibilityLabel={t('common.close', 'Fermer')}
        accessibilityRole="button"
        onPress={fermer}
        style={{
          alignItems: 'center',
          backgroundColor: withAlpha(Colors.neutral00, 0.08),
          borderRadius: 22,
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const listeDeroulante = (/** @type {'sport' | 'lieu'} */ pour) => (
    enListeDeroulante && ouvert === pour ? (
      <View
        style={[
          Spaces.gap[12],
          Spaces.padding[12],
          {
            backgroundColor: Colors.primary800,
            borderColor: Colors.primary700,
            borderRadius: 16,
            borderWidth: 1,
            boxShadow: `0 18px 44px ${withAlpha(Colors.neutral900, 0.6)}`,
            left: 0,
            marginTop: 8,
            maxWidth: LARGEUR_PANNEAU,
            position: 'absolute',
            top: '100%',
            width: LARGEUR_PANNEAU,
            zIndex: 3,
          },
        ]}
        testID={testID}
      >
        {entete}
        {contenu}
      </View>
    ) : null
  );

  return (
    // Au-dessus de la liste qui suit : sans ce `zIndex`, la liste déroulante passerait DESSOUS
    // les cartes (chaque boîte du site ouvre son propre plan d'empilement).
    <View
      style={[Spaces.gap[8], { flexDirection: 'row', flexWrap: 'wrap', zIndex: ouvert ? 5 : 1 }]}
    >
      {enListeDeroulante && ouvert ? (
        // Un clic en dehors referme la liste.
        <Pressable
          accessibilityLabel={t('common.close', 'Fermer')}
          onPress={fermer}
          style={{
            bottom: 0, left: 0, position: /** @type {any} */ ('fixed'), right: 0, top: 0, zIndex: 2,
          }}
        />
      ) : null}
      <View style={{ maxWidth: '100%', zIndex: ouvert === 'sport' ? 3 : 1 }}>
        <Pastille
          accessibilityLabel={`${libelleDuSport} — ${libelleSport}`}
          libelle={libelleSport}
          onPress={() => setOuvert(ouvert === 'sport' ? null : 'sport')}
          ouverte={ouvert === 'sport'}
        />
        {listeDeroulante('sport')}
      </View>
      <View style={{ maxWidth: '100%', zIndex: ouvert === 'lieu' ? 3 : 1 }}>
        <Pastille
          accessibilityLabel={`${libelleDuLieuChoisi} — ${libelleLieu}`}
          libelle={libelleLieu}
          onPress={() => setOuvert(ouvert === 'lieu' ? null : 'lieu')}
          ouverte={ouvert === 'lieu'}
        />
        {listeDeroulante('lieu')}
      </View>
      {!enListeDeroulante ? (
        <BottomModal
          androidKeyboardInputMode="adjustPan"
          close={fermer}
          headerComponent={entete}
          isVisible={Boolean(ouvert)}
        >
          <View testID={testID}>{contenu}</View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default PastillesFiltresClub;
