import { createElement } from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import {
  cancelRecording,
  deleteVoiceNoteFile,
  startRecording,
  stopRecording,
} from '@/services/chat/voiceNoteService';
import { VOICE_MAX_TAKE_MS } from '@/services/chat/voiceWaveform';

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
      const gabarit = repli?.defaultValue || repli?.defaultValue_other;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ _m, /** @type {string} */ nom) => String(repli[nom]));
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
/** Le réglage « réduire les animations » du téléphone de doublure. */
const mockReduire = { actif: false };
jest.mock('@/hooks/useReduceMotion', () => ({ __esModule: true, default: () => mockReduire.actif }));
jest.mock('@/hooks/useAudioPlayback', () => ({
  __esModule: true,
  default: () => ({}),
  pauseActivePlayback: () => {},
}));

/** Le micro de doublure : ce qu'on lui a demandé, et la durée qu'il rendra à l'arrêt. */
const mockMicro = {
  demarrages: /** @type {any[]} */ ([]),
  /** Démarrage différé : le micro ne s'ouvre qu'à l'appel de `liberer`. */
  differer: false,
  dureeMs: 3000,
  /** Le micro natif est-il ouvert ? (le vrai service IGNORE une annulation pendant qu'il démarre). */
  liberer: () => {},
  ouvert: false,
};
jest.mock('@/services/chat/voiceNoteService', () => ({
  cancelRecording: jest.fn(() => {
    mockMicro.ouvert = false;
    return Promise.resolve();
  }),
  deleteVoiceNoteFile: jest.fn(() => Promise.resolve()),
  startRecording: jest.fn((/** @type {any} */ rappels) => {
    mockMicro.demarrages.push(rappels);
    if (!mockMicro.differer) {
      mockMicro.ouvert = true;
      return Promise.resolve({ filePath: '/cache/v.m4a' });
    }
    return new Promise((resoudre) => {
      mockMicro.liberer = () => {
        mockMicro.ouvert = true;
        resoudre({ filePath: '/cache/v.m4a' });
      };
    });
  }),
  stopRecording: jest.fn(() => {
    mockMicro.ouvert = false;
    return Promise.resolve({
      durationMs: mockMicro.dureeMs,
      fileName: 'v.m4a',
      levels: [0.1, 0.8, 0.4],
      mime: 'audio/mp4',
      size: 2048,
      uri: 'file:///cache/v.m4a',
      waveform: [4, 20, 12],
    });
  }),
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
    mockMicro.differer = false;
    mockMicro.ouvert = false;
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

  it('1.3 bis le doigt se lève AVANT que le micro ait fini de s\'ouvrir : il est quand même refermé', async () => {
    // Le vrai service ignore une annulation pendant qu'il démarre (permission,
    // fichier) : sans file d'attente, le micro restait ouvert, sans personne
    // pour l'arrêter.
    mockMicro.differer = true;
    const { arbre } = monter();
    const { appui, toucher: court } = gestes(arbre);
    await act(async () => { appui.rappels.onBegin(); });
    await act(async () => {
      appui.rappels.onFinalize({}, false);
      court.rappels.onEnd({}, true);
    });
    // Le micro s'ouvre seulement maintenant.
    await act(async () => { mockMicro.liberer(); });
    await laisserFiler();
    expect(mockMicro.ouvert).toBe(false);
  });

  it('Q3-04 quitter la conversation pendant que le micro démarre : il ne reste pas allumé', async () => {
    mockMicro.differer = true;
    const { arbre } = monter();
    const { appui } = gestes(arbre);
    await act(async () => { appui.rappels.onBegin(); });
    // L'écran se ferme AVANT que le micro ait fini de s'ouvrir.
    act(() => { arbre.unmount(); });
    await act(async () => { mockMicro.liberer(); });
    await laisserFiler();
    expect(mockMicro.ouvert).toBe(false);
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

/**
 * Le style APLATI d'un nœud (les styles animés de la doublure sont vivants :
 * on lit la destination posée par la chorégraphie).
 * @param {any} noeud - Le nœud.
 * @returns {any} Le style.
 */
const styleDe = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

/**
 * Pose le doigt et le garde 200 ms : l'appui long est acquis.
 * @param {any} arbre - L'arbre monté.
 * @returns {Promise<any>} Le geste d'appui.
 */
const maintenir = async (arbre) => {
  const { appui } = gestes(arbre);
  await act(async () => { appui.rappels.onBegin(); });
  await laisserFiler();
  await act(async () => { appui.rappels.onStart(); });
  await laisserFiler();
  return appui;
};

/**
 * Le doigt bouge.
 * @param {any} appui - Le geste d'appui.
 * @param {number} dx - Déplacement horizontal.
 * @param {number} dy - Déplacement vertical.
 * @returns {Promise<void>} Quand c'est fait.
 */
const glisser = async (appui, dx, dy) => {
  await act(async () => { appui.rappels.onUpdate({ translationX: dx, translationY: dy }); });
  await laisserFiler();
};

/**
 * Le doigt se lève (geste terminé normalement).
 * @param {any} appui - Le geste d'appui.
 * @returns {Promise<void>} Quand c'est fait.
 */
const relacher = async (appui) => {
  await act(async () => {
    appui.rappels.onEnd({}, true);
    appui.rappels.onFinalize({}, true);
  });
  await laisserFiler();
};

/**
 * Appuie sur un bouton par son identifiant de test.
 * @param {any} arbre - L'arbre monté.
 * @param {string} id - L'identifiant.
 * @returns {Promise<void>} Quand c'est fait.
 */
const toucher = async (arbre, id) => {
  const [bouton] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function',
  );
  await act(async () => { bouton.props.onPress(); });
  await laisserFiler();
};

/**
 * Les rappels du micro natif (les niveaux, le temps).
 * @returns {any} Les rappels de la dernière prise.
 */
const rappelsDuMicro = () => mockMicro.demarrages[mockMicro.demarrages.length - 1];

describe('VOCAL — état 2 · maintien du micro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMicro.demarrages.length = 0;
    mockMicro.dureeMs = 3000;
    mockReduire.actif = false;
    journal.length = 0;
  });

  it('2.1 200 ms d\'appui : la bande remplace le + et le champ, le micro passe à 64 et rougit, le cadenas monte', async () => {
    const { arbre } = monter();
    await maintenir(arbre);

    expect(styleDe(parId(arbre, 'voice-recording-strip')[0]).opacity).toBe(1);
    expect(styleDe(parId(arbre, 'voice-lock')[0]).opacity).toBe(1);
    // Le cadenas : 44 × 96 tant que le doigt n'a pas bougé.
    expect(styleDe(parId(arbre, 'voice-lock')[0]).height).toBe(96);
    // Le ressort snappy de la maquette : damping 22, stiffness 280, masse 1, vers 64 / 44.
    const ressort = journal.find((e) => e.fn === 'withSpring' && Math.abs(e.args[0] - (64 / 44)) < 1e-9);
    expect(ressort?.args[1]).toEqual({ damping: 22, mass: 1, stiffness: 280 });
    // Le point clignote (500 ms par demi-cycle), l'indice et le chevron oscillent.
    expect(journal.filter((e) => e.fn === 'withRepeat')).toHaveLength(3);
  });

  it('2.2 relâcher après 0,8 s : ça part — le vocal est confié à l\'écran, la bande s\'efface', async () => {
    const { arbre, onSend } = monter();
    const appui = await maintenir(arbre);
    await relacher(appui);

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toEqual(expect.objectContaining({
      durationMs: 3000, uri: 'file:///cache/v.m4a', waveform: [4, 20, 12],
    }));
    expect(styleDe(parId(arbre, 'voice-recording-strip')[0]).opacity).toBe(0);
    expect(deleteVoiceNoteFile).not.toHaveBeenCalled();
  });

  it('2.3 relâcher avant 0,8 s : la prise est JETÉE (fichier effacé) et la bulle d\'aide revient', async () => {
    mockMicro.dureeMs = 799;
    const { arbre, onSend } = monter();
    const appui = await maintenir(arbre);
    await relacher(appui);

    expect(onSend).not.toHaveBeenCalled();
    expect(deleteVoiceNoteFile).toHaveBeenCalledWith('file:///cache/v.m4a');
    expect(journal.some((e) => e.fn === 'withDelay' && e.args[0] === 2000)).toBe(true);
  });

  it('2.4 glisser à gauche : suivi 1:1 jusqu\'à −119, ANNULÉ au franchissement de −120, sans attendre le relâché', async () => {
    const { arbre, onSend } = monter();
    const appui = await maintenir(arbre);

    await glisser(appui, -60, 0);
    // À mi-course : l'indice suit le doigt et pâlit de moitié, l'onde descend à 0,65.
    const bande = parId(arbre, 'voice-recording-strip')[0];
    const indice = bande.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && styleDe(n).flexDirection === 'row' && styleDe(n).gap === 2)[0];
    expect(styleDe(indice).opacity).toBeCloseTo(0.5, 6);
    expect(styleDe(indice).transform[0].translateX).toBe(-60);

    await glisser(appui, -119, 0);
    expect(cancelRecording).not.toHaveBeenCalled();

    await glisser(appui, -120, 0);
    expect(cancelRecording).toHaveBeenCalledTimes(1);

    // Le doigt se lève ensuite : il ne se passe plus rien.
    await relacher(appui);
    expect(stopRecording).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    // Le point devient une corbeille (scale 0,6 → 1), qui s'efface à 240 ms.
    expect(journal.some((e) => e.fn === 'withDelay' && e.args[0] === 240)).toBe(true);
  });

  it('2.5 glisser vers le haut jusqu\'à −80 : VERROUILLÉ — le relâché qui suit ne fait rien', async () => {
    const { arbre, onSend } = monter();
    const appui = await maintenir(arbre);

    await glisser(appui, 0, -40);
    // Le cadenas descend à la rencontre du doigt : 96 → 80 à mi-course.
    expect(styleDe(parId(arbre, 'voice-lock')[0]).height).toBe(80);

    await glisser(appui, 0, -80);
    await relacher(appui);

    expect(stopRecording).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(parId(arbre, 'voice-send')).toHaveLength(1);
    expect(parId(arbre, 'voice-stop')).toHaveLength(1);
    expect(parId(arbre, 'voice-trash')).toHaveLength(1);
  });

  it('2.6 l\'axe est décidé à 12 px : parti vers le haut, un glisser à gauche n\'annule plus', async () => {
    const { arbre } = monter();
    const appui = await maintenir(arbre);
    await glisser(appui, 0, -13);
    await glisser(appui, -150, -13);
    expect(cancelRecording).not.toHaveBeenCalled();
  });

  it('2.7 la voix fait bouger l\'onde, et le chronomètre compte en m:ss', async () => {
    const { arbre } = monter();
    await maintenir(arbre);
    const rappels = rappelsDuMicro();
    await act(async () => {
      [-60, -60, -6, -6, -6].forEach((db, rang) => rappels.onMetering(db, (rang + 1) * 50));
      rappels.onMetering(-6, 1050);
    });

    const hauteurs = parId(arbre, 'voice-recording-strip')[0]
      .findAll((/** @type {any} */ n) => typeof n.type === 'string' && styleDe(n).width === 2)
      .map((/** @type {any} */ n) => styleDe(n).height);
    // Silence au plancher (3 px), voix forte au plafond (24 px).
    expect(Math.max(...hauteurs)).toBe(24);
    expect(hauteurs).toContain(3);
    const chrono = arbre.root.find(
      (/** @type {any} */ n) => n.props?.testID === 'voice-chrono' && typeof n.type === 'string',
    );
    expect(chrono.props.children).toBe('0:01');
  });

  it('2.8 « réduire les animations » : aucune boucle (point fixe, indice et chevron immobiles)', async () => {
    mockReduire.actif = true;
    const { arbre } = monter();
    await maintenir(arbre);
    expect(journal.filter((e) => e.fn === 'withRepeat')).toHaveLength(0);
    // Les ressorts deviennent 160 ms easeOut.
    expect(journal.some((e) => e.fn === 'withSpring')).toBe(false);
  });
});

describe('VOCAL — états 3A et 3B · verrouillé, puis réécoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMicro.demarrages.length = 0;
    mockMicro.dureeMs = 3000;
    mockReduire.actif = false;
    journal.length = 0;
  });

  /**
   * Maintient, glisse jusqu'au cadenas, relâche : le verrouillé.
   * @param {any} arbre - L'arbre monté.
   * @returns {Promise<void>} Quand c'est fait.
   */
  const verrouiller = async (arbre) => {
    const appui = await maintenir(arbre);
    await glisser(appui, 0, -80);
    await relacher(appui);
  };

  it('3A.1 verrouillé → Envoyer : ça part tout de suite, sans réécoute', async () => {
    const { arbre, onSend } = monter();
    await verrouiller(arbre);
    await toucher(arbre, 'voice-send');
    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(parId(arbre, 'voice-mic')).toHaveLength(1);
  });

  it('3A.2 verrouillé → Supprimer : la prise est annulée, rien ne part', async () => {
    const { arbre, onSend } = monter();
    await verrouiller(arbre);
    await toucher(arbre, 'voice-trash');
    expect(cancelRecording).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('3B.1 verrouillé → Stop : la réécoute s\'ouvre avec toute la prise et sa durée', async () => {
    const { arbre, onSend } = monter();
    await verrouiller(arbre);
    await toucher(arbre, 'voice-stop');

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    const pastille = parId(arbre, 'voice-review-pill')[0];
    expect(styleDe(pastille).opacity).toBe(1);
    const temps = arbre.root.find(
      (/** @type {any} */ n) => n.props?.testID === 'voice-review-time' && typeof n.type === 'string',
    );
    expect(temps.props.children).toBe('0:03');
    const lecture = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'voice-review-play' && n.props?.accessibilityLabel,
    )[0];
    expect(lecture.props.accessibilityLabel).toBe('Réécouter');
  });

  it('3B.2 réécoute → Envoyer : le vocal réécouté part, une seule fois', async () => {
    const { arbre, onSend } = monter();
    await verrouiller(arbre);
    await toucher(arbre, 'voice-stop');
    await toucher(arbre, 'voice-send');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0].uri).toBe('file:///cache/v.m4a');
    expect(deleteVoiceNoteFile).not.toHaveBeenCalled();
  });

  it('3B.3 réécoute → Supprimer : le fichier est effacé, rien ne part', async () => {
    const { arbre, onSend } = monter();
    await verrouiller(arbre);
    await toucher(arbre, 'voice-stop');
    await toucher(arbre, 'voice-trash');
    expect(deleteVoiceNoteFile).toHaveBeenCalledWith('file:///cache/v.m4a');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('3B.4 un envoi qui ÉCHOUE rend le vocal à la réécoute : rien n\'est perdu', async () => {
    const { arbre, onSend } = monter();
    onSend.mockImplementation(() => false);
    const appui = await maintenir(arbre);
    await relacher(appui);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(styleDe(parId(arbre, 'voice-review-pill')[0]).opacity).toBe(1);
    expect(deleteVoiceNoteFile).not.toHaveBeenCalled();
  });

  it('3B.5 l\'app passe en arrière-plan pendant l\'appui : arrêt, et réécoute — rien n\'est perdu', async () => {
    const ecouteurs = /** @type {Function[]} */ ([]);
    const espion = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, f) => {
      ecouteurs.push(f);
      return /** @type {any} */ ({ remove: () => {} });
    });
    const { arbre, onSend } = monter();
    await maintenir(arbre);
    await act(async () => { ecouteurs.forEach((f) => f('background')); });
    await laisserFiler();

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(styleDe(parId(arbre, 'voice-review-pill')[0]).opacity).toBe(1);
    espion.mockRestore();
  });

  it('3B.6 la durée maximale atteinte : arrêt automatique et réécoute', async () => {
    const { arbre, onSend } = monter();
    await maintenir(arbre);
    await act(async () => { rappelsDuMicro().onProgress(VOICE_MAX_TAKE_MS); });
    await laisserFiler();

    expect(stopRecording).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(styleDe(parId(arbre, 'voice-review-pill')[0]).opacity).toBe(1);
  });

  it('3B.7 VOCAL2 — à 10:00, la bulle dit POURQUOI ça s\'arrête, rien n\'est perdu', async () => {
    const { arbre } = monter();
    await maintenir(arbre);
    await act(async () => { rappelsDuMicro().onProgress(10 * 60 * 1000); });
    await laisserFiler();

    expect(VOICE_MAX_TAKE_MS).toBe(10 * 60 * 1000);
    const bulle = parId(arbre, 'voice-hold-tip')[0];
    const texte = bulle
      .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.type === 'Text')
      .map((/** @type {any} */ n) => [].concat(n.props.children).join('')).join('');
    expect(texte).toBe('Arrêté à 10 minutes : réécoute, puis envoie.');
    expect(journal.some((e) => e.fn === 'withDelay' && e.args[0] === 2000)).toBe(true);
    expect(deleteVoiceNoteFile).not.toHaveBeenCalled();
  });

  it('3B.8 VOCAL2 — à T−15 s : chrono ROUGE, une seule annonce vocale', async () => {
    const annonce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const { arbre } = monter();
    await maintenir(arbre);
    const chrono = () => arbre.root.find(
      (/** @type {any} */ n) => n.props?.testID === 'voice-chrono' && typeof n.type === 'string',
    );
    await act(async () => { rappelsDuMicro().onMetering(-20, 584000); });
    expect(styleDe(chrono()).color).toBe(COULEURS.neutral00);
    await act(async () => { rappelsDuMicro().onMetering(-20, 585000); });
    expect(styleDe(chrono()).color).toBe(COULEURS.error300);
    await act(async () => { rappelsDuMicro().onMetering(-20, 586000); });
    expect(annonce).toHaveBeenCalledTimes(1);
    expect(annonce).toHaveBeenCalledWith('Plus que 15 secondes d\'enregistrement');
    annonce.mockRestore();
  });
});

describe('VOCAL — correctif vu au banc de captures (23/09)', () => {
  it('le cadre de l\'onde vivante a sa propre hauteur (28) et PAS de flex : sinon il tombe à 0 px et l\'onde disparaît', () => {
    const { arbre } = monter();
    const bande = parId(arbre, 'voice-recording-strip')[0];
    const cadres = bande.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && styleDe(n).height === 28 && styleDe(n).overflow === 'hidden');
    expect(cadres.length).toBeGreaterThan(0);
    cadres.forEach((/** @type {any} */ cadre) => expect(styleDe(cadre).flex).toBeUndefined());
  });
});
