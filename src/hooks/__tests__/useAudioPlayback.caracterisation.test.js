import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// VOCAL — TÉMOIN DE CARACTÉRISATION du lecteur partagé (règle E6).
//
// `useAudioPlayback` n'avait AUCUN témoin, et le lot VOCAL doit lui apprendre
// trois choses que la maquette exige : une vitesse GLOBALE (1× / 1,5× / 2×,
// la même pour toutes les bulles), la PAUSE qui garde la position quand un
// autre vocal démarre, et le déplacement dans le vocal (glisser sur l'onde).
// Avant d'y toucher, ce fichier a figé ce qu'il faisait (commit f98bfe1d) :
// chaque changement de comportement du lot modifie une ligne d'ici, et se
// voit donc dans le diff. Les témoins 3 et 4 ont changé DÉLIBÉREMENT à
// l'état 5 (vitesse globale, pause qui garde la position) ; 5 à 7 sont neufs.

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
      /** @type {any} */ addPlaybackEndListener: jest.fn((/** @type {any} */ f) => { lecteur.ecouteFin = f; }),
      addPlayBackListener: jest.fn((/** @type {any} */ f) => { lecteur.ecoutePosition = f; }),
      dispose: jest.fn(),
      ecoutePosition: null,
      pausePlayer: jest.fn(() => Promise.resolve()),
      removePlaybackEndListener: jest.fn(),
      removePlayBackListener: jest.fn(),
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
  /**
   *
   */
  function Sonde() {
    dernier = useAudioPlayback({ sourceUrl: source });
    return null;
  }
  act(() => { renderer.create(createElement(Sonde)); });
  await act(async () => {});
  return { lire: () => dernier };
};

describe('useAudioPlayback — ce que le lecteur promet (caractérisé avant VOCAL, puis changé par lui)', () => {
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

  it('3. VOCAL : la vitesse est une préférence GLOBALE — choisie sur une bulle, elle vaut pour toutes', async () => {
    const a = await monterLecteur('file:///a.m4a');
    const b = await monterLecteur('file:///b.m4a');
    act(() => { a.lire().cycleSpeed(); });
    expect(a.lire().speed).toBe(1.5);
    expect(b.lire().speed).toBe(1.5);
    // Le lecteur de b l'applique aussi, sans qu'on touche à b.
    await act(async () => { await b.lire().togglePlayback(); });
    const lecteurB = mockLecteurs[mockLecteurs.length - 1];
    expect(lecteurB.setPlaybackSpeed).toHaveBeenLastCalledWith(1.5);
    // On revient à 1× pour les témoins suivants (la préférence est retenue).
    act(() => { a.lire().cycleSpeed(); });
    act(() => { a.lire().cycleSpeed(); });
    expect(b.lire().speed).toBe(1);
  });

  it('4. VOCAL : un second vocal qui démarre met le premier en PAUSE — il GARDE sa position', async () => {
    const a = await monterLecteur('file:///a.m4a');
    const b = await monterLecteur('file:///b.m4a');
    await act(async () => { await a.lire().togglePlayback(); });
    const lecteurA = mockLecteurs.find((l) => l.startPlayer.mock.calls.length > 0);
    act(() => { lecteurA.ecoutePosition({ currentPosition: 4000, duration: 10000 }); });
    expect(a.lire().positionMs).toBe(4000);

    const arretsAvant = lecteurA.stopPlayer.mock.calls.length;
    await act(async () => { await b.lire().togglePlayback(); });

    expect(a.lire().isPlaying).toBe(false);
    expect(lecteurA.pausePlayer).toHaveBeenCalledTimes(1);
    expect(lecteurA.stopPlayer.mock.calls.length).toBe(arretsAvant);
    expect(a.lire().positionMs).toBe(4000);

    // Relancer a : il reprend où il en était, et c'est b qui se met en pause.
    lecteurA.ecoutePosition({ currentPosition: 4000, duration: 10000 });
    await act(async () => { await a.lire().togglePlayback(); });
    expect(lecteurA.resumePlayer).toHaveBeenCalledTimes(1);
    expect(a.lire().isPlaying).toBe(true);
    expect(b.lire().isPlaying).toBe(false);
  });

  it('5. VOCAL : glisser sur l\'onde d\'un vocal jamais lu — la position est retenue, puis appliquée au démarrage', async () => {
    const a = await monterLecteur('file:///a.m4a');
    await act(async () => { await a.lire().seekTo(17000); });
    expect(a.lire().positionMs).toBe(17000);
    await act(async () => { await a.lire().togglePlayback(); });
    const lecteur = mockLecteurs[mockLecteurs.length - 1];
    expect(lecteur.startPlayer).toHaveBeenCalled();
    expect(lecteur.seekToPlayer).toHaveBeenCalledWith(17000);
  });

  it('6. VOCAL : se déplacer pendant la lecture saute tout de suite', async () => {
    const a = await monterLecteur('file:///a.m4a');
    await act(async () => { await a.lire().togglePlayback(); });
    const lecteur = mockLecteurs[mockLecteurs.length - 1];
    await act(async () => { await a.lire().seekTo(5000); });
    expect(lecteur.seekToPlayer).toHaveBeenCalledWith(5000);
    expect(a.lire().positionMs).toBe(5000);
  });

  it('7. VOCAL : la fin de lecture est datée (l\'onde tient son remplissage puis s\'efface)', async () => {
    const a = await monterLecteur('file:///a.m4a');
    await act(async () => { await a.lire().togglePlayback(); });
    const lecteur = mockLecteurs[mockLecteurs.length - 1];
    expect(a.lire().endedAt).toBe(0);
    act(() => { lecteur.ecouteFin(); });
    expect(a.lire().endedAt).toBeGreaterThan(0);
    expect(a.lire().isPlaying).toBe(false);
  });
});
