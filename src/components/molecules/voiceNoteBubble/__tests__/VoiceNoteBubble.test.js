import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import VoiceNoteBubble from '../VoiceNoteBubble';

// VOCAL — la bulle d'un message vocal : ce qu'elle promet.
//
// Témoin de caractérisation (E6) posé AVANT la refonte d'après la maquette de
// Claude Design (commit f98bfe1d), puis mis à jour par le lot : chaque
// changement VOULU par la maquette y est une ligne modifiée, visible dans le
// diff — le format 00:42 devient 0:42, l'onde passe à 31 pics normalisés, la
// vitesse s'écrit « 1× ». Ce qui ne devait PAS changer n'a pas bougé : le
// fichier absent se dit, le texte joint reste lisible, lire et changer de
// vitesse sont branchés.

const mockLecteur = {
  cycleSpeed: jest.fn(),
  durationMs: 0,
  endedAt: 0,
  isLoading: false,
  isPlayerAvailable: true,
  isPlaying: false,
  lastError: '',
  positionMs: 0,
  progress: 0,
  seekTo: jest.fn(),
  speed: 1,
  togglePlayback: jest.fn(),
};

jest.mock('react-native-reanimated', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').reanimated()
));
jest.mock('react-native-gesture-handler', () => (
  // eslint-disable-next-line global-require
  require('@/testSupport/animationDouble').gestureHandler()
));
jest.mock('@/hooks/useAudioPlayback', () => ({ __esModule: true, default: () => mockLecteur }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn(() => new Promise(() => {})) } }));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jwt' }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      const gabarit = repli?.count !== undefined && repli?.count > 1
        ? repli?.defaultValue_other
        : (repli?.defaultValue || repli?.defaultValue_one);
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => String(repli[nom]));
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

const AUDIO = [{ id: 0, mime: 'audio/mp4', url: 'https://cdn.example/v.m4a' }];
// Un vocal reçu APRÈS la première ouverture de cette version (le magasin du
// point « non écouté » réputé écouté tout ce qui est plus ancien).
const MAINTENANT = new Date(Date.now() + 60000).toISOString();

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
  .map((/** @type {any} */ n) => [].concat(n.props.children).map((e) => (typeof e === 'string' ? e : '')).join(''))
  .join(' | ');

/**
 * Un nœud natif par son identifiant de test.
 * @param {any} arbre - L'arbre monté.
 * @param {string} id - L'identifiant.
 * @returns {any[]} Les nœuds.
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string',
);

describe('VoiceNoteBubble — ce que la bulle garantit', () => {
  beforeEach(() => {
    mockLecteur.togglePlayback.mockClear();
    mockLecteur.cycleSpeed.mockClear();
    mockLecteur.isPlaying = false;
    mockLecteur.speed = 1;
  });

  it('1. sans fichier audio, la bulle le DIT, et garde le texte joint', () => {
    const arbre = monter({ attachments: [], composition: { durationMs: 3000 }, message: 'écoute ça' });
    expect(texte(arbre)).toContain('Note vocale indisponible');
    expect(texte(arbre)).toContain('écoute ça');
  });

  it('2. la durée enregistrée s\'affiche avant même la première écoute — en m:ss (maquette : plus de 00:42)', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    expect(texte(arbre)).toContain('0:42');
    expect(texte(arbre)).not.toContain('00:42');
  });

  it('3. lire et changer de vitesse sont branchés sur le lecteur', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    const [lecture] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'voice-note-play' && typeof n.props?.onPress === 'function',
    );
    act(() => { lecture.props.onPress(); });
    expect(mockLecteur.togglePlayback).toHaveBeenCalledTimes(1);
    const [vitesse] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'voice-note-speed' && typeof n.props?.onPress === 'function',
    );
    act(() => { vitesse.props.onPress(); });
    expect(mockLecteur.cycleSpeed).toHaveBeenCalledTimes(1);
  });

  it('4. l\'onde enregistrée est dessinée en 31 pics (deux rangs : non lu, lu), le plus fort au plafond', () => {
    const onde = [4, 8, 12, 16, 20, 16, 12, 8, 4, 10];
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 5000, waveform: onde } });
    const barres = parId(arbre, 'voice-static-bar');
    expect(barres).toHaveLength(31 * 2);
    const hauteurs = barres.slice(0, 31).map((/** @type {any} */ b) => StyleSheet.flatten(b.props.style).height);
    expect(Math.max(...hauteurs)).toBe(24);
    // Le pic (20) tombe sur la 5ᵉ valeur : la 14ᵉ ou 15ᵉ barre sur 31.
    expect(hauteurs.indexOf(24)).toBeGreaterThanOrEqual(12);
    expect(hauteurs.indexOf(24)).toBeLessThanOrEqual(15);
  });

  it('5. le texte joint au vocal (anciennes versions) reste lisible', () => {
    const arbre = monter({ attachments: AUDIO, composition: { durationMs: 5000 }, message: 'rdv 14h' });
    expect(texte(arbre)).toContain('rdv 14h');
  });
});

describe('VOCAL — état 4 · la bulle envoyée (maquette, M4)', () => {
  beforeEach(() => {
    mockLecteur.isPlaying = false;
    mockLecteur.speed = 1;
    // eslint-disable-next-line global-require
    require('@/domains/messaging/voiceListenedStore').resetVoiceListenedStoreForTests();
  });

  it('4.1 280 de large quelle que soit la durée, rayon 20, coin d\'attache 6 du côté de l\'auteur', () => {
    const mienne = monter({ attachments: AUDIO, composition: { durationMs: 2000 }, isMe: true });
    const autre = monter({ attachments: AUDIO, composition: { durationMs: 300000 } });
    const styleMienne = StyleSheet.flatten(parId(mienne, 'voice-note-bubble')[0].props.style);
    const styleAutre = StyleSheet.flatten(parId(autre, 'voice-note-bubble')[0].props.style);
    expect(styleMienne.width).toBe(280);
    expect(styleAutre.width).toBe(280);
    expect(styleMienne.borderRadius).toBe(20);
    expect(styleMienne.borderBottomRightRadius).toBe(6);
    expect(styleAutre.borderBottomLeftRadius).toBe(6);
  });

  it('4.2 la mienne est cyan à l\'encre sombre (8,0:1), celle d\'un autre primary700', () => {
    const mienne = monter({ attachments: AUDIO, composition: { durationMs: 2000 }, isMe: true });
    const autre = monter({ attachments: AUDIO, composition: { durationMs: 2000 } });
    expect(StyleSheet.flatten(parId(mienne, 'voice-note-bubble')[0].props.style).backgroundColor)
      .toBe(COULEURS.primary500);
    expect(StyleSheet.flatten(parId(autre, 'voice-note-bubble')[0].props.style).backgroundColor)
      .toBe(COULEURS.primary700);
    const temps = parId(mienne, 'voice-note-time')[0];
    expect(StyleSheet.flatten(temps.props.style).color).toBe(COULEURS.primary900);
  });

  it('4.3 le nom de l\'auteur au-dessus (pas sur les miennes), l\'heure dessous, « Envoi… » tant que le serveur n\'a pas répondu', () => {
    const autre = monter({
      attachments: AUDIO, composition: { durationMs: 2000 }, createdAt: '2026-09-23T12:32:00', senderName: 'Karim',
    });
    expect(texte(autre)).toContain('Karim');
    expect(parId(autre, 'voice-note-hour')[0].props.children).toBe('12:32');

    const enCours = monter({
      attachments: AUDIO, composition: { durationMs: 2000 }, isMe: true, isPending: true, senderName: 'Moi',
    });
    expect(texte(enCours)).not.toContain('Moi');
    expect(parId(enCours, 'voice-note-hour')[0].props.children).toBe('Envoi…');
  });

  it('4.4 le point « non écouté » : sur un vocal REÇU récent, dit aussi au lecteur d\'écran ; jamais sur les miens', () => {
    const recu = monter({
      attachments: AUDIO, composition: { durationMs: 42000 }, createdAt: MAINTENANT, messageId: 'm-1', senderName: 'Karim',
    });
    expect(parId(recu, 'voice-note-unlistened')).toHaveLength(1);
    const lecture = recu.root.findAll((/** @type {any} */ n) => n.props?.testID === 'voice-note-play'
      && n.props?.accessibilityLabel)[0];
    expect(lecture.props.accessibilityLabel).toBe('Message vocal de Karim, 42 secondes, non écouté');

    const mien = monter({
      attachments: AUDIO, composition: { durationMs: 42000 }, createdAt: MAINTENANT, isMe: true, messageId: 'm-2',
    });
    expect(parId(mien, 'voice-note-unlistened')).toHaveLength(0);
  });

  it('4.5 un vocal reçu AVANT cette version n\'allume pas de point (sinon tous les anciens s\'allumeraient d\'un coup)', () => {
    const ancien = monter({
      attachments: AUDIO, composition: { durationMs: 42000 }, createdAt: '2026-01-01T10:00:00Z', messageId: 'm-3',
    });
    expect(parId(ancien, 'voice-note-unlistened')).toHaveLength(0);
  });

  it('4.6 lancer la lecture éteint le point, et le téléphone s\'en souvient', () => {
    const props = {
      attachments: AUDIO, composition: { durationMs: 42000 }, createdAt: MAINTENANT, messageId: 'm-4',
    };
    const bulle = monter(props);
    expect(parId(bulle, 'voice-note-unlistened')).toHaveLength(1);
    mockLecteur.isPlaying = true;
    act(() => { bulle.update(createElement(VoiceNoteBubble, props)); });
    mockLecteur.isPlaying = false;
    const relue = monter(props);
    expect(parId(relue, 'voice-note-unlistened')).toHaveLength(0);
  });

  it('4.7 la vitesse toujours visible : « 1× », avec son nom pour le lecteur d\'écran', () => {
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 2000 } });
    expect(texte(bulle)).toContain('1×');
    const vitesse = bulle.root.findAll((/** @type {any} */ n) => n.props?.testID === 'voice-note-speed'
      && n.props?.accessibilityLabel)[0];
    expect(vitesse.props.accessibilityLabel).toBe('Vitesse de lecture : 1 fois');
    expect(vitesse.props.accessibilityHint).toBe('Touche deux fois pour passer à 1,5 fois.');
    // Zone tactile 44 × 44 : 24 de haut + 10 au-dessus et au-dessous.
    expect(vitesse.props.hitSlop).toEqual({ bottom: 10, top: 10 });
  });

  it('4.8 un ancien vocal (24 valeurs, l\'ancienne onde) s\'affiche aussi en 31 barres', () => {
    const vieux = Array.from({ length: 24 }, (_, i) => 4 + (i % 17));
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 5000, waveform: vieux } });
    expect(parId(bulle, 'voice-static-bar')).toHaveLength(62);
  });
});

describe('VOCAL — état 5 · en cours de lecture (maquette, M4)', () => {
  beforeEach(() => {
    mockLecteur.isPlaying = false;
    mockLecteur.positionMs = 0;
    mockLecteur.durationMs = 0;
    mockLecteur.speed = 1;
    mockLecteur.seekTo.mockClear();
  });

  /**
   * Le geste de l'onde : glisser (Pan) ou toucher (Tap).
   * @param {any} arbre - L'arbre monté.
   * @returns {{ glisse: any, toucher: any }} Les deux gestes.
   */
  const gestesOnde = (arbre) => {
    const detecteur = arbre.root.find(
      (/** @type {any} */ n) => n.props?.testID === 'gesture-detector' && typeof n.type === 'string',
    );
    const [glisse, toucher] = detecteur.props.gesture.gestes;
    return { glisse, toucher };
  };

  it('5.1 en lecture : « 0:17 / 0:42 », le bouton devient pause pour le lecteur d\'écran', () => {
    mockLecteur.isPlaying = true;
    mockLecteur.positionMs = 17400;
    mockLecteur.durationMs = 42000;
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    expect(texte(bulle)).toContain('0:17');
    expect(texte(bulle)).toContain(' / 0:42');
    const lecture = bulle.root.findAll((/** @type {any} */ n) => n.props?.testID === 'voice-note-play'
      && n.props?.accessibilityLabel)[0];
    expect(lecture.props.accessibilityLabel).toBe('Mettre en pause');
  });

  it('5.2 une vitesse autre que 1× est PLEINE : cyan chez l\'autre, encre chez moi', () => {
    mockLecteur.speed = 1.5;
    const autre = monter({ attachments: AUDIO, composition: { durationMs: 2000 } });
    const mienne = monter({ attachments: AUDIO, composition: { durationMs: 2000 }, isMe: true });
    expect(texte(autre)).toContain('1,5×');
    /**
     * Le fond de la pastille de vitesse.
     * @param {any} arbre - L'arbre monté.
     * @returns {string} La couleur.
     */
    const fondVitesse = (arbre) => {
      const pastille = arbre.root.find((/** @type {any} */ n) => n.props?.testID === 'voice-note-speed'
        && typeof n.type !== 'string');
      const interieur = pastille.findAll((/** @type {any} */ n) => typeof n.type === 'string'
        && StyleSheet.flatten(n.props.style)?.width === 42)[0];
      return StyleSheet.flatten(interieur.props.style).backgroundColor;
    };
    expect(fondVitesse(autre)).toBe(COULEURS.primary500);
    expect(fondVitesse(mienne)).toBe(COULEURS.primary900);
  });

  it('5.3 glisser sur l\'onde déplace la lecture : le milieu de l\'onde = le milieu du vocal', () => {
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    const { glisse } = gestesOnde(bulle);
    expect(glisse.reglages.activeOffsetX).toEqual([-8, 8]);
    expect(glisse.reglages.failOffsetY).toEqual([-10, 10]);
    act(() => { glisse.rappels.onStart({ x: 76.5 }); });
    expect(mockLecteur.seekTo).toHaveBeenCalledWith(21000);
  });

  it('5.4 toucher l\'onde y saute aussi ; au-delà des bords, on reste dans le vocal', () => {
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    const { toucher } = gestesOnde(bulle);
    act(() => { toucher.rappels.onEnd({ x: 999 }, true); });
    expect(mockLecteur.seekTo).toHaveBeenLastCalledWith(42000);
    act(() => { toucher.rappels.onEnd({ x: -20 }, true); });
    expect(mockLecteur.seekTo).toHaveBeenLastCalledWith(0);
  });

  it('5.5 lecteur d\'écran : l\'onde est réglable, « 17 secondes sur 42 », et avance de 5 s', () => {
    mockLecteur.positionMs = 17000;
    mockLecteur.durationMs = 42000;
    const bulle = monter({ attachments: AUDIO, composition: { durationMs: 42000 } });
    const onde = bulle.root.findAll((/** @type {any} */ n) => n.props?.testID === 'voice-note-wave'
      && n.props?.accessibilityRole)[0];
    expect(onde.props.accessibilityRole).toBe('adjustable');
    expect(onde.props.accessibilityValue).toEqual({ text: '17 secondes sur 42' });
    act(() => { onde.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); });
    expect(mockLecteur.seekTo).toHaveBeenLastCalledWith(22000);
    act(() => { onde.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }); });
    expect(mockLecteur.seekTo).toHaveBeenLastCalledWith(12000);
  });
});

// MSG1A (§3.6) — DANS LE CADRE COMMUN DU FIL : seul changement du pack, l'heure et les coches
// passent DANS la bulle (a droite, sous l'onde) ; le nom et la queue sont ceux du cadre, et ma
// bulle prend le fond petrol du fil (les commandes reprennent les couleurs « recues »).
// 🔴 ROUGE avant MSG1A : V1, V2, V3.
describe('MSG1A — le vocal dans la bulle du fil', () => {
  beforeEach(() => {
    mockLecteur.isPlaying = false;
    mockLecteur.speed = 1;
    // eslint-disable-next-line global-require
    require('@/domains/messaging/voiceListenedStore').resetVoiceListenedStoreForTests();
  });

  it('V1 — l heure (meta) est DANS la bulle, plus dessous', () => {
    // eslint-disable-next-line global-require
    const { Text: TexteRN } = require('react-native');
    const meta = createElement(TexteRN, { testID: 'meta-test' }, '11:10');
    const arbre = monter({
      attachments: AUDIO, composition: { durationMs: 4000 }, dansLaBulle: true, isMe: true, meta,
    });

    const bulle = parId(arbre, 'voice-note-bubble')[0];
    expect(bulle.findAll((n) => n.props?.testID === 'meta-test').length).toBeGreaterThan(0);
    expect(parId(arbre, 'voice-note-hour')).toHaveLength(0);
  });

  it('V2 — pas de fond ni de nom propres : c est le cadre du fil qui les porte', () => {
    const arbre = monter({
      attachments: AUDIO, composition: { durationMs: 4000 }, dansLaBulle: true, senderName: 'Karim',
    });

    const style = StyleSheet.flatten(parId(arbre, 'voice-note-bubble')[0].props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.width).toBe(260);
    expect(texte(arbre)).not.toContain('Karim');
  });

  it('V3 — ma bulle petrole : lecture cyan a l encre sombre, comme sur une bulle recue', () => {
    const arbre = monter({
      attachments: AUDIO, composition: { durationMs: 4000 }, dansLaBulle: true, isMe: true,
    });

    expect(StyleSheet.flatten(parId(arbre, 'voice-note-play')[0].props.style).backgroundColor)
      .toBe(COULEURS.primary500);
  });
});
