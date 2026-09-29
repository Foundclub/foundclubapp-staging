import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// FINITIONS4 — D7 (recette emulateur, tournee 6, 29/09) : « OUVRE À 16:30 »
// PENDANT LE CHARGEMENT DE L APPEL.
//
// Tant que la feuille d appel n etait pas chargee, la carte « Faire l appel »
// affichait une heure d ouverture INVENTEE (le repli local, 30 min avant le
// debut) juste au-dessus de « L’appel est ouvert dès la création de
// l’événement ». Decision du chef : rien, ou un etat de chargement, tant que
// l heure n est pas connue.
//
// Ecrits ROUGES contre app `12692738` : la carte ne connaissait pas ces etats.

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : clef
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

// La doublure GARDE `isLoading` : c est lui qui dit « je charge » a l ecran
// (le vrai `Button` rend alors son `Loader` a la place du libelle).
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');

  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        isLoading: Boolean(props.isLoading),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.isLoading ? '' : (props.title || '')),
    );
  };
});

// eslint-disable-next-line import/first
import EventNextActionCard from '../EventNextActionCard';

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <EventNextActionCard
        expectedCount={null}
        mode={props.mode}
        onPress={jest.fn()}
        opensAtLabel={props.opensAtLabel ?? '16:30'}
      />,
    );
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => String(noeud.props.children ?? '').trim())
  .filter(Boolean);

describe('FINITIONS4 D7 — la carte « Faire l appel » n invente pas d heure', () => {
  test('🚨 LE TEMOIN : appel en chargement → ni « Ouvre à », ni « Pas encore ouvert »', () => {
    const arbre = monter({ mode: 'loading', opensAtLabel: '16:30' });
    const lus = textes(arbre);

    expect(lus.some((texte) => texte.startsWith('Ouvre à'))).toBe(false);
    expect(lus).not.toContain('Pas encore ouvert');
    // La carte reste la (la porte se voit), avec son titre, et elle charge.
    expect(lus).toContain('Faire l’appel');
    const bouton = arbre.root.findByType(TouchableOpacity);
    expect(bouton.props.isLoading).toBe(true);
    expect(bouton.props.disabled).toBe(true);
  });

  test('🚨 feuille d appel illisible (erreur) → la carte ne dit RIEN', () => {
    const arbre = monter({ mode: 'unavailable' });

    expect(arbre.toJSON()).toBeNull();
  });

  test('une fois l heure connue du serveur, elle s affiche comme avant', () => {
    const lus = textes(monter({ mode: 'before', opensAtLabel: '17:30' }));

    expect(lus).toContain('Ouvre à 17:30');
  });
});
