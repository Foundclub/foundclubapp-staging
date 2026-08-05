import Alignments from '@/theme/alignements';
import generateApplicationStyle from '@/theme/applicationStyle';
import getThemeColors from '@/theme/colors';
import generateFonts from '@/theme/fonts';
import Spaces from '@/theme/spaces';

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

  it('expose les 4 jetons d espacement des packs de design (D05)', () => {
    // Un jeton absent ne leve rien : `Spaces.gap[44]` rend `undefined` et React
    // Native ignore la valeur EN SILENCE. Ce controle est donc le seul endroit
    // ou l'absence se voit.
    [38, 44, 52, 74].forEach((jeton) => {
      expect(Spaces.gap[jeton]).toEqual({ gap: jeton });
      expect(Spaces.paddingHorizontal[jeton]).toEqual({ paddingHorizontal: jeton });
    });
  });

  it('garde 6, 10 et 14 HORS de la rampe, volontairement', () => {
    // 183 appels hors rampe existent deja dans 51 fichiers (10 x78, 6 x33,
    // 14 x29) et ne rendent rien aujourd'hui. Declarer ces trois valeurs
    // donnerait d'un coup un espacement a ~140 endroits qui n'en ont jamais
    // eu : c'est un lot a part, avec sa propre recette.
    [6, 10, 14].forEach((jeton) => {
      expect(Spaces.gap[jeton]).toBeUndefined();
    });
  });
});
