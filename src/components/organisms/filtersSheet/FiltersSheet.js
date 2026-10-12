import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
 *
 * ⭐ ALERTES (audit V1, A20.4) — trois options, toutes FACULTATIVES :
 *   · `headerAction` se range A DROITE du titre (l'etoile « Creer alerte » de la
 *     feuille des evenements) ;
 *   · `headerNote` se lit SOUS le titre (ce que l'etoile a produit) ;
 *   · `rangeeInitiale` ouvre la feuille sur cette rangee DEPLIEE.
 * Sans elles, l'entete reste le titre seul, au noeud pres : les feuilles club,
 * profil, reservation et recrutement ne changent pas (temoin dans
 * `FiltersSheet.test.js`). Le titre ne passe dans une rangee QUE s'il y a une
 * action, et il y prend `flex: 1` : a sa largeur mesuree, un titre gras de
 * plusieurs mots perdrait son dernier mot sous Android 16.
 *
 * PAR-L10 (12/10) — `applyEnCours`, FACULTATIF : le bouton plein devient « occupé »
 * (désactivé, annoncé au lecteur d'écran) pendant que son action attend le serveur
 * — la création d'une alerte. Sans lui, le bouton est celui d'avant, au noeud près.
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
 *  applyEnCours?: boolean;
 *  applyLabel?: string;
 *  headerAction?: import('react').ReactNode;
 *  headerNote?: import('react').ReactNode;
 *  isVisible: boolean;
 *  onApply: () => void;
 *  onClose: () => void;
 *  onReset: () => void;
 *  rangeeInitiale?: string;
 *  resetLabel?: string;
 *  rows: FilterRow[];
 *  title?: string;
 * }} props Les props.
 * @returns {import('react').ReactElement} La feuille.
 */
function FiltersSheet({
  applyEnCours = false,
  applyLabel = undefined,
  headerAction = undefined,
  headerNote = undefined,
  isVisible,
  onApply,
  onClose,
  onReset,
  rangeeInitiale = undefined,
  resetLabel = undefined,
  rows,
  title = undefined,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { t } = useTranslation();

  const [rangeeOuverte, setRangeeOuverte] = useState('');
  const etaitOuverteRef = useRef(false);

  // A chaque OUVERTURE, la feuille repart repliee. Le garde sur la TRANSITION
  // est indispensable : sans lui, l'effet rejouerait a chaque rendu du parent
  // et refermerait la rangee pendant que l'utilisateur y choisit (defaut reel
  // trouve par D57 sur la feuille du recrutement).
  useEffect(() => {
    if (isVisible === etaitOuverteRef.current) return;
    etaitOuverteRef.current = isVisible;
    if (isVisible) setRangeeOuverte(rangeeInitiale || '');
  }, [isVisible, rangeeInitiale]);

  const surface = withAlpha(Colors.primary900, 0.6);
  const bordure = withAlpha(Colors.neutral00, 0.13);

  const libelleDuTitre = title ?? t('filtersSheet.title', 'Filtrer');
  const titre = <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{libelleDuTitre}</Text>;
  let entete = titre;
  if (headerAction || headerNote) {
    entete = (
      <View style={[Spaces.gap[8]]}>
        {headerAction ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, { flex: 1 }]}>{libelleDuTitre}</Text>
            {headerAction}
          </View>
        ) : titre}
        {headerNote}
      </View>
    );
  }

  return (
    <BottomModal
      androidKeyboardInputMode="adjustPan"
      close={onClose}
      footerComponent={(
        <View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={applyEnCours ? { busy: true, disabled: true } : undefined}
            disabled={applyEnCours || undefined}
            onPress={onApply}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                minHeight: 52,
                ...(applyEnCours ? { opacity: 0.6 } : {}),
              },
            ]}
          >
            {/* ROLES2 — le libellé prend TOUTE la largeur du bouton, centré : rétréci
                à sa largeur mesurée, Android 16 le dessinait plus large et coupait
                « Voir les résultats » en « Voir les ». */}
            <Text
              style={[
                Fonts.p1Bold,
                { alignSelf: 'stretch', color: Colors.primary900, textAlign: 'center' },
              ]}
            >
              {applyLabel ?? t('filtersSheet.apply', 'Voir les résultats')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={onReset}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral200 }]}>
              {resetLabel ?? t('filtersSheet.reset', 'Réinitialiser')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      headerComponent={entete}
      isVisible={isVisible}
      snapPoints={SNAP_POINTS}
      webPresentation="dialog"
    >
      {rows.map((rangee, index) => (
        <View
          key={rangee.key}
          style={[
            Spaces.marginTop[8],
            // R07 — la DERNIERE rangee respire avant le pied colle. Sans elle,
            // une rangee depliee s'arrete a 16 pt du trait du pied (le
            // `contentBottomPadding` de `BottomModal`), et « Voir les
            // resultats » parait colle au dernier filtre (constat d'Adel du
            // 2026-08-13, rangee « Equipe »). ⚠️ FEUILLES-BAS (16/09) : ces 16 pt
            // de `BottomModal` n'arrivaient PAS au telephone (la bibliotheque les
            // jetait) ; depuis ce lot, l'air total vaut 16 + 16. La reserve se pose ICI, dans le
            // contenu defilant, et pas dans `BottomModal` : le meme calcul sert
            // une trentaine d'autres feuilles qui n'ont rien demande.
            index === rows.length - 1 ? Spaces.marginBottom[16] : null,
          ]}
        >
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
