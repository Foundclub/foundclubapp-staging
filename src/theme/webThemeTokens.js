import Alignments from './alignements';
import generateApplicationStyle from './applicationStyle';
import generateColors from './colors';
import generateFonts, { lineHeights, sizes as fontSizes, staticFontStyle } from './fonts';
import Spaces, { sizes as spacingSizes } from './spaces';

const colors = generateColors();
const fonts = generateFonts(colors);
const applicationStyle = generateApplicationStyle(colors);

export const webThemeTokens = {
  alignments: Alignments,
  applicationStyle,
  colors,
  fonts,
  fontSizes,
  lineHeights,
  spacingSizes,
  staticFontStyle,
  spaces: Spaces,
};

export default webThemeTokens;
