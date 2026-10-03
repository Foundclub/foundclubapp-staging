import {
  Image, Platform, Text, TouchableOpacity, View,
} from 'react-native';
// Hooks
import useTheme from '@/theme/themeContext';
// Components
import Loader from '@/components/atoms/loader/Loader';

/**
 * Button component.
 * @param {object} props
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.keepTitleWhileLoading] - ST-MONMATCH : la roue tourne À CÔTÉ du
 *   libellé (« Enregistrement… ») au lieu de le remplacer. Sur demande seulement.
 * @param {boolean} [props.disabled]
 * @param {import('react-native').Insets} [props.hitSlop]
 * @param {string} [props.title]
 * @param {'Primary'|'PrimaryLight'|'Secondary'|'SecondaryLight'|'Ghost'|'Danger'} [props.variant]
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.style]
 * @param {import('react-native').TextStyle | import('react-native').TextStyle[]} [props.textStyle]
 * @param {keyof import('../../../theme/types').AllImages} [props.icon]
 * @param {'before' | 'after'} [props.iconPosition]
 * @param {string} [props.iconColor]
 * @param {(event: import('react-native').GestureResponderEvent) => void} [props.onPress]
 * @param {boolean} [props.isOption]
 * @param {'md' | 'sm' | 'small'} [props.size]
 * @param {string} [props.accessibilityLabel]
 * @param {string} [props.accessibilityHint]
 * @param {import('react-native').AccessibilityRole} [props.accessibilityRole]
 * @param {boolean} [props.submitOnEnter]
 * @returns {import('react').ReactElement}
 */
function Button({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
  hitSlop,
  icon,
  iconColor,
  iconPosition,
  isLoading,
  isOption = false,
  keepTitleWhileLoading = false,
  onPress,
  size = 'md',
  style,
  submitOnEnter = false,
  textStyle,
  title,
  variant = 'Primary',
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  const imageStyle = {
    aspectRatio: 1,
    height: 20,
    tintColor: iconColor || ApplicationStyle[`buttonText${variant}`]?.color,
    width: 20,
  };
  const normalizedSize = size === 'small' ? 'sm' : size;
  const isSmall = normalizedSize === 'sm';
  const sizeStyle = isSmall
    ? {
      borderRadius: 12,
      height: 39,
      paddingHorizontal: 12,
    }
    : null;
  const sizeIconStyle = isSmall
    ? {
      borderRadius: 12,
      height: 39,
      width: 39,
    }
    : null;
  const sizeTextStyle = isSmall ? Fonts.p2Bold : null;
  /** @type {import('react-native').TextStyle} */
  const labelFillStyle = { flexGrow: 1, textAlign: 'center' };
  const isDisabled = isLoading || disabled;

  /**
   * @param {any} event
   */
  const handleKeyDown = (event) => {
    if (Platform.OS !== 'web' || !submitOnEnter || isDisabled || !onPress) {
      return;
    }

    if (event?.key !== 'Enter' && event?.key !== ' ') {
      return;
    }

    event?.preventDefault?.();
    onPress(event);
  };

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      focusable={!isDisabled}
      hitSlop={hitSlop}
      onKeyDown={handleKeyDown}
      onPress={onPress}
      style={[
        ApplicationStyle[`button${variant}${isOption ? 'Option' : ''}`],
        sizeStyle,
        !title && ApplicationStyle[`buttonIcon${isOption ? 'Option' : ''}`],
        !title && sizeIconStyle,
        isDisabled && ApplicationStyle.buttonDisabled,
        style,
      ]}
    >
      {isLoading && !(keepTitleWhileLoading && title)
        ? <Loader color={ApplicationStyle[`buttonText${variant}`]?.color || Colors.primary100} />
        : (
          // FINITIONS (recette Android 16 du 2026-09-28) — la rangée couvre TOUT le
          // bouton et centre son contenu : c'est ce qui permet au libellé seul de
          // s'étirer (voir plus bas) au lieu d'épouser sa largeur mesurée.
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Alignments.selfStretch,
              Alignments.justifyCenter,
              Spaces.gap[12],
              iconPosition === 'before' && Alignments.rowReverse,
            ]}
          >
            {/* ST-MONMATCH (écran 9, état 4) — la roue À CÔTÉ du libellé, sur demande. */}
            {isLoading ? (
              <Loader color={ApplicationStyle[`buttonText${variant}`]?.color || Colors.primary100} />
            ) : null}
            {title ? (
              // ROLES2 — une seule ligne (hauteur fixe) : la police rétrécit
              // jusqu'à 70 % avant que le libellé ne soit coupé d'une ellipse
              // (« Publier la co… », recette Android 16 du 2026-09-28).
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={[
                  Fonts.p1Bold,
                  // FINITIONS — sans icône, le libellé REMPLIT le bouton, centré.
                  // Rétréci à sa largeur mesurée, Android 16 le dessinait plus large
                  // et son dernier mot passait sur une ligne invisible (« Voir la
                  // convocation et les », même en police réduite par ROLES2).
                  // ⛔ `flexGrow`, jamais `flex: 1` : une base nulle ferait tomber
                  // à zéro un bouton dimensionné par son contenu.
                  !icon && labelFillStyle,
                  sizeTextStyle,
                  ApplicationStyle[`buttonText${variant}`],
                  textStyle,
                ]}
              >
                {title}
              </Text>
            ) : null}
            {icon ? (
              <Image
                source={Images[icon]}
                style={imageStyle}
              />
            ) : null}
          </View>
        )}
    </TouchableOpacity>
  );
}

export default Button;
