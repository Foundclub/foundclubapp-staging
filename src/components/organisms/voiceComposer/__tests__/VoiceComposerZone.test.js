import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  cancelRecording,
  deleteVoiceNoteFile,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';

import VoiceComposerZone from '../VoiceComposerZone';

// Le journal des animations : la MÊME instance que celle des doublures.
const { journal } = require('@/testSupport/animationDouble');

// VOCAL — LA ZONE VOCALE, geste par geste (maquette de Claude Design, 23/09).
//
// Les portes vertes ne voient ni l'animation ni la mise en page. Ce témoin
// vérifie ce qu'elles PEUVENT voir, et c'est ce qui compte le plus : qui
// enregistre, quand, ce qui part et ce qui est jeté. Les gestes sont joués
// dans l'ordre exact où Gesture Handler appellerait leurs rappels
// (`testSupport/animationDouble`), le micro natif est doublé.

jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));
jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue_other === 'string') return repli.defaultValue_other;
      return cle;
    },
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
jest.mock('@/hooks/useAudioPlayback', () => ({
  __esModule: true,
  default: () => ({}),
  pauseActivePlayback: () => {},
}));

/** Le micro de doublure : ce qu'on lui a demandé, et la durée qu'il rendra à l'arrêt. */
const mockMicro = {
  demarrages: /** @type {any[]} */ ([]),
  dureeMs: 3000,
};
jest.mock('@/services/chat/voiceNoteService', () => ({
  cancelRecording: jest.fn(() => Promise.resolve()),
  deleteVoiceNoteFile: jest.fn(() => Promise.resolve()),
  startRecording: jest.fn((/** @type {any} */ rappels) => {
    mockMicro.demarrages.push(rappels);
    return Promise.resolve({ filePath: '/cache/v.m4a' });
  }),
  stopRecording: jest.fn(() => Promise.resolve({
    durationMs: mockMicro.dureeMs,
    fileName: 'v.m4a',
    levels: [0.1, 0.8, 0.4],
    mime: 'audio/mp4',
    size: 2048,
    uri: 'file:///cache/v.m4a',
    waveform: [4, 20, 12],
  })),
}));

/**
 * Monte la zone autour d'une fausse rangée.
 * @param {object} [props] - Les propriétés de la zone.
 * @returns {{ arbre: any, onSend: jest.Mock, onError: jest.Mock, onUnavailable: jest.Mock }} La zone.
 */
const monter = (props = {}) => {
  const onSend = jest.fn(() => true);
  const onError = jest.fn();
  const onUnavailable = jest.fn();
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      VoiceComposerZone,
      {
        actif: true, onError, onSend, onUnavailable, visible: true, ...props,
      },
      createElement(Text, null, 'rangée'),
    ));
  });
  return {
    arbre, onError, onSend, onUnavailable,
  };
};

/**
 * Les gestes du micro : l'appui long et le toucher court.
 * @param {any} arbre - L'arbre monté.
 * @returns {{ appui: any, toucher: any }} Les gestes.
 */
const gestes = (arbre) => {
  const detecteur = arbre.root.find(
    (/** @type {any} */ n) => n.props?.testID === 'gesture-detector' && typeof n.type === 'string',
  );
  const [appui, toucher] = detecteur.props.gesture.gestes;
  return { appui, toucher };
};

/**
 * Laisse passer la file du micro (démarrer, arrêter sont asynchrones).
 * @returns {Promise<void>} Quand c'est fait.
 */
const laisserFiler = async () => {
  await act(async () => {
    await new Promise((r) => { setImmediate(r); });
  });
};

/**
 * Un nœud natif par son identifiant de test.
 * @param {any} arbre - L'arbre monté.
 * @param {string} id - L'identifiant.
 * @returns {any[]} Les nœuds.
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string',
);

describe('VOCAL — état 1 · au repos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMicro.demarrages.length = 0;
    mockMicro.dureeMs = 3000;
    journal.length = 0;
  });

  it('1.1 le micro est là, nommé pour le lecteur d\'écran, avec son mode d\'emploi', () => {
    const { arbre } = monter();
    const [micro] = parId(arbre, 'voice-mic');
    expect(micro.props.accessibilityLabel).toBe('Enregistrer un message vocal');
    expect(micro.props.accessibilityHint).toBe('Maintiens pour enregistrer, relâche pour envoyer.');
    expect(micro.props.accessibilityRole).toBe('button');
  });

  it('1.2 l\'appui long est réglé comme la maquette : 200 ms, et le toucher court au-delà de 200 ms n\'en est plus un', () => {
    const { arbre } = monter();
    const { appui, toucher } = gestes(arbre);
    expect(appui.type).toBe('Pan');
    expect(appui.reglages.activateAfterLongPress).toBe(200);
    expect(toucher.type).toBe('Tap');
    expect(toucher.reglages.maxDuration).toBe(200);
  });

  it('1.3 un toucher court ouvre le micro dès le contact, puis le referme SANS RIEN ENVOYER, et montre la bulle d\'aide 2 s', async () => {
    const { arbre, onSend } = monter();
    const { appui, toucher } = gestes(arbre);

    await act(async () => { appui.rappels.onBegin(); });
    await laisserFiler();
    // Le micro s'ouvre au contact : la première syllabe n'est jamais coupée.
    expect(startRecording).toHaveBeenCalledTimes(1);

    await act(async () => {
      appui.rappels.onFinalize({}, false); // l'appui long n'a jamais été acquis
      toucher.rappels.onEnd({}, true);
    });
    await laisserFiler();

    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(stopRecording).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    // La bulle : apparaît, tient 2 000 ms, disparaît.
    const sequence = journal.find((e) => e.fn === 'withSequence');
    expect(sequence?.args[0]).toBe(1);
    expect(journal.some((e) => e.fn === 'withDelay' && e.args[0] === 2000)).toBe(true);
    expect(sequence?.args[1]).toBe(0);
  });

  it('1.4 une lettre tapée : le micro s\'efface (fondu de 120 ms) et ne capte plus le doigt', () => {
    const { arbre } = monter({ visible: false });
    const place = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.pointerEvents === 'none'
        && n.findAll((/** @type {any} */ e) => e.props?.testID === 'voice-mic').length > 0,
    );
    expect(place.length).toBeGreaterThan(0);
    expect(journal.some((e) => e.fn === 'withTiming' && e.args[0] === 0 && e.args[1]?.duration === 120))
      .toBe(true);
  });

  it('1.5 un téléphone qui ne sait pas enregistrer : le micro le DIT au toucher, sans rien ouvrir', () => {
    const { arbre, onUnavailable } = monter({ actif: false });
    const [micro] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'voice-mic' && typeof n.props?.onPress === 'function',
    );
    act(() => { micro.props.onPress(); });
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(startRecording).not.toHaveBeenCalled();
  });

  it('1.6 lecteur d\'écran : le double-tap ouvre directement l\'enregistrement VERROUILLÉ (mains libres)', async () => {
    const { arbre } = monter();
    const [micro] = parId(arbre, 'voice-mic');
    await act(async () => {
      micro.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });
    await laisserFiler();
    expect(startRecording).toHaveBeenCalledTimes(1);
    // Verrouillé : le micro est devenu Envoyer.
    expect(parId(arbre, 'voice-send')).toHaveLength(1);
    expect(deleteVoiceNoteFile).not.toHaveBeenCalled();
  });
});
