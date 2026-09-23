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
//
// VOCAL-RÉGLAGES — CE QUE LA BASE A DIT ENSUITE (vocal 4705, TestFlight 2.6.61) :
// `recorderStart: defaults`, 1re erreur « Recording setup failed: Failed to
// prepare recorder » (Sound.swift:143-147, puis 376). Avec la mesure, NOS
// réglages sont refusés au `prepareToRecord` ; les défauts (48 kHz, stéréo,
// 192 kbit/s) passent. L'échelle change donc UN facteur à la fois — le débit,
// puis la fréquence — et chaque refus voyage jusqu'en base.

/** Le micro natif : ses démarrages, sa mesure, et le rappel par lequel il parle. */
const mockNatif = {
  appels: /** @type {any[][]} */ ([]),
  ecoute: /** @type {any} */ (null),
  /** Combien de démarrages échouent d'abord (session audio refusée, par exemple). */
  echecs: 0,
  /** La durée d'un essai de démarrage, sur l'horloge de la doublure. */
  dureeEssai: 0,
  fichier: '',
  /** L'horloge de la doublure (`Date.now`, quand un témoin l'y branche). */
  maintenant: 0,
  mesure: false,
  /**
   * Les réglages que `prepareToRecord` refuse (Sound.swift:143-147).
   * @type {null | ((reglages: any, mesure: boolean | undefined) => boolean)}
   */
  refuse: null,
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
      mockNatif.maintenant += mockNatif.dureeEssai;
      if (mockNatif.refuse && mockNatif.refuse(audioSets, meteringEnabled)) {
        // Le message réel reçu en base le 23/09 (Sound.swift:147, puis 376).
        return Promise.reject(new Error('Recording setup failed: Failed to prepare recorder'));
      }
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
    mockNatif.dureeEssai = 0;
    mockNatif.echecs = 0;
    mockNatif.fichier = '';
    mockNatif.maintenant = 0;
    mockNatif.mesure = false;
    mockNatif.refuse = null;
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

  it('3. chaque essai garde la mesure ; un seul facteur change à la fois', async () => {
    mockNatif.echecs = 3;
    await enregistrer();

    expect(mockNatif.appels.map((appel) => appel[2])).toEqual([true, true, true, true]);
    const [premier, deuxieme, troisieme, quatrieme] = mockNatif.appels.map((appel) => appel[1]);
    // 1er : tous nos réglages — mono, 44,1 kHz, 128 kbit/s, mode iOS « measurement ».
    expect(premier).toMatchObject({
      AudioChannels: 1,
      AudioEncodingBitRate: 128000,
      AVModeIOS: 'measurement',
      AVSampleRateKeyIOS: 44100,
    });
    // 2e : le DÉBIT seul descend à 96 kbit/s (celui des défauts, par canal).
    expect(deuxieme).toEqual({ ...premier, AudioEncodingBitRate: 96000 });
    // 3e : la FRÉQUENCE seule passe à 48 kHz (sur iPhone et sur Android).
    expect(troisieme).toEqual({ ...premier, AudioSamplingRate: 48000, AVSampleRateKeyIOS: 48000 });
    // 4e : les réglages par défaut de la bibliothèque.
    expect(quatrieme).toBeUndefined();
  });

  it('4. le vocal dit en base QUEL essai a pris, et pourquoi le premier a raté', async () => {
    const normal = (await enregistrer()).brouillon.diagnostics;
    expect(normal.recorderStart).toBe('full');
    expect(normal.recorderStartError).toBe('');
    expect(normal.sampleCount).toBe(VOIX.length);

    mockNatif.appels.length = 0;
    mockNatif.echecs = 1;
    const rattrape = (await enregistrer()).brouillon.diagnostics;
    expect(rattrape.recorderStart).toBe('bitrate96');
    expect(rattrape.recorderStartError).toMatch(/^Audio session setup failed/);
    expect(rattrape.recorderStartError.length).toBeLessThanOrEqual(160);

    // Deux échecs : c'est la PREMIÈRE erreur qui dit pourquoi on s'est rabattu.
    mockNatif.appels.length = 0;
    mockNatif.echecs = 2;
    const deuxEchecs = (await enregistrer()).brouillon.diagnostics;
    expect(deuxEchecs.recorderStart).toBe('mono48k');
    expect(deuxEchecs.recorderStartError).toMatch(/\[essai 1\]$/);
  });

  it('5. quatre démarrages ratés : l\'erreur remonte et rien ne démarre', async () => {
    mockNatif.echecs = 4;
    await expect(startRecording({})).rejects.toThrow('Audio session setup failed');
    expect(mockNatif.appels).toHaveLength(4);
  });
});

describe('VOCAL-RÉGLAGES — quels réglages l\'iPhone accepte-t-il avec la mesure ?', () => {
  beforeEach(() => {
    mockNatif.appels.length = 0;
    mockNatif.dureeEssai = 0;
    mockNatif.echecs = 0;
    mockNatif.maintenant = 0;
    mockNatif.refuse = null;
  });

  it('6. le constat du 23/09 rejoué : chaque refus voyage en base, dans l\'ordre', async () => {
    // 2.6.61 : AVEC la mesure, tous nos réglages sont refusés ; les défauts passent.
    mockNatif.refuse = (reglages, mesure) => Boolean(mesure) && reglages !== undefined;
    const { brouillon } = await enregistrer();
    const { diagnostics } = brouillon;

    expect(diagnostics.recorderStart).toBe('defaults');
    expect(diagnostics.waveformSource).toBe('metering');
    expect(diagnostics.recorderStartErrors).toEqual([
      'full: Recording setup failed: Failed to prepare recorder',
      'bitrate96: Recording setup failed: Failed to prepare recorder',
      'mono48k: Recording setup failed: Failed to prepare recorder',
    ]);
    // La 1re erreur reste lisible au même endroit qu'en 2.6.61.
    expect(diagnostics.recorderStartError)
      .toBe('Recording setup failed: Failed to prepare recorder');
  });

  it('7. si c\'est le DÉBIT, l\'essai à 96 kbit/s prend, en mono', async () => {
    mockNatif.refuse = (reglages, mesure) => Boolean(mesure)
      && Number(reglages?.AudioEncodingBitRate) > 96000;
    const { diagnostics } = (await enregistrer()).brouillon;

    expect(diagnostics.recorderStart).toBe('bitrate96');
    expect(mockNatif.appels).toHaveLength(2);
    expect(mockNatif.appels[1][1]).toMatchObject({ AudioChannels: 1, AudioEncodingBitRate: 96000 });
  });

  it('8. si c\'est la FRÉQUENCE, l\'essai à 48 kHz prend, en mono', async () => {
    mockNatif.refuse = (reglages, mesure) => Boolean(mesure)
      && reglages?.AVSampleRateKeyIOS === 44100;
    const { diagnostics } = (await enregistrer()).brouillon;

    expect(diagnostics.recorderStart).toBe('mono48k');
    expect(mockNatif.appels[2][1]).toMatchObject({ AudioChannels: 1, AVSampleRateKeyIOS: 48000 });
  });

  it('9. le temps jusqu\'au démarrage effectif est mesuré (recorderStartMs)', async () => {
    const horloge = jest.spyOn(Date, 'now').mockImplementation(() => mockNatif.maintenant);
    try {
      mockNatif.dureeEssai = 150;
      expect((await enregistrer()).brouillon.diagnostics.recorderStartMs).toBe(150);

      mockNatif.appels.length = 0;
      mockNatif.refuse = (reglages, mesure) => Boolean(mesure) && reglages !== undefined;
      // Trois refus puis les défauts : quatre essais de 150 ms.
      expect((await enregistrer()).brouillon.diagnostics.recorderStartMs).toBe(600);
    } finally {
      horloge.mockRestore();
    }
  });
});
