// VOCAL — le service d'enregistrement : témoin de caractérisation (E6) et
// preuve du défaut des vocaux longs.
//
// 🧨 LE SOUPÇON (prompt du lot VOCAL) : le service ne gardait que les 720
// derniers niveaux du micro (`MAX_METERING_SAMPLES`), coupés par la FIN. À un
// niveau toutes les 50 ms, 720 niveaux = 36 secondes : un vocal d'une minute
// ne dessinait que sa dernière demi-minute, étirée sur toute la bulle.
// Le témoin 4 joue exactement ce cas : 30 s de voix forte, puis 30 s de
// silence. La première moitié de l'onde DOIT être haute.

/** Ce que le micro de doublure a reçu, et le rappel par lequel on lui parle. */
const mockMicro = { ecoute: /** @type {any} */ (null), fichiers: /** @type {string[]} */ ([]) };

jest.mock('@/utils/audio/nitroSoundRuntime', () => ({ canLoadNitroSoundModule: () => true }));
jest.mock('@/utils/bootDiagnostics', () => ({ persistDiagnosticError: jest.fn() }));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/cache' },
      exists: jest.fn(() => Promise.resolve(true)),
      stat: jest.fn(() => Promise.resolve({ size: 4096 })),
      unlink: jest.fn(() => Promise.resolve()),
    },
  },
}));
jest.mock('react-native-nitro-sound', () => ({
  createSound: () => ({
    addRecordBackListener: (/** @type {any} */ f) => { mockMicro.ecoute = f; },
    removeRecordBackListener: () => { mockMicro.ecoute = null; },
    setSubscriptionDuration: jest.fn(),
    startRecorder: jest.fn((/** @type {string} */ chemin) => {
      mockMicro.fichiers.push(chemin);
      return Promise.resolve(chemin);
    }),
    stopRecorder: jest.fn(() => Promise.resolve(mockMicro.fichiers[mockMicro.fichiers.length - 1])),
  }),
}), { virtual: true });

// eslint-disable-next-line import/first -- les doublures doivent précéder le module
import ReactNativeBlobUtil from 'react-native-blob-util';

// eslint-disable-next-line import/first
import {
  cancelRecording,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';

/**
 * Joue des niveaux au rythme du micro (un toutes les 50 ms).
 * @param {number[]} decibels - Les niveaux, en décibels.
 * @returns {void}
 */
const jouer = (decibels) => {
  decibels.forEach((db, rang) => {
    mockMicro.ecoute({ currentMetering: db, currentPosition: (rang + 1) * 50 });
  });
};

describe('voiceNoteService — enregistrer, arrêter, annuler', () => {
  beforeEach(() => {
    mockMicro.ecoute = null;
    mockMicro.fichiers.length = 0;
  });

  it('1. démarrer ouvre un fichier dans le cache et écoute le micro', async () => {
    const { filePath } = await startRecording({});
    expect(filePath).toMatch(/^\/cache\/voice-note-\d+\.m4a$/);
    expect(typeof mockMicro.ecoute).toBe('function');
    await cancelRecording();
  });

  it('2. arrêter rend le fichier, sa durée et une onde de hauteurs 4 → 20', async () => {
    await startRecording({});
    jouer(Array.from({ length: 40 }, (_, i) => (i % 2 ? -10 : -50)));
    const brouillon = await stopRecording();

    expect(brouillon.uri).toMatch(/^file:\/\/\/cache\/voice-note-/);
    expect(brouillon.durationMs).toBe(2000);
    expect(brouillon.mime).toBe('audio/mp4');
    expect(brouillon.size).toBe(4096);
    expect(brouillon.waveform.length).toBeGreaterThan(0);
    brouillon.waveform.forEach((/** @type {number} */ h) => {
      expect(h).toBeGreaterThanOrEqual(4);
      expect(h).toBeLessThanOrEqual(20);
    });
    expect(brouillon.diagnostics?.waveformSource).toBe('metering');
  });

  it('3. annuler efface le fichier', async () => {
    const { filePath } = await startRecording({});
    jouer([-20, -20, -20]);
    await cancelRecording();
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(filePath);
  });

  it('4. UN VOCAL D\'UNE MINUTE GARDE SA PREMIÈRE MOITIÉ : 30 s de voix puis 30 s de silence', async () => {
    await startRecording({});
    jouer([
      ...Array.from({ length: 600 }, () => -5),
      ...Array.from({ length: 600 }, () => -60),
    ]);
    const { waveform } = await stopRecording();

    const moitie = Math.floor(waveform.length / 2);
    const hautes = waveform.slice(0, moitie).filter((/** @type {number} */ h) => h >= 16);
    const basses = waveform.slice(-moitie + 1).filter((/** @type {number} */ h) => h <= 8);
    // Toute la première moitié est de la voix, toute la seconde du silence.
    expect(hautes.length).toBe(moitie);
    expect(basses.length).toBe(moitie - 1);
  });
});
