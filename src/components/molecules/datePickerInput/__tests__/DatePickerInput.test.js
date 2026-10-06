import { createElement } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DatePickerInput from '../DatePickerInput';

// FINITIONS16 · POINT 3 (tournee T15, photos SITE_C25a et SITE_C43) — LE SELECTEUR DE DATE ETAIT
// INERTE SUR LE SITE. Le composant ne montait son calendrier que sur iOS (feuille) et Android
// (boite native) : sur le site, l'appui ouvrait… rien. « Fermer une installation » et
// « Demander un creneau » etaient donc IMPOSSIBLES depuis un ordinateur.
//
// Le fichier n'avait AUCUN test (E6) : la premiere partie fige ce qu'il fait aujourd'hui sur le
// telephone (verte avant le correctif) ; la seconde exige un vrai champ de date du navigateur
// sur le site (ROUGE avant).

/** Les proprietes recues par le selecteur natif, dans l'ordre du rendu. */
const mockSelecteurs = [];

// Le selecteur natif ne se monte pas dans Jest : une sonde releve ses proprietes.
jest.mock('@react-native-community/datetimepicker', () => function SelecteurMock(
  /** @type {any} */ props,
) {
  mockSelecteurs.push(props);
  return null;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

const osDOrigine = Platform.OS;

/** @type {any} */
let arbre = null;

const monter = (/** @type {any} */ props) => {
  act(() => {
    arbre = renderer.create(createElement(DatePickerInput, {
      label: 'Du',
      onChange: jest.fn(),
      placeholder: 'Choisir une date',
      ...props,
    }));
  });
  return arbre;
};

const textes = () => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

beforeEach(() => {
  mockSelecteurs.length = 0;
});

afterEach(() => {
  Platform.OS = osDOrigine;
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

describe('DatePickerInput — ce qu il fait sur le telephone (E6, vert avant)', () => {
  test('sans valeur : le libelle et le texte d invite', () => {
    monter({});

    expect(textes()).toEqual(['Du', 'Choisir une date']);
  });

  test('avec une valeur JJ/MM/AAAA : la date en toutes lettres', () => {
    monter({ value: '07/10/2026' });

    expect(textes()).toContain('mercredi 7 octobre 2026');
  });

  test('le message d erreur s affiche sous le champ', () => {
    monter({ error: 'Choisis une date' });

    expect(textes()).toContain('Choisis une date');
  });

  test('iOS : rien avant l appui ; l appui ouvre le selecteur, un choix rend JJ/MM/AAAA', () => {
    Platform.OS = 'ios';
    const onChange = jest.fn();
    monter({ onChange, value: '07/10/2026' });

    expect(mockSelecteurs).toHaveLength(0);
    act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
    const selecteur = mockSelecteurs[mockSelecteurs.length - 1];
    expect(selecteur.mode).toBe('date');
    act(() => { selecteur.onChange({ type: 'set' }, new Date(2026, 9, 31)); });

    expect(onChange).toHaveBeenCalledWith('31/10/2026');
  });

  test('Android : l appui monte la boite native, un choix rend JJ/MM/AAAA', () => {
    Platform.OS = 'android';
    const onChange = jest.fn();
    monter({ onChange });

    act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
    const selecteur = mockSelecteurs[mockSelecteurs.length - 1];
    act(() => { selecteur.onChange({ type: 'set' }, new Date(2026, 0, 5)); });

    expect(onChange).toHaveBeenCalledWith('05/01/2026');
  });
});

describe('FINITIONS16 3 — sur le site, un vrai champ de date du navigateur', () => {
  beforeEach(() => {
    Platform.OS = 'web';
  });

  const champDeDate = () => arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.type === 'input' && noeud.props.type === 'date',
  );

  test('🔴 le champ de date est la, sans appui prealable', () => {
    monter({});

    expect(champDeDate()).toHaveLength(1);
  });

  test('🔴 il montre la valeur (AAAA-MM-JJ du navigateur) et rien quand elle est vide', () => {
    monter({ value: '07/10/2026' });
    expect(champDeDate()[0].props.value).toBe('2026-10-07');

    act(() => { arbre.update(createElement(DatePickerInput, { label: 'Du', onChange: jest.fn(), value: '' })); });
    expect(champDeDate()[0].props.value).toBe('');
  });

  test('🔴 un choix rend JJ/MM/AAAA, comme le telephone ; vider rend une chaine vide', () => {
    const onChange = jest.fn();
    monter({ onChange });

    act(() => { champDeDate()[0].props.onChange({ currentTarget: { value: '2026-10-31' } }); });
    expect(onChange).toHaveBeenLastCalledWith('31/10/2026');

    act(() => { champDeDate()[0].props.onChange({ currentTarget: { value: '' } }); });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  test('🔴 les bornes passent au navigateur en dates LOCALES (pas de jour perdu a minuit UTC)', () => {
    monter({
      maximumDate: new Date(2027, 5, 30, 0, 30),
      minimumDate: new Date(2026, 9, 7, 0, 30),
    });

    expect(champDeDate()[0].props.min).toBe('2026-10-07');
    expect(champDeDate()[0].props.max).toBe('2027-06-30');
  });

  test('🔴 le champ porte le libelle (lecteur d ecran) ; le libelle et l erreur restent visibles', () => {
    monter({ error: 'Choisis une date' });

    expect(champDeDate()[0].props['aria-label']).toBe('Du');
    expect(textes()).toEqual(['Du', 'Choisis une date']);
    expect(mockSelecteurs).toHaveLength(0);
  });
});
