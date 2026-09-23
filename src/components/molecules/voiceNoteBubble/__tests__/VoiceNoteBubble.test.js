import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// VOCAL — la bulle d'un message vocal : ce qu'elle promet.
//
// Témoin de caractérisation (E6) posé AVANT la refonte d'après la maquette de
// Claude Design : il fige ce que la bulle garantit (le fichier absent se dit,
// le texte joint reste lisible, lire et changer de vitesse sont branchés,
// l'onde enregistrée est dessinée). Chaque changement VOULU par la maquette
// modifie une ligne d'ici, et se voit donc dans le diff.

const mockLecteur = {
  cycleSpeed: jest.fn(),
  durationMs: 0,
  isLoading: false,
  isPlayerAvailable: true,
  isPlaying: false,
  lastError: '',
  positionMs: 0,
  progress: 0,
  speed: 1,
  togglePlayback: jest.fn(),
};

jest.mock('@/hooks/useAudioPlayback', () => ({ __esModule: true, default: () => mockLecteur }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn(() => new Promise(() => {})) } }));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jwt' }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle) }),
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
      Spaces,
    }),
  };
});

// eslint-disable-next-line import/first -- les doublures doivent précéder le module
import VoiceNoteBubble from '../VoiceNoteBubble';

const AUDIO = [{ id: 0, mime: 'audio/mp4', url: 'https://cdn.example/v.m4a' }];

/**
 * Monte une bulle.
 * @param {any} props - Les propriétés de la bulle.
 * @returns {any} L'arbre monté.
 */
const monter = (props) => {
  let arbre;
  act(() => { arbre = renderer.create(createElement(VoiceNoteBubble, props)); });
  return arbre;
};

/**
 * Tout le texte rendu, bout à bout.
 * @param {any} arbre - L'arbre monté.
 * @returns {string} Le texte.
 */
const texte = (arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.type === 'Text', { deep: true })
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))
  .join(' | ');

describe('VoiceNoteBubble — ce que la bulle garantit', () => {
  beforeEach(() => {
    mockLecteur.togglePlayback.mockClear();
    mockLecteur.cycleSpeed.mockClear();
  });

  it('1. sans fichier audio, la bulle le DIT, et garde le texte joint', () => {
    const arbre = monter({ attachments: [], composition: { durationMs: 3000 }, message: 'écoute ça' });
    expect(texte(arbre)).toContain('Note vocale indisponible');
    expect(texte(arbre)).toContain('écoute ça');
  });

  it('2. la durée enregistrée s\'affiche avant même la première écoute', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    expect(texte(arbre)).toContain('00:42');
  });

  it('3. lire et changer de vitesse sont branchés sur le lecteur', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    const touchables = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function' && typeof n.type !== 'string',
    );
    act(() => { touchables[0].props.onPress(); });
    expect(mockLecteur.togglePlayback).toHaveBeenCalledTimes(1);
    act(() => { touchables[touchables.length - 1].props.onPress(); });
    expect(mockLecteur.cycleSpeed).toHaveBeenCalledTimes(1);
  });

  it('4. l\'onde enregistrée est dessinée, une barre par valeur', () => {
    const onde = [4, 8, 12, 16, 20, 16, 12, 8, 4, 10];
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 5000, waveform: onde } });
    const barres = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.style?.width === 3,
    );
    expect(barres.map((/** @type {any} */ b) => b.props.style.height)).toEqual(onde);
  });

  it('5. le texte joint au vocal reste lisible sous l\'onde', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 5000 }, message: 'rdv 14h' });
    expect(texte(arbre)).toContain('rdv 14h');
  });
});
