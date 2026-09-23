import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// VOCAL — TÉMOIN DE CARACTÉRISATION du lecteur partagé (règle E6).
//
// `useAudioPlayback` n'avait AUCUN témoin, et le lot VOCAL doit lui apprendre
// trois choses que la maquette exige : une vitesse GLOBALE (1× / 1,5× / 2×,
// la même pour toutes les bulles), la PAUSE qui garde la position quand un
// autre vocal démarre, et le déplacement dans le vocal (glisser sur l'onde).
// Avant d'y toucher, ce fichier fige ce qu'il fait AUJOURD'HUI : chaque
// changement de comportement du lot devra modifier une ligne d'ici, et donc
// se voir.

/** Les lecteurs natifs fabriqués, dans l'ordre. */
const mockLecteurs = /** @type {any[]} */ ([]);

jest.mock('@/utils/audio/nitroSoundRuntime', () => ({ canLoadNitroSoundModule: () => true }));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fs: { dirs: { CacheDir: '/cache' }, exists: jest.fn(), unlink: jest.fn() } },
}));
jest.mock('react-native-nitro-sound', () => ({
  createSound: () => {
    const lecteur = {
      /** @type {any} */ ecouteFin: null,
      /** @type {any} */ ecoutePosition: null,
      addPlayBackListener: jest.fn((/** @type {any} */ f) => { lecteur.ecoutePosition = f; }),
      addPlaybackEndListener: jest.fn((/** @type {any} */ f) => { lecteur.ecouteFin = f; }),
      dispose: jest.fn(),
      pausePlayer: jest.fn(() => Promise.resolve()),
      removePlayBackListener: jest.fn(),
      removePlaybackEndListener: jest.fn(),
      resumePlayer: jest.fn(() => Promise.resolve()),
      seekToPlayer: jest.fn(() => Promise.resolve()),
      setPlaybackSpeed: jest.fn(),
      setSubscriptionDuration: jest.fn(),
      setVolume: jest.fn(() => Promise.resolve()),
      startPlayer: jest.fn(() => Promise.resolve()),
      stopPlayer: jest.fn(() => Promise.resolve()),
    };
    mockLecteurs.push(lecteur);
    return lecteur;
  },
}), { virtual: true });

// eslint-disable-next-line import/first -- les doublures doivent précéder le module
import useAudioPlayback from '@/hooks/useAudioPlayback';

/**
 * Monte un lecteur et expose ce que le crochet rend, à chaque rendu.
 * ⚠️ Le crochet vide son lecteur au montage (effet chaîné, asynchrone). Sur un
 * téléphone, ce nettoyage est fini bien avant le premier appui ; ici, on le
 * laisse finir explicitement, sinon il libérerait la place du lecteur APRÈS
 * le premier « lire » et fausserait le témoin 4.
 * @param {string} source - Le fichier à lire.
 * @returns {Promise<{ lire: () => any }>} Le dernier état rendu.
 */
const monterLecteur = async (source) => {
  /** @type {any} */
  let dernier = null;
  function Sonde() {
    dernier = useAudioPlayback({ sourceUrl: source });
    return null;
  }
  act(() => { renderer.create(createElement(Sonde)); });
  await act(async () => {});
  return { lire: () => dernier };
};

describe('useAudioPlayback — ce que le lecteur fait AVANT le lot VOCAL', () => {
  beforeEach(() => { mockLecteurs.length = 0; });

  it('1. la vitesse tourne 1 → 1,5 → 2 → 1', async () => {
    const a = await monterLecteur('file:///a.m4a');
    expect(a.lire().speed).toBe(1);
    act(() => { a.lire().cycleSpeed(); });
    expect(a.lire().speed).toBe(1.5);
    act(() => { a.lire().cycleSpeed(); });
    expect(a.lire().speed).toBe(2);
    act(() => { a.lire().cycleSpeed(); });
    expect(a.lire().speed).toBe(1);
  });

  it('2. lire démarre le lecteur natif sur le fichier', async () => {
    const a = await monterLecteur('file:///a.m4a');
    await act(async () => { await a.lire().togglePlayback(); });
    expect(a.lire().isPlaying).toBe(true);
    const lecteur = mockLecteurs[mockLecteurs.length - 1];
    expect(lecteur.startPlayer).toHaveBeenCalledWith('file:///a.m4a', undefined);
  });

  it('3. la vitesse est PROPRE à chaque lecteur (pas une préférence globale)', async () => {
    const a = await monterLecteur('file:///a.m4a');
    const b = await monterLecteur('file:///b.m4a');
    act(() => { a.lire().cycleSpeed(); });
    expect(a.lire().speed).toBe(1.5);
    expect(b.lire().speed).toBe(1);
  });

  it('4. un second vocal qui démarre ARRÊTE le premier et lui fait perdre sa position', async () => {
    const a = await monterLecteur('file:///a.m4a');
    const b = await monterLecteur('file:///b.m4a');
    await act(async () => { await a.lire().togglePlayback(); });
    const lecteurA = mockLecteurs.find((l) => l.startPlayer.mock.calls.length > 0);
    act(() => { lecteurA.ecoutePosition({ currentPosition: 4000, duration: 10000 }); });
    expect(a.lire().positionMs).toBe(4000);

    await act(async () => { await b.lire().togglePlayback(); });

    expect(a.lire().isPlaying).toBe(false);
    expect(lecteurA.stopPlayer).toHaveBeenCalled();
    expect(a.lire().positionMs).toBe(0);
  });
});
