import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';

/**
 * A09 (audit V1, décision d'Adel du 30/09) — LE choix du sport de TOUTE la recherche : clubs
 * (pastille de l'annuaire et feuille « Filtrer »), événements, recrutement (annonces et profils),
 * réservations. « Pour filtrer c'est horrible, vu qu'il y a tous les sports possibles » : la liste
 * alphabétique de ~145 sports, Football en 52e position.
 *
 * Décision d'Adel : « les sports populaires en haut (les sports collectifs : football, basketball,
 * handball, rugby, volleyball), puis une recherche à la main dans tous les sports ». Le geste est
 * celui de l'annuaire, validé le 29/09 (ANNUAIRE-E1) : la recherche, le sport actuel coché, les
 * populaires, puis « Tous les sports, de A à Z » replié. Ce composant EST ce choix, sorti de
 * `PastillesFiltresClub.js` pour être le même partout.
 *
 * Il ne décide que de l'AFFICHAGE : chaque ligne rend la clef du sport à `onChoisir`, et l'appelant
 * dit ce que ce choix veut dire (appliquer aussitôt, retenir dans un brouillon, cocher / décocher
 * avec `basculerSport`). La clef vide `''` veut dire « Tous les sports ».
 *
 * ⚠️ Les doublons de la base (« Canoë-Kayak » / « Canoë-kayak », « Echecs » / « Échecs »,
 * « Equitation » / « Équitation ») restent DEUX lignes : chacun porte ses propres clubs, et la
 * recherche serveur ne sait filtrer que par UN identifiant. Les fondre ici cacherait les clubs de
 * l'autre. La fusion se fait dans la base (lot de données, voir le compte rendu LISTE-ANNONCES).
 */

// ponytail: une liste écrite à la main (décision d'Adel) ; voie de sortie = la trier par les
// recherches réelles quand on les mesurera.
export const SPORTS_POPULAIRES = ['football', 'basketball', 'handball', 'rugby', 'volleyball'];

/**
 * Un nom de sport réduit à ses lettres et chiffres, sans accent ni casse : « Volley-ball »,
 * « volleyball » et « VOLLEYBALL » se valent, « équit » trouve « Équitation ».
 * @param {unknown} nom Le nom.
 * @returns {string} Le nom réduit.
 */
export const compacterNomDeSport = (nom) => String(nom ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

/**
 * Coche ou décoche un sport dans un choix multiple ; la clef vide vide tout.
 * @param {string[]} valeurs Les sports cochés.
 * @param {string} cle Le sport touché (`''` = « Tous les sports »).
 * @returns {string[]} Les sports cochés après le geste.
 */
export const basculerSport = (valeurs, cle) => {
  if (!cle) return [];
  return valeurs.includes(cle) ? valeurs.filter((valeur) => valeur !== cle) : [...valeurs, cle];
};

/**
 * Une ligne de choix, cochée ou non.
 * @param {{ coche: boolean, libelle: string, multiple?: boolean, onPress: () => void }} props
 *   `multiple` : une case à cocher plutôt qu'un bouton radio.
 * @returns {import('react').ReactElement} La ligne.
 */
export function LigneDeChoix({
  coche, libelle, multiple = false, onPress,
}) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  return (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
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
 * Un intertitre en capitales (« SPORT ACTUEL », « SPORTS POPULAIRES »).
 * @param {{ children: string }} props Les props.
 * @returns {import('react').ReactElement} L'intertitre.
 */
export function Intertitre({ children }) {
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
 * Le choix du sport : la recherche, le(s) sport(s) actuel(s) coché(s), les populaires, puis tous
 * les sports de A à Z (replié).
 * @param {{
 *  auFocus?: boolean,
 *  cle?: 'documentId' | 'name',
 *  multiple?: boolean,
 *  onChoisir: (cle: string) => void,
 *  sports: any[] | undefined,
 *  valeurs: string[],
 * }} props `cle` : ce qui identifie un sport pour l'appelant — l'identifiant (clubs, événements,
 *   profils, réservations) ou le NOM (les annonces filtrent par nom). `valeurs` : les clefs
 *   choisies (vide = « Tous les sports »).
 * @returns {import('react').ReactElement} Le choix.
 */
function ChoixDuSport({
  auFocus = false, cle = 'documentId', multiple = false, onChoisir, sports, valeurs,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const [recherche, setRecherche] = useState('');
  const [toutAfficher, setToutAfficher] = useState(false);
  const TOUS_SPORTS = t('clubFiltersSheet.allSports', 'Tous les sports');
  const TOUT_DE_A_A_Z = t('pastillesFiltresClub.sport.all', 'Tous les sports, de A à Z');

  const alphabetiques = useMemo(
    () => (Array.isArray(sports) ? sports : [])
      .filter((sport) => sport?.[cle])
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fr')),
    [cle, sports],
  );
  const populaires = useMemo(() => SPORTS_POPULAIRES
    .map((nom) => alphabetiques.find((sport) => compacterNomDeSport(sport?.name) === nom))
    .filter(Boolean), [alphabetiques]);

  const choisis = valeurs.filter(Boolean);
  const estChoisi = (/** @type {any} */ sport) => choisis.includes(String(sport[cle]));
  const actuels = alphabetiques.filter(estChoisi);
  const terme = compacterNomDeSport(recherche);
  const trouves = terme
    ? alphabetiques.filter((sport) => compacterNomDeSport(sport?.name).includes(terme))
    : [];

  const ligne = (/** @type {any} */ sport) => (
    <LigneDeChoix
      coche={estChoisi(sport)}
      key={String(sport[cle])}
      libelle={sport.name}
      multiple={multiple}
      onPress={() => onChoisir(String(sport[cle]))}
    />
  );
  const ligneTousLesSports = (/** @type {boolean} */ coche) => (
    <LigneDeChoix
      coche={coche}
      libelle={TOUS_SPORTS}
      multiple={multiple}
      onPress={() => onChoisir('')}
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
          <Intertitre>
            {actuels.length > 1
              ? t('pastillesFiltresClub.sport.currentMany', 'Sports choisis')
              : t('pastillesFiltresClub.sport.current', 'Sport actuel')}
          </Intertitre>
          {actuels.length ? actuels.map(ligne) : ligneTousLesSports(true)}
          {populaires.some((sport) => !estChoisi(sport)) ? (
            <Intertitre>{t('pastillesFiltresClub.sport.popular', 'Sports populaires')}</Intertitre>
          ) : null}
          {populaires.filter((sport) => !estChoisi(sport)).map(ligne)}
          {toutAfficher ? (
            <>
              <Intertitre>{TOUT_DE_A_A_Z}</Intertitre>
              {actuels.length ? ligneTousLesSports(false) : null}
              {alphabetiques.map(ligne)}
            </>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setToutAfficher(true)}
              style={[Spaces.paddingHorizontal[4], { justifyContent: 'center', minHeight: 44 }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary300 }]}>{TOUT_DE_A_A_Z}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default ChoixDuSport;
