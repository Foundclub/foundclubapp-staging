// BH04 / P1-08 — annuler pendant que le micro démarre : le micro doit s'éteindre.

const mockMicro = {
  arrets: 0,
  demarrage: /** @type {any} */ (null),
};

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
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    setSubscriptionDuration: jest.fn(),
    startRecorder: jest.fn((/** @type {string} */ chemin) => {
      if (!mockMicro.demarrage) return Promise.resolve(chemin);
      return mockMicro.demarrage.promesse;
    }),
    stopRecorder: jest.fn(() => {
      mockMicro.arrets += 1;
      return Promise.resolve('');
    }),
  }),
}), { virtual: true });

// eslint-disable-next-line import/first -- les doublures doivent précéder le module
import { cancelRecording, startRecording } from '@/services/chat/voiceNoteService';

const attendreUnTour = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('voiceNoteService — annuler pendant le démarrage du micro (P1-08)', () => {
  it('éteint le micro qui finit de démarrer, et un nouvel enregistrement reste possible', async () => {
    /** @type {(v: any) => void} */
    let liberer = () => {};
    mockMicro.demarrage = { promesse: new Promise((resolve) => { liberer = resolve; }) };

    const demarrage = startRecording({});
    demarrage.catch(() => {});
    await attendreUnTour();
    await cancelRecording();
    liberer('');

    await expect(demarrage).rejects.toThrow('VOICE_CANCELLED');
    expect(mockMicro.arrets).toBe(1);

    mockMicro.demarrage = null;
    await expect(startRecording({})).resolves.toEqual(expect.objectContaining({ filePath: expect.any(String) }));
    await cancelRecording();
  });
});
