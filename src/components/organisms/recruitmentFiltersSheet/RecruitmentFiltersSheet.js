import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';

/**
 * La feuille de filtres du pack Rechercher (capture 05).
 *
 * Elle ne refait NI le bouton NI sa pastille : les deux marchent depuis L35 et
 * vivent dans SearchComponent. Elle est seulement ce que ce bouton ouvre.
 *
 * ⚠️ Elle part TOUJOURS de `filters` et ne reecrit que ses propres clefs : la
 * page de filtres complete (RecruitmentAdFilters) en pose deux autres — `section`
 * et `position` — et un payload reconstruit de zero les effacerait en silence.
 *
 * Le rayon autour de la ville que dessine le pack (« Marseille · 25 km ») n'est
 * PAS rendu : `recruitmentAdFilters` ne porte qu'une ville en texte, et le pack
 * demande explicitement de retirer une rangee plutot que de l'afficher morte.
 */

const TOUS_SPORTS = 'Tous les sports';
const TOUTES = 'Toutes';
const TOUS = 'Tous';

/** Les 3 valeurs du filtre « Profil », dans les mots du pack. */
export const AUDIENCE_OPTIONS = /** @type {const} */ ([
  { label: 'Joueur·se·s et coachs', value: 'all' },
  { label: 'Joueur·se·s', value: 'player' },
  { label: 'Coachs', value: 'coach' },
]);

/**
 * Le libelle d'une valeur, ou le repli « tout » quand rien n'est choisi.
 * @param {{ label: string, value: string }[]} options Les choix possibles.
 * @param {string} value La valeur retenue.
 * @param {string} repli Ce qu'on lit quand le filtre est vide.
 * @returns {string} Le libelle a afficher a droite de la rangee.
 */
const libelleDe = (options, value, repli) => (
  options.find((option) => option.value === value)?.label || repli
);

/**
 * La premiere valeur d'un filtre stocke en tableau (`category`, `level`).
 * @param {any} valeur La valeur brute lue dans le contexte.
 * @returns {string} La valeur unique, ou une chaine vide.
 */
const premiereValeur = (valeur) => {
  if (Array.isArray(valeur)) return String(valeur[0] || '');
  return String(valeur || '');
};

// D86 — MEME CORRECTION QUE LE SOCLE `filtersSheet/FiltersSheet.js`, parce que
// ce fichier en est une COPIE : meme feuille, meme titre, memes deux actions,
// et c'est celui qui porte le PLUS de rangees (5). Sans `snapPoints`, la zone
// defilante de `BottomModal` est plafonnee a 70 % de la hauteur d'ECRAN et rien
// ne borne ce qui l'entoure (caracterise par D19 dans
// `BottomModal.debordement.test.js`) : les deux actions, placees en dernier
// dans le defilement, tombaient sous le bord.
// 🧹 La duplication elle-meme reste a traiter : ce fichier devrait consommer le
// socle au lieu de le recopier. C'est un lot a part, avec sa propre recette.
const SNAP_POINTS = ['78%'];

/**
 * @param {{
 *  audienceFilter?: string;
 *  filters?: Record<string, any>;
 *  isVisible: boolean;
 *  onApply: (filters: Record<string, any>, audienceFilter: string) => void;
 *  onClose: () => void;
 *  showAudienceRow?: boolean;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function RecruitmentFiltersSheet({
  audienceFilter = 'all',
  filters = {},
  isVisible,
  onApply,
  onClose,
  showAudienceRow = true,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const { data: activities } = useGetActivities();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();

  // Brouillon : on ne touche a la recherche qu'au « Voir les resultats ».
  const [sport, setSport] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [audience, setAudience] = useState(audienceFilter);
  const [rangeeOuverte, setRangeeOuverte] = useState('');
  const etaitOuverteRef = useRef(false);

  // A chaque OUVERTURE, le brouillon repart de ce que la recherche applique
  // vraiment : sans ca, une feuille fermee sans valider garderait ses choix.
  //
  // ⚠️ Le garde sur la TRANSITION est indispensable, pas decoratif : `filters`
  // arrive du contexte et change de reference a chaque rendu du parent. Sans
  // lui, l'effet rejouait en continu et effacait les choix de l'utilisateur
  // pendant qu'il les faisait — mesure sur ce filet, ou aucune puce ne restait
  // selectionnee.
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (!isVisible) return;
    setSport(String(filters?.sport || ''));
    setCity(String(filters?.city || ''));
    setCategory(premiereValeur(filters?.category));
    setLevel(premiereValeur(filters?.level));
    setAudience(audienceFilter);
    setRangeeOuverte('');
  }, [audienceFilter, filters, isVisible]);

  const sportOptions = useMemo(() => (activities || []).map((/** @type {any} */ activity) => ({
    label: activity.name,
    value: activity.name,
  })), [activities]);

  const categoryOptions = useMemo(() => (categories || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  })), [categories]);

  const levelOptions = useMemo(() => (levels || []).map((/** @type {any} */ item) => ({
    label: item.name,
    value: item.documentId || '',
  })), [levels]);

  const surface = withAlpha(Colors.primary900, 0.6);
  const bordure = withAlpha(Colors.neutral00, 0.13);

  const appliquer = () => {
    onApply(
      {
        ...filters,
        category: category ? [category] : [],
        city: city.trim(),
        level: level ? [level] : [],
        sport,
      },
      audience,
    );
    onClose();
  };

  const reinitialiser = () => {
    setSport('');
    setCity('');
    setCategory('');
    setLevel('');
    setAudience('all');
    onApply({
      ...filters, category: [], city: '', level: [], sport: '',
    }, 'all');
  };

  /**
   * Une rangee-valeur du pack : intitule a gauche, valeur a droite, chevron.
   * @param {string} clef L'identifiant de la rangee.
   * @param {string} intitule Ce qui est ecrit a gauche.
   * @param {string} valeur Ce qui est ecrit a droite.
   * @param {import('react').ReactNode} contenu Ce qui se deplie au toucher.
   * @returns {import('react').ReactElement} La rangee.
   */
  const rendreRangee = (clef, intitule, valeur, contenu) => (
    <View key={clef} style={[Spaces.marginTop[8]]}>
      <TouchableOpacity
        accessibilityLabel={`${intitule} : ${valeur}`}
        accessibilityRole="button"
        onPress={() => setRangeeOuverte(rangeeOuverte === clef ? '' : clef)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[8],
          Spaces.paddingHorizontal[16],
          {
            backgroundColor: surface,
            borderColor: bordure,
            borderRadius: 14,
            borderWidth: 1,
            minHeight: 52,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>{intitule}</Text>
        <Text
          numberOfLines={1}
          style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}
        >
          {valeur}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>›</Text>
      </TouchableOpacity>
      {rangeeOuverte === clef ? (
        <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>{contenu}</View>
      ) : null}
    </View>
  );

  /**
   * La liste de choix d'une rangee depliee, repli « tout » compris.
   * @param {{ label: string, value: string }[]} options Les choix.
   * @param {string} valeur Le choix courant.
   * @param {(valeur: string) => void} choisir Ce qu'on fait d'un choix.
   * @param {string} libelleVide Le libelle du choix « tout ».
   * @returns {import('react').ReactElement} La liste.
   */
  const rendreChoix = (options, valeur, choisir, libelleVide) => (
    <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
      {[{ label: libelleVide, value: '' }, ...options].map((option) => {
        const actif = option.value === valeur;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            key={option.value || 'vide'}
            onPress={() => choisir(option.value)}
            style={[
              Spaces.paddingHorizontal[16],
              {
                backgroundColor: actif ? Colors.primary500 : surface,
                borderColor: actif ? Colors.primary500 : bordure,
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
              },
            ]}
          >
            <Text
              style={[
                Fonts.p4Bold,
                { color: actif ? Colors.primary900 : Colors.neutral200 },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={appliquer}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                minHeight: 52,
              },
            ]}
          >
            <Text style={[Fonts.p1Bold, { color: Colors.primary900 }]}>Voir les résultats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={reinitialiser}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      )}
      headerComponent={<Text style={[Fonts.h3Bold, Fonts.neutral00]}>Filtrer</Text>}
      isVisible={isVisible}
      snapPoints={SNAP_POINTS}
      webPresentation="dialog"
    >
      {/* R07 — MEME RESERVE QUE LE SOCLE `filtersSheet/FiltersSheet.js`, et pour
          la meme raison qu'en D86 : cette feuille est une JUMELLE RECOPIEE du
          socle, elle ne l'importe pas. Sans ce `marginBottom`, une rangee
          depliee s'arrete a 16 pt du trait du pied et « Voir les resultats »
          parait colle au dernier filtre. */}
      <View style={Spaces.marginBottom[16]}>
        {rendreRangee(
          'sport',
          'Sport',
          libelleDe(sportOptions, sport, TOUS_SPORTS),
          rendreChoix(sportOptions, sport, setSport, TOUS_SPORTS),
        )}

        {rendreRangee(
          'city',
          'Ville',
          city.trim() || 'Toutes les villes',
          <Input
            density="compact"
            icon="search"
            onChangeText={setCity}
            placeholder="Ville"
            placeholderTextColor={Colors.neutral300}
            value={city}
          />,
        )}

        {showAudienceRow ? rendreRangee(
          'audience',
          'Profil',
          libelleDe([...AUDIENCE_OPTIONS], audience, AUDIENCE_OPTIONS[0].label),
          (
            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
              {AUDIENCE_OPTIONS.map((option) => {
                const actif = option.value === audience;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => setAudience(option.value)}
                    style={[
                      Spaces.paddingHorizontal[16],
                      {
                        backgroundColor: actif ? Colors.primary500 : surface,
                        borderColor: actif ? Colors.primary500 : bordure,
                        borderRadius: 999,
                        borderWidth: 1,
                        justifyContent: 'center',
                        minHeight: 44,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Fonts.p4Bold,
                        { color: actif ? Colors.primary900 : Colors.neutral200 },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ),
        ) : null}

        {rendreRangee(
          'category',
          'Catégorie',
          libelleDe(categoryOptions, category, TOUTES),
          rendreChoix(categoryOptions, category, setCategory, TOUTES),
        )}

        {rendreRangee(
          'level',
          'Niveau',
          libelleDe(levelOptions, level, TOUS),
          rendreChoix(levelOptions, level, setLevel, TOUS),
        )}

      </View>
    </BottomModal>
  );
}

export default RecruitmentFiltersSheet;
