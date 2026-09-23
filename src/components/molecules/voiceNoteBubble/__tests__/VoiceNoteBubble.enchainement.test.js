import { createElement } from 'react';
import { View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resetVoiceListenedStoreForTests } from '@/domains/messaging/voiceListenedStore';

import VoiceNoteBubble from '../VoiceNoteBubble';

// VOCAL2 — L'ENCHAÎNEMENT, CÔTÉ BULLES (décision d'Adel, 23/09 ~17h50).
//
// À la FIN d'un vocal, le suivant non écouté du même fil démarre tout seul.
// Il s'arrête au premier vocal déjà écouté. Mettre en pause, ou lancer un
// autre vocal (ce qui met le premier en pause), CASSE la chaîne : seule une
// fin de lecture la fait avancer.
//
// Chaque bulle a ici son propre faux lecteur, qu'on peut faire FINIR ou
// mettre en PAUSE depuis le témoin.

const mockLecteurs = /** @type {Record<string, any>} */ ({});

jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));
jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('@/hooks/useAudioPlayback', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  const useLecteurDouble = (/** @type {any} */ { sourceUrl }) => {
    const [etat, setEtat] = React.useState({ endedAt: 0, isPlaying: false, positionMs: 0 });
    if (!mockLecteurs[sourceUrl]) mockLecteurs[sourceUrl] = { lancements: 0 };
    const lecteur = mockLecteurs[sourceUrl];
    lecteur.enLecture = etat.isPlaying;
    lecteur.lancer = () => setEtat((e) => ({ ...e, isPlaying: true, positionMs: 600 }));
    lecteur.finir = () => setEtat({ endedAt: Date.now(), isPlaying: false, positionMs: 0 });
    lecteur.pause = () => setEtat((e) => ({ ...e, isPlaying: false, positionMs: 1200 }));
    return {
      cycleSpeed: () => {},
      durationMs: 5000,
      endedAt: etat.endedAt,
      isLoading: false,
      isPlayerAvailable: true,
      isPlaying: etat.isPlaying,
      lastError: '',
      positionMs: etat.positionMs,
      seekTo: () => {},
      speed: 1,
      togglePlayback: () => {
        lecteur.lancements += 1;
        setEtat((e) => ({ ...e, isPlaying: !e.isPlaying }));
      },
    };
  };
  return { __esModule: true, default: useLecteurDouble, pauseActivePlayback: () => {} };
});
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(() => new Promise(() => {})) },
}));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jwt' }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: generateFonts(Colors) }),
  };
});

// Chaque fil est DÉMONTÉ après son test (une bulle restée montée écouterait
// encore le relais) et porte ses PROPRES identifiants : la mémoire « déjà
// écouté » est rangée sur le téléphone et survit d'un test à l'autre.
/** @type {any} */
let arbreMonte = null;
let fil = 0;

const RECENT = new Date(Date.now() + 60000).toISOString();
const ANCIEN = '2026-01-01T10:00:00Z';

/**
 * Trois vocaux reçus à la suite : a, puis b, puis c.
 * @param {{ bDejaEcoute?: boolean }} [options] - b a-t-il déjà été écouté ?
 * @returns {any} L'arbre monté.
 */
const monterFil = ({ bDejaEcoute = false } = {}) => {
  fil += 1;
  /**
   * Une bulle du fil.
   * @param {string} nom - a, b ou c.
   * @param {string} suivant - Le vocal à enchaîner ('' : aucun).
   * @param {string} date - Sa date.
   * @returns {any} L'élément.
   */
  const bulle = (nom, suivant, date) => {
    const id = `fil${fil}-${nom}`;
    return createElement(
      VoiceNoteBubble,
      {
        attachments: [{ mime: 'audio/mp4', url: `https://x/${id}.m4a` }],
        composition: { durationMs: 5000, waveform: [4, 20] },
        createdAt: date,
        key: id,
        messageId: id,
        nextVoiceMessageId: suivant ? `fil${fil}-${suivant}` : '',
        senderName: 'Karim',
      },
    );
  };
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(View, null, [
      bulle('a', 'b', RECENT),
      bulle('b', 'c', bDejaEcoute ? ANCIEN : RECENT),
      bulle('c', '', RECENT),
    ]));
  });
  arbreMonte = arbre;
  return arbre;
};

const lecteur = (/** @type {string} */ nom) => mockLecteurs[`https://x/fil${fil}-${nom}.m4a`];

describe('VOCAL2 — à la fin d\'un vocal, le suivant non écouté démarre tout seul', () => {
  beforeEach(() => {
    Object.keys(mockLecteurs).forEach((cle) => { delete mockLecteurs[cle]; });
    resetVoiceListenedStoreForTests();
  });
  afterEach(() => {
    act(() => { arbreMonte?.unmount(); });
    arbreMonte = null;
  });

  it('3 vocaux non écoutés : a finit → b démarre ; b finit → c démarre', () => {
    monterFil();
    act(() => { lecteur('a').lancer(); });
    act(() => { lecteur('a').finir(); });
    expect(lecteur('b').lancements).toBe(1);
    expect(lecteur('b').enLecture).toBe(true);
    expect(lecteur('c').lancements).toBe(0);
    act(() => { lecteur('b').finir(); });
    expect(lecteur('c').lancements).toBe(1);
  });

  it('la chaîne s\'arrête sur un vocal DÉJÀ écouté (et ne le saute pas)', () => {
    monterFil({ bDejaEcoute: true });
    act(() => { lecteur('a').finir(); });
    expect(lecteur('b').lancements).toBe(0);
    expect(lecteur('c').lancements).toBe(0);
  });

  it('une PAUSE en pleine lecture casse la chaîne : rien ne démarre', () => {
    monterFil();
    act(() => { lecteur('a').lancer(); });
    expect(lecteur('a').enLecture).toBe(true);
    act(() => { lecteur('a').pause(); });
    expect(lecteur('a').enLecture).toBe(false);
    expect(lecteur('b').lancements).toBe(0);
    expect(lecteur('b').enLecture).toBe(false);
  });
});
