/* eslint-disable no-unused-vars */
import { colors } from './colors';
import { sizes, staticFontStyle } from './fonts';
import { sizes as spaces, types } from './spaces';
import { images } from './images';
import { staticStyle } from './applicationStyle';
import getButtonStyle from './components/buttonStyle';

/**
 * @typedef {typeof colors} AllColors
 */

/**
 * @typedef {keyof AllColors} ColorNames
 */

/**
 * @typedef {{[key in keyof AllColors] : string}} Colors
 */

/**
 * @typedef {typeof sizes} AllFontSizes
 */

/**
 * @typedef {typeof staticFontStyle} AllStaticFontSizes
 */

/**
 * @typedef {{[key in keyof AllFontSizes] : import('react-native').ViewStyle}} FontSizes
 */

/**
 * @typedef {Record<ColorNames, import('react-native').StyleProp<any>>} StyleWithColors
 */

/**
 * @typedef {{[key in keyof AllStaticFontSizes] : object}} StaticFontStyle
 */

/**
 * @typedef {keyof typeof spaces} SpaceSizes
 */

/**
 * @typedef  {keyof typeof types} SpaceTypes
 */

/**
 * @typedef {Record<SpaceTypes, Record<SpaceSizes,  import('react-native').ViewStyle>>} Spaces
 */

/**
 * @typedef {typeof staticStyle} StaticStyle
 */

/**
 * @typedef {import('react-native').ColorSchemeName} ColorScheme
 */

/**
 * @typedef {typeof images} AllImages
 */

/**
 * @typedef {{ [key in keyof AllImages] : import('react-native').ImageSourcePropType }} Images
 */

/**
 * @typedef {object} NavigationStyle
 * @property { import('@react-navigation/native').Theme
 * } darkNavigationTheme - The dark navigation theme.
 * @property { import('@react-navigation/native').Theme
 * } lightNavigationTheme - The light navigation theme.
 */

/**
 * @typedef {ReturnType<getButtonStyle>} AllButtonStyle
 */

/**
 * @typedef {{[key in keyof AllButtonStyle] : import('react-native').ViewStyle
 *  & import('react-native').TextStyle}} ButtonComponentStyle
 */

/**
 * @typedef {StaticStyle & {
 * borderColor: StyleWithColors, backgroundColor : StyleWithColors, tintColor : StyleWithColors
 * } & NavigationStyle & ButtonComponentStyle
 * } ApplicationStyle
 */
