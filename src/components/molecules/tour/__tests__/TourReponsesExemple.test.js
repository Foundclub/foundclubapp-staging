import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

import TourReponsesExemple from '../TourReponsesExemple';

// GUIDE-BONUS (L5, décision d'Adel « 2- A », 28/10) — bonus B1 avec une équipe
// vide. La fiche de la séance signale au guide qu'il n'y a personne (b1-vide) ;
// pendant b1-vide, de FAUX profils d'exemple répondent « présent » sous les yeux
// du coach, puis disparaissent. Animation locale : aucune requête, rien qui reste.

let mockStepId = null;
jest.mock('@/context/useTour', () => ({
  useTour: () => ({
    currentStep: mockStepId ? { id: mockStepId } : null,
    isGuide: true,
    isTourActive: Boolean(mockStepId),
    tourStatus: 'active',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/**
 * Textes rendus.
 * @param {any} arbre - L'arbre.
 * @returns {string[]} Les textes.
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

/** @type {any[]} */
let signaux = [];
let desabonner = () => {};

beforeEach(() => {
  jest.useFakeTimers();
  resetGuidanceRuntimeForTests();
  signaux = [];
  desabonner = subscribeToGuidanceSignals((signal) => signaux.push(signal));
});

afterEach(() => {
  desabonner();
  jest.useRealTimers();
});

/**
 * Monte le composant.
 * @param {boolean} equipeVide - La séance n'a personne.
 * @returns {any} L'arbre rendu.
 */
const monter = (equipeVide) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<TourReponsesExemple equipeVide={equipeVide} />); });
  return arbre;
};

it('b1-relance, équipe vide : la fiche signale « personne » au guide, une seule fois', () => {
  mockStepId = 'b1-relance';
  const arbre = monter(true);
  act(() => arbre.update(<TourReponsesExemple equipeVide />));

  expect(signaux.filter((s) => s.kind === 'action').map((s) => s.key))
    .toEqual(['event.participants.empty']);
  expect(arbre.toJSON()).toBeNull();
});

it('b1-relance, équipe avec joueurs : aucun signal, rien de rendu', () => {
  mockStepId = 'b1-relance';
  const arbre = monter(false);

  expect(signaux.filter((s) => s.kind === 'action')).toEqual([]);
  expect(arbre.toJSON()).toBeNull();
});

it('b1-vide : de faux profils répondent « présent », puis disparaissent ; 0 requête', () => {
  mockStepId = 'b1-vide';
  const fetchEspion = jest.spyOn(global, 'fetch').mockImplementation(() => Promise.reject());
  const arbre = monter(true);

  const pendant = textes(arbre);
  expect(pendant.filter((texte) => texte === 'Présent·e')).toHaveLength(3);
  expect(pendant.some((texte) => texte.includes('Exemple'))).toBe(true);

  act(() => { jest.advanceTimersByTime(10000); });

  expect(arbre.toJSON()).toBeNull();
  expect(fetchEspion).not.toHaveBeenCalled();
  expect(signaux.filter((s) => s.kind === 'action')).toEqual([]);
  fetchEspion.mockRestore();
});

it('hors du guide : rien', () => {
  mockStepId = null;
  const arbre = monter(true);
  expect(arbre.toJSON()).toBeNull();
  expect(signaux).toEqual([]);
});
