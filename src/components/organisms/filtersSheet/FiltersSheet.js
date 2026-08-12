import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * La coquille de la feuille de filtres du pack Rechercher (capture 05).
 *
 * Elle porte ce que le pack dessine et qui ne depend d'aucun marche : la
 * poignee (rendue par `BottomModal`), le titre « Filtrer », des rangees-valeur
 * qui deplient leur choix sur place, puis « Voir les resultats » en plein et
 * « Reinitialiser » en texte seul.
 *
 * ⚠️ LES ACTIONS VIVENT DANS UN PIED COLLE, ET C'EST LA DECLARATION DE
 * `snapPoints` QUI LE REND POSSIBLE. Le commentaire d'origine disait l'inverse
 * — il lisait la moitie de la regle. `BottomModal` a DEUX mises en page, et
 * `BottomModal.debordement.test.js` (lot D19) les a deja caracterisees :
 *   · SANS `snapPoints`, la zone defilante est plafonnee a 70 % de la hauteur
 *     d'ECRAN, et rien ne la borne a la place LAISSEE par l'entete et le pied
 *     ⇒ ce qui vient en dernier deborde par le bas.
 *   · AVEC `snapPoints`, cette zone passe en `flex: 1` et prend exactement la
 *     place restante ⇒ l'entete et le pied sont a leur place, toujours.
 * D69 avait tout mis dans le contenu : sur une rangee depliee, « Voir les
 * resultats » et « Reinitialiser » tombaient donc sous le bord (constat d'Adel
 * du 2026-08-12). Le pied les met HORS du defilement : ils ne peuvent plus
 * partir. La reserve pour la barre de gestes est posee par `BottomModal`
 * (`12 + insets.bottom`), elle n'est jamais nulle et un test D19 la fige.
 *
 * ⚠️ `androidKeyboardInputMode="adjustPan"` n'est pas decoratif : une rangee
 * peut contenir un champ de saisie, et sous Android 15 le mode `adjustResize`
 * ne remonte plus la feuille (constat D31, `SelfProfileUnified.js`).
 */

/** @typedef {{ key: string, label: string, value: string, content: import('react').ReactNode }} FilterRow */

// Hauteur fixe de la feuille. Elle est OBLIGATOIRE : c'est elle qui bascule
// `BottomModal` sur sa mise en page a pied colle (cf. le commentaire ci-dessus).
// 78 % est la valeur deja employee par `RecruitmentAdDetails` — sur l'iPhone SE,
// le plus petit ecran vise, cela fait 520 pt, soit exactement la hauteur de la
// feuille repliee la plus fournie (4 rangees). Une rangee depliee defile donc,
// au lieu de pousser les actions dehors.
const SNAP_POINTS = ['78%'];

/**
 * @param {{
 *  applyLabel?: string;
 *  isVisible: boolean;
 *  onApply: () => void;
 *  onClose: () => void;
 *  onReset: () => void;
 *  resetLabel?: string;
 *  rows: FilterRow[];
 *  title?: string;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function FiltersSheet({
  applyLabel = 'Voir les résultats',
  isVisible,
  onApply,
  onClose,
  onReset,
  resetLabel = 'Réinitialiser',
  rows,
  title = 'Filtrer',
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [rangeeOuverte, setRangeeOuverte] = useState('');
  const etaitOuverteRef = useRef(false);

  // A chaque OUVERTURE, la feuille repart repliee. Le garde sur la TRANSITION
  // est indispensable : sans lui, l'effet rejouerait a chaque rendu du parent
  // et refermerait la rangee pendant que l'utilisateur y choisit (defaut reel
  // trouve par D57 sur la feuille du recrutement).
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (isVisible) setRangeeOuverte('');
  }, [isVisible]);

  const surface = withAlpha(Colors.primary900, 0.6);
  const bordure = withAlpha(Colors.neutral00, 0.13);

  return (
    <BottomModal
      androidKeyboardInputMode="adjustPan"
      close={onClose}
      footerComponent={(
        <View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onApply}
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
            <Text style={[Fonts.p1Bold, { color: Colors.primary900 }]}>{applyLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={onReset}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>{resetLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
      headerComponent={<Text style={[Fonts.h3Bold, Fonts.neutral00]}>{title}</Text>}
      isVisible={isVisible}
      snapPoints={SNAP_POINTS}
      webPresentation="dialog"
    >
      {rows.map((rangee) => (
        <View key={rangee.key} style={[Spaces.marginTop[8]]}>
          <TouchableOpacity
            accessibilityLabel={`${rangee.label} : ${rangee.value}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: rangeeOuverte === rangee.key }}
            onPress={() => setRangeeOuverte(rangeeOuverte === rangee.key ? '' : rangee.key)}
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
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>{rangee.label}</Text>
            <Text
              numberOfLines={1}
              style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}
            >
              {rangee.value}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>›</Text>
          </TouchableOpacity>
          {rangeeOuverte === rangee.key ? (
            <View style={[Spaces.marginTop[8], Spaces.gap[8]]}>{rangee.content}</View>
          ) : null}
        </View>
      ))}
    </BottomModal>
  );
}

export default FiltersSheet;
