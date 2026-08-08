import fs from 'fs';
import path from 'path';

import { StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { hitSlopToMinTarget, MIN_TOUCH_TARGET } from '@/theme/applicationStyle';

import OnboardingSkipLink from '../components/OnboardingSkipLink';

// D31 ⑤ — « le padding du bouton "continuer" / "passer cette etape" de
// l'onboarding est trop grand, il faut reduire au maximum » (recette d'Adel du
// 2026-08-07 au soir).
//
// LA CAUSE N'ETAIT PAS UN REGLAGE, C'ETAIT UNE ADDITION EN DOUBLE.
// `ScreenContainer` garantit TOUJOURS un plancher `insets.bottom` (son en-tete
// le dit : « seul le mode edge-to-edge renonce a ce plancher, pour les ecrans
// qui gerent eux-memes leur retrait bas »). Or 15 ecrans du tunnel posaient
// DEJA `marginBottom: insets.bottom` sur leur contenu. Sur un telephone a
// barre gestuelle, cela faisait 34 + 34 = 68 pt de vide sous le dernier bouton.
// `UserAffiliationGuide` etait le seul a avoir pris le bon mode.
//
// Comme pour D23, le defaut ne vit dans AUCUN ecran en particulier : il vit
// dans le cumul. Un balayage de fichiers les couvre tous, y compris ceux qui
// seront ajoutes demain.

const ONBOARDING_DIR = path.join(__dirname, '..');

const readScreens = () => fs
  .readdirSync(ONBOARDING_DIR)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({
    name,
    source: fs.readFileSync(path.join(ONBOARDING_DIR, name), 'utf8'),
  }));

describe('Tunnel d`inscription — le retrait bas n`est jamais compte deux fois (D31 ⑤)', () => {
  const screens = readScreens();

  it('le balayage lit bien tout le dossier', () => {
    // Temoin anti-faux-vert : un balayage qui ne lit rien passe au vert.
    expect(screens.length).toBeGreaterThanOrEqual(16);
  });

  it('au moins 15 ecrans posent eux-memes leur retrait bas — c`est le gisement', () => {
    const withOwnInset = screens.filter(
      ({ source }) => source.includes('marginBottom: insets.bottom'),
    );

    expect(withOwnInset.length).toBeGreaterThanOrEqual(15);
  });

  it.each(readScreens().filter(({ source }) => source.includes('marginBottom: insets.bottom')))(
    '$name renonce au plancher du conteneur, sinon son retrait bas est double',
    ({ source }) => {
      expect(source).toContain('bottomInsetMode="edge-to-edge"');
    },
  );
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Spaces: espaces,
    }),
  };
});

// Le composant ecrit son arithmetique en clair : « 14 pt de texte » rendus sur
// une ligne de 16 pt. C'est ce meme nombre qui doit servir au hitSlop.
const TEXT_LINE_HEIGHT = 16;

describe('OnboardingSkipLink — reduit au maximum, mais JAMAIS sous 44 pt (D31 ⑤)', () => {
  /** @returns {any} Le pressable du lien de saut. */
  const renderLink = () => {
    /** @type {any} */
    let tree;
    act(() => {
      tree = renderer.create(<OnboardingSkipLink onPress={() => {}} />);
    });
    return tree.root.findByType(TouchableOpacity);
  };

  it('a bien resserre sa marge verticale', () => {
    const style = StyleSheet.flatten(renderLink().props.style);

    // Elle valait 8 avant D31.
    expect(style.paddingVertical).toBe(4);
  });

  it('⛔ LA LIMITE : la cible TACTILE reste a 44 pt, hitSlop compris', () => {
    const link = renderLink();
    const style = StyleSheet.flatten(link.props.style);
    const renderedHeight = TEXT_LINE_HEIGHT + (2 * style.paddingVertical);
    const touchableHeight = renderedHeight + link.props.hitSlop.top + link.props.hitSlop.bottom;

    expect(touchableHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('et le hitSlop SUIT la marge : le baisser sans lui fait rougir ce test', () => {
    const link = renderLink();
    const style = StyleSheet.flatten(link.props.style);
    const renderedHeight = TEXT_LINE_HEIGHT + (2 * style.paddingVertical);

    // C'est ce lien mecanique qui protege les 44 pt : le hitSlop est calcule
    // DEPUIS la taille rendue, il n'est pas un jeton choisi a la main.
    expect(link.props.hitSlop).toEqual(hitSlopToMinTarget(renderedHeight));
  });

  it('garde son role et son nom accessibles', () => {
    const link = renderLink();

    expect(link.props.accessibilityRole).toBe('button');
    expect(link.props.accessibilityLabel).toBe('Passer cette étape');
  });
});
