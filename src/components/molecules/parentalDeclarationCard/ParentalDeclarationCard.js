import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Checkbox from '@/components/atoms/checkbox/Checkbox';

import {
  MINOR_SELF_DECLARATION_TEXT,
  PARENTAL_DECLARATION_SIGNATORIES,
} from '@/constants/parentalDeclaration';

// La phrase du PARENT (declaration v3, empreinte MINOR_PARENTAL_DECLARATION_TEXT_HASH) : elle
// n'est affichee qu'au parent qui signe depuis le lien (ParentLinkInvite). MINEURS-SUITE (03/10,
// « 3- B ») : corrigee, elle est enfin MOT POUR MOT celle que le serveur empreinte (temoins S4 ici,
// SECUEVENT/V3 ter dans admin). Changer une virgule = une nouvelle version, des deux cotes.
const PARENT_DECLARATION_TEXT = 'Je déclare être le parent ou le représentant légal de cet enfant et utiliser l\'application en son nom.';

/**
 * Le texte a afficher a cote de la case : celui dont la preuve portera l'empreinte.
 * CONSENTEMENT-PHRASE : l'ado par defaut ; le parent seulement quand on le nomme.
 * @param {string} [signatory] - « minor_self » (defaut) ou « parent ».
 * @returns {string} Le texte juridique, non traduit.
 */
export const parentalDeclarationTextFor = (signatory) => (
  signatory === PARENTAL_DECLARATION_SIGNATORIES.PARENT
    ? PARENT_DECLARATION_TEXT
    : MINOR_SELF_DECLARATION_TEXT
);

/**
 *
 * @param root0
 * @param root0.checked
 * @param root0.description
 * @param root0.disabled
 * @param root0.helperText
 * @param root0.onChange
 * @param root0.signatory - Qui coche : l'ado (defaut) ou le parent (lien parent seulement).
 * @param root0.title
 */
function ParentalDeclarationCard({
  checked,
  description = /** @type {string | undefined} */ (undefined),
  disabled = false,
  helperText = '',
  onChange,
  signatory = PARENTAL_DECLARATION_SIGNATORIES.MINOR_SELF,
  title = /** @type {string | undefined} */ (undefined),
}) {
  // I18N-1 : reste en francais. C'est le texte juridique dont le serveur enregistre
  // l'empreinte et la locale fr-FR : le traduire enregistrerait un consentement sur un
  // texte que la personne n'a pas lu.
  // CONSENTEMENT-PHRASE : plus de libelle libre. Le texte affiche se DEDUIT du signataire,
  // pour qu'il soit toujours celui dont la preuve porte l'empreinte.
  const checkboxLabel = parentalDeclarationTextFor(signatory);
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const shownDescription = description === undefined
    ? t(
      'parentalDeclarationCard.description',
      'Tu as moins de 15 ans : un de tes parents (ou ton représentant légal) doit être d’accord '
        + 'pour que tu utilises FoundClub.',
    )
    : description;
  const shownTitle = title === undefined
    ? t('parentalDeclarationCard.title', 'L’accord de tes parents')
    : title;

  return (
    <View
      style={[
        Spaces.gap[16],
        Spaces.padding[16],
        {
          backgroundColor: Colors.neutral800,
          borderColor: checked ? Colors.primary500 : Colors.neutral600,
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {shownTitle}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {shownDescription}
        </Text>
      </View>

      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <Checkbox
          disabled={disabled}
          onValueChange={onChange}
          value={checked}
        />
        <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
          {checkboxLabel}
        </Text>
      </View>

      {helperText ? (
        <Text style={[Fonts.p3, Fonts.warning500]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

export default ParentalDeclarationCard;
