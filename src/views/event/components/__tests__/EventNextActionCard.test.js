import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N5 (D1) — LA PORTE D ENTREE DE L APPEL, TESTEE SEULE.
//
// 🚪 CE QU ELLE REPARE : L5-A a livre l ecran d appel complet, et RIEN ne
// l atteignait depuis la page d un evenement. Cette carte est le bouton qui
// manquait.
//
// CE QUI SE VERIFIE ICI — les trois etats de la fenetre, et ce que chacun dit :
//   · `before` : le bouton annonce l HEURE d ouverture, il est ferme, et la
//     phrase explique la regle ;
//   · `open`   : le bouton ouvre l ecran d appel — et lui seul le peut ;
//   · `closed` : « Appel terminé », ferme, et la phrase n a plus rien a dire ;
//   · 🔒 ET LE POINT QUI COMPTE LE PLUS : l horloge du TELEPHONE ne change
//     rien au rendu. C est la garantie que l etat vient du serveur. Un
//     composant qui lirait `Date.now()` ouvrirait la porte a quelqu un que le
//     serveur refuserait ensuite ligne par ligne.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

// ⚠️ LA DOUBLURE IGNORE `testID`, EXACTEMENT COMME LE VRAI ATOME : `Button`
// ne le declare ni ne le transmet (constat de N4). Une doublure plus genereuse
// ferait passer au vert un temoin qui, dans la vraie app, ne trouverait rien.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');

  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import EventNextActionCard from '../EventNextActionCard';

const textOf = (/** @type {any} */ children) => (
  Array.isArray(children) ? children.map(textOf).join('') : String(children ?? '')
);

const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <EventNextActionCard
        expectedCount={props.expectedCount ?? null}
        mode={props.mode ?? 'before'}
        onPress={props.onPress ?? jest.fn()}
        opensAtLabel={props.opensAtLabel ?? ''}
      />,
    );
  });

  return arbre;
};

const textesVisibles = (/** @type {any} */ root) => root.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const leBouton = (/** @type {any} */ root) => root.root.findByType(TouchableOpacity);

const PHRASE = 'appel est ouvert dès la création de l’événement';

describe('N5 — la carte « prochaine action »', () => {
  test('avant l ouverture : le bouton annonce l heure, il est ferme, la phrase explique', () => {
    const onPress = jest.fn();
    const root = monter({
      expectedCount: 22, mode: 'before', onPress, opensAtLabel: '17:30',
    });

    const textes = textesVisibles(root);
    expect(textes).toContain('Faire l’appel');
    expect(textes).toContain('22 attendus');
    expect(textes).toContain('Ouvre à 17:30');
    expect(textes.some((/** @type {string} */ texte) => texte.includes(PHRASE))).toBe(true);

    // La porte est fermee, et elle le reste meme si l on appuie dessus.
    expect(leBouton(root).props.disabled).toBe(true);
    act(() => { leBouton(root).props.onPress?.(); });
    expect(onPress).not.toHaveBeenCalled();
  });

  test('ouvert : le bouton fait l appel, et il ouvre l ecran', () => {
    const onPress = jest.fn();
    const root = monter({
      expectedCount: 22, mode: 'open', onPress, opensAtLabel: '17:30',
    });

    const textes = textesVisibles(root);
    expect(textes).toContain('Faire l’appel');
    // L heure d ouverture n a plus rien a annoncer : elle est passee.
    expect(textes).not.toContain('Ouvre à 17:30');

    expect(leBouton(root).props.disabled).toBe(false);
    act(() => { leBouton(root).props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('termine : « Appel terminé », ferme, et la phrase disparait', () => {
    const onPress = jest.fn();
    const root = monter({
      expectedCount: 22, mode: 'closed', onPress, opensAtLabel: '17:30',
    });

    const textes = textesVisibles(root);
    expect(textes).toContain('Appel terminé');
    expect(textes.some((/** @type {string} */ texte) => texte.includes(PHRASE))).toBe(false);

    expect(leBouton(root).props.disabled).toBe(true);
    act(() => { leBouton(root).props.onPress?.(); });
    expect(onPress).not.toHaveBeenCalled();
  });

  test('sans compte connu, la ligne des attendus disparait — on n annonce pas zero', () => {
    // D5 : la carte se montre AVANT que la charge d appel soit arrivee. Dire
    // « 0 attendu » a ce moment-la serait annoncer un fait qu on n a pas.
    const textes = textesVisibles(monter({ mode: 'before', opensAtLabel: '17:30' }));

    expect(textes).toContain('Faire l’appel');
    expect(textes.some((/** @type {string} */ texte) => texte.includes('attendu'))).toBe(false);
  });

  test('une seule personne attendue se dit au singulier', () => {
    const textes = textesVisibles(monter({ expectedCount: 1, mode: 'open' }));

    expect(textes).toContain('1 attendu');
    expect(textes).not.toContain('1 attendus');
  });

  test('zero attendu se dit, lui, quand il est MESURE', () => {
    // Nuance de la precedente : `0` est un fait, `null` est une ignorance.
    const textes = textesVisibles(monter({ expectedCount: 0, mode: 'open' }));

    expect(textes).toContain('0 attendu');
  });

  test('sans heure lisible, le bouton ne se termine pas par un blanc', () => {
    const textes = textesVisibles(monter({ mode: 'before', opensAtLabel: '' }));

    expect(textes).toContain('Pas encore ouvert');
    expect(textes.every((/** @type {string} */ texte) => !texte.startsWith('Ouvre à'))).toBe(true);
  });

  test('🔒 l horloge du TELEPHONE ne change rien : meme rendu a deux instants opposes', () => {
    // Le coeur du lot. L etat vient de `resolveCallMode` (horloge SERVEUR) ;
    // la carte, elle, ne consulte aucune horloge. Deux instants que tout
    // oppose doivent donc rendre exactement la meme chose.
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2020-01-01T08:00:00.000Z'));
    const tot = textesVisibles(monter({
      expectedCount: 22, mode: 'before', opensAtLabel: '17:30',
    }));

    jest.setSystemTime(new Date('2020-01-01T23:59:00.000Z'));
    const tard = textesVisibles(monter({
      expectedCount: 22, mode: 'before', opensAtLabel: '17:30',
    }));

    expect(tard).toEqual(tot);
    expect(tot).toContain('Ouvre à 17:30');

    jest.useRealTimers();
  });
});
