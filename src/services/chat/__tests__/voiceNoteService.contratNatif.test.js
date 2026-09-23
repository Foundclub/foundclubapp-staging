// VOCAL-MICRO — LE MICRO QUI NE MESURAIT RIEN (recette d'Adel, TestFlight 2.6.60, 23/09).
//
// Constaté en production par le chef d'orchestre : les 4 vocaux du jour, dont
// les 2 essais d'Adel, portent LE MÊME sinus (`buildFallbackWaveform`) ; et
// l'onde vivante ne bougeait pas avec la voix. Le micro enregistrait, mais ne
// transmettait aucun niveau.
//
// 📖 LA DOUBLURE REPRODUIT LE CONTRAT NATIF, lu dans
// `node_modules/react-native-nitro-sound` 0.2.10, `ios/Sound.swift` :
// · `startRecorder(uri, audioSets, meteringEnabled)` → `isMeteringEnabled =
//   meteringEnabled ?? false` (l. 139, et l. 225 quand l'enregistreur est recréé) ;
// · à chaque tick : `updateMeters()`, puis `averagePower(forChannel: 0)` rendu
//   dans `currentMetering`, et `currentTime × 1000` dans `currentPosition`
//   (l. 886-898). Sans mesure, AVAudioRecorder rend −160 dB : le silence.
// · la JS de la bibliothèque passe l'appel tel quel au natif (`src/index.tsx`,
//   un simple `bind`) : aucune couche ne rajoute ni n'enlève d'argument.
//
// 🧨 LE DÉFAUT : si le premier démarrage échouait, le service retentait SANS
// le 3e argument. L'enregistrement partait, mais muet de bout en bout.

/** Le micro natif : ses démarrages, sa mesure, et le rappel par lequel il parle. */
const mockNatif = {
  appels: /** @type {any[][]} */ ([]),
  ecoute: /** @type {any} */ (null),
  /** Combien de démarrages échouent d'abord (session audio refusée, par exemple). */
  echecs: 0,
  fichier: '',
  mesure: false,
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
    addRecordBackListener: (/** @type {any} */ f) => { mockNatif.ecoute = f; },
    removeRecordBackListener: () => { mockNatif.ecoute = null; },
    setSubscriptionDuration: jest.fn(),
    startRecorder: jest.fn((
      /** @type {string} */ uri,
      /** @type {any} */ audioSets,
      /** @type {boolean | undefined} */ meteringEnabled,
    ) => {
      mockNatif.appels.push([uri, audioSets, meteringEnabled]);
      if (mockNatif.appels.length <= mockNatif.echecs) {
        // Le message réel de Sound.swift:90, numéroté pour distinguer les essais.
        return Promise.reject(new Error(
          'Audio session setup failed: The operation couldn’t be completed. '
          + `(OSStatus error 561017449.) [essai ${mockNatif.appels.length}]`,
        ));
      }
      // Sound.swift:139 — `isMeteringEnabled = meteringEnabled ?? false`.
      mockNatif.mesure = meteringEnabled ?? false;
      mockNatif.fichier = uri;
      return Promise.resolve(`file://${uri}`);
    }),
    stopRecorder: jest.fn(() => Promise.resolve(`file://${mockNatif.fichier}`)),
  }),
}), { virtual: true });

// eslint-disable-next-line import/first -- les doublures doivent précéder le module
import { startRecording, stopRecording } from '@/services/chat/voiceNoteService';

/** Une voix : des syllabes fortes et des respirations, un tick toutes les 50 ms. */
const VOIX = Array.from({ length: 40 }, (_, rang) => (rang % 3 ? -14 : -44));

/**
 * Le micro entend une voix ; ce qui sort du natif dépend de la mesure
 * (Sound.swift:886-898 : `averagePower` → `currentMetering`, −160 sans mesure).
 * @param {number[]} decibels - Ce que le micro entend vraiment.
 * @returns {void}
 */
const parler = (decibels) => {
  decibels.forEach((db, rang) => {
    mockNatif.ecoute({
      currentMetering: mockNatif.mesure ? db : -160,
      currentPosition: (rang + 1) * 50,
      isRecording: true,
      recordSecs: (rang + 1) * 50,
    });
  });
};

/**
 * Un vocal complet : démarrer, parler, arrêter.
 * @returns {Promise<{ brouillon: any, niveauxVivants: Array<number | null> }>} Le brouillon et
 *   les niveaux que l'onde vivante a reçus.
 */
const enregistrer = async () => {
  /** @type {Array<number | null>} */
  const niveauxVivants = [];
  await startRecording({ onMetering: (niveau) => { niveauxVivants.push(niveau); } });
  parler(VOIX);
  const brouillon = await stopRecording();
  return { brouillon, niveauxVivants };
};

describe('VOCAL-MICRO — le micro mesure, même quand le premier démarrage échoue', () => {
  beforeEach(() => {
    mockNatif.appels.length = 0;
    mockNatif.ecoute = null;
    mockNatif.echecs = 0;
    mockNatif.fichier = '';
    mockNatif.mesure = false;
  });

  it('1. démarrage normal : la mesure est allumée et la voix fait bouger l\'onde', async () => {
    const { brouillon, niveauxVivants } = await enregistrer();

    expect(mockNatif.appels).toHaveLength(1);
    expect(mockNatif.appels[0][2]).toBe(true);
    expect(new Set(niveauxVivants).size).toBeGreaterThan(1);
    expect(brouillon.diagnostics.waveformSource).toBe('metering');
  });

  it('2. 🧨 un premier démarrage RATÉ ne rend plus le micro muet', async () => {
    mockNatif.echecs = 1;
    const { brouillon, niveauxVivants } = await enregistrer();

    // L'onde vivante reçoit la voix, pas −160 en continu…
    expect(new Set(niveauxVivants).size).toBeGreaterThan(1);
    expect(niveauxVivants.every((niveau) => niveau === -160)).toBe(false);
    // … et l'onde enregistrée vient du micro, pas du sinus de secours.
    expect(brouillon.diagnostics.waveformSource).toBe('metering');
    expect(new Set(brouillon.waveform).size).toBeGreaterThan(1);
  });

  it('3. chaque essai garde la mesure ; seuls les réglages s\'allègent', async () => {
    mockNatif.echecs = 2;
    await enregistrer();

    expect(mockNatif.appels.map((appel) => appel[2])).toEqual([true, true, true]);
    const [premier, deuxieme, troisieme] = mockNatif.appels.map((appel) => appel[1]);
    // 1er : tous nos réglages, dont le mode iOS « measurement ».
    expect(premier.AVModeIOS).toBe('measurement');
    // 2e : les mêmes, SANS le mode iOS (le seul réglage de session audio).
    expect(deuxieme).not.toHaveProperty('AVModeIOS');
    expect(deuxieme.AudioEncodingBitRate).toBe(premier.AudioEncodingBitRate);
    expect(deuxieme.AudioChannels).toBe(1);
    // 3e : les réglages par défaut de la bibliothèque.
    expect(troisieme).toBeUndefined();
  });

  it('4. le vocal dit en base QUEL essai a pris, et pourquoi le premier a raté', async () => {
    const normal = (await enregistrer()).brouillon.diagnostics;
    expect(normal.recorderStart).toBe('full');
    expect(normal.recorderStartError).toBe('');
    expect(normal.sampleCount).toBe(VOIX.length);

    mockNatif.appels.length = 0;
    mockNatif.echecs = 1;
    const rattrape = (await enregistrer()).brouillon.diagnostics;
    expect(rattrape.recorderStart).toBe('noIosMode');
    expect(rattrape.recorderStartError).toMatch(/^Audio session setup failed/);
    expect(rattrape.recorderStartError.length).toBeLessThanOrEqual(160);

    // Deux échecs : c'est la PREMIÈRE erreur qui dit pourquoi on s'est rabattu.
    mockNatif.appels.length = 0;
    mockNatif.echecs = 2;
    const deuxEchecs = (await enregistrer()).brouillon.diagnostics;
    expect(deuxEchecs.recorderStart).toBe('defaults');
    expect(deuxEchecs.recorderStartError).toMatch(/\[essai 1\]$/);
  });

  it('5. trois démarrages ratés : l\'erreur remonte et rien ne démarre', async () => {
    mockNatif.echecs = 3;
    await expect(startRecording({})).rejects.toThrow('Audio session setup failed');
    expect(mockNatif.appels).toHaveLength(3);
  });
});
