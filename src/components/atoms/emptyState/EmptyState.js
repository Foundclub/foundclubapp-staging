import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * L'ecran « il n'y a rien ici » : un titre, et tout le reste est facultatif.
 *
 * ⚠️ Le bloc precedent etait auto-genere (`@param root0.actionLabel`, sans type
 * ni crochets), et TypeScript lisait donc les CINQ proprietes comme obligatoires
 * alors que les appelants du depot en omettent trois depuis toujours. Les
 * crochets retablis disent la verite : seul `title` est requis.
 * Comportement fige par `__tests__/EmptyState.test.js` avant cette correction.
 * @param {object} props
 * @param {string} [props.actionLabel] libelle du bouton ; sans lui, aucun bouton
 * @param {string} [props.description] phrase sous le titre
 * @param {any} [props.icon] source d'image de l'illustration
 * @param {() => void} [props.onAction] action du bouton ; sans elle, aucun bouton
 * @param {string} props.title la seule propriete obligatoire
 * @returns {React.ReactElement} l'etat vide rendu
 */
function EmptyState({
  actionLabel,
  description,
  icon, // Can be an image source or icon name if using an icon lib
  onAction,
  title,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[
      ApplicationStyle.backgroundColor.primary900, // Or neutral background
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.gap[16],
      Spaces.padding[24],
      Spaces.marginVertical[24],
    ]}
    >
      {icon && (
      <View style={[Spaces.marginBottom[8]]}>
        <Image
          resizeMode="contain"
          source={icon}
          style={{ height: 80, width: 80 }}
        />
      </View>
      )}
      <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
        {title}
      </Text>
      {description && (
      <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
        {description}
      </Text>
      )}
      {actionLabel && onAction && (
      <View style={[Spaces.marginTop[16]]}>
        <Button
          isOption // Assuming this prop makes it smaller/fit content
          onPress={onAction}
          title={actionLabel}
          variant="SecondaryLight"
        />
      </View>
      )}
    </View>
  );
}

export default EmptyState;
