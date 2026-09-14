import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Checkbox from '@/components/atoms/checkbox/Checkbox';

/**
 *
 * @param root0
 * @param root0.checkboxLabel
 * @param root0.checked
 * @param root0.description
 * @param root0.disabled
 * @param root0.helperText
 * @param root0.onChange
 * @param root0.title
 */
function ParentalDeclarationCard({
  // I18N-1 : reste en francais. C'est le texte juridique dont le serveur enregistre
  // l'empreinte (MINOR_PARENTAL_DECLARATION_TEXT_HASH) et la locale fr-FR : le
  // traduire enregistrerait un consentement sur un texte que la personne n'a pas lu.
  checkboxLabel = 'Je déclare être le parent ou le représentant legal de cet enfant et utiliser l application en son nom.',
  checked,
  description = /** @type {string | undefined} */ (undefined),
  disabled = false,
  helperText = '',
  onChange,
  title = /** @type {string | undefined} */ (undefined),
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const shownDescription = description === undefined
    ? t(
      'parentalDeclarationCard.description',
      'Ce profil concerne un enfant de moins de 15 ans. Pour continuer, tu dois confirmer que tu '
        + 'es son parent ou représentant légal.',
    )
    : description;
  const shownTitle = title === undefined
    ? t('parentalDeclarationCard.title', 'Déclaration parentale obligatoire')
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
