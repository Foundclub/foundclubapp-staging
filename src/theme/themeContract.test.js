import Alignments from '@/theme/alignements';
import generateApplicationStyle from '@/theme/applicationStyle';
import getThemeColors from '@/theme/colors';
import generateFonts from '@/theme/fonts';

describe('theme contract', () => {
  const Colors = getThemeColors();
  const Fonts = generateFonts(Colors);
  const ApplicationStyle = generateApplicationStyle(Colors);

  it('exposes compatibility color tokens', () => {
    expect(Colors).toHaveProperty('neutral600');
    expect(Colors).toHaveProperty('warning900');
    expect(Colors).toHaveProperty('primary');
    expect(Colors).toHaveProperty('secondary');
    expect(Colors).toHaveProperty('error');
    expect(Colors).toHaveProperty('danger500');
    expect(Colors).toHaveProperty('textSecondary');
  });

  it('exposes compatibility font tokens', () => {
    ['h5', 'h5Bold', 'caption', 'captionBold', 'p4', 'p4Bold', 'label', 'button', 'small'].forEach((token) => {
      expect(Fonts).toHaveProperty(token);
    });
  });

  it('exposes application primitives', () => {
    expect(ApplicationStyle).toHaveProperty('card');
    expect(ApplicationStyle).toHaveProperty('input');
  });

  it('exposes alignment compatibility aliases', () => {
    ['center', 'spaceBetween', 'mainCenter', 'selfStart'].forEach((token) => {
      expect(Alignments).toHaveProperty(token);
    });
  });
});
