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
 * ⚠️ Les actions vivent DANS le contenu, pas dans un pied colle : `BottomModal`
 * sans `snapPoints` ne sait pas porter un en-tete ET un pied (piege deja paye
 * par le projet). Le pack les dessine de toute facon a la suite des rangees.
 *
 * ⚠️ `androidKeyboardInputMode="adjustPan"` n'est pas decoratif : une rangee
 * peut contenir un champ de saisie, et sous Android 15 le mode `adjustResize`
 * ne remonte plus la feuille (constat D31, `SelfProfileUnified.js`).
 */

/** @typedef {{ key: string, label: string, value: string, content: import('react').ReactNode }} FilterRow */

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
      isVisible={isVisible}
      webPresentation="dialog"
    >
      <View style={[Spaces.paddingBottom[24]]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{title}</Text>

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

        <TouchableOpacity
          accessibilityRole="button"
          onPress={onApply}
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.marginTop[16],
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
    </BottomModal>
  );
}

export default FiltersSheet;
