// VOCAL — les calculs de la maquette de Claude Design, en témoins.
//
// Les portes vertes ne voient ni la mise en page ni l'animation. Ce qu'elles
// PEUVENT voir, ce sont les nombres qui pilotent l'une et l'autre : la hauteur
// d'une barre, la réduction d'un vocal en 31 pics, les seuils des gestes, le
// format du chronomètre. Ce fichier les fige tels que la maquette les donne
// (README.md du paquet, sections « Forme d'onde » et « Gestes »).

import {
  bucketPeaks,
  formatVoiceClock,
  formatVoiceSpeed,
  isTakeTooShort,
  levelsToStoredWaveform,
  meteringToLevel,
  resolveGestureAxis,
  storedWaveformToLevels,
  VOICE_AXIS_LOCK_PX,
  VOICE_BAR_MAX,
  VOICE_BAR_MIN,
  VOICE_BUBBLE_BARS,
  VOICE_CANCEL_TX,
  VOICE_HOLD_ACTIVATION_MS,
  VOICE_LOCK_TY,
  VOICE_MIN_TAKE_MS,
  voiceBarHeight,
} from '@/services/chat/voiceWaveform';

describe('VOCAL — la hauteur d\'une barre : 3 + 21 · clamp((v − 0,02) / 0,98)^0,7', () => {
  it('le souffle (≤ 0,02) reste à 3 px, le plein niveau monte à 24 px', () => {
    expect(VOICE_BAR_MIN).toBe(3);
    expect(VOICE_BAR_MAX).toBe(24);
    expect(voiceBarHeight(0)).toBe(3);
    expect(voiceBarHeight(0.02)).toBe(3);
    expect(voiceBarHeight(1)).toBe(24);
    expect(voiceBarHeight(2)).toBe(24);
    expect(voiceBarHeight(-1)).toBe(3);
  });

  it('une voix normale (0,5) est lisible : l\'exposant 0,7 la remonte au-dessus du milieu', () => {
    const attendu = 3 + (21 * ((0.48 / 0.98) ** 0.7));
    expect(voiceBarHeight(0.5)).toBeCloseTo(attendu, 6);
    expect(voiceBarHeight(0.5)).toBeGreaterThan((3 + 24) / 2);
  });
});

describe('VOCAL — du micro au niveau 0 → 1', () => {
  it('les décibels du téléphone (−160 → 0) deviennent un niveau', () => {
    expect(meteringToLevel(-160)).toBe(0);
    expect(meteringToLevel(-50)).toBe(0);
    expect(meteringToLevel(-6)).toBe(1);
    expect(meteringToLevel(0)).toBe(1);
    expect(meteringToLevel(-28)).toBeCloseTo(0.5 ** 1.4, 6);
  });

  it('un micro muet (null, NaN) rend 0 : l\'onde continue de défiler, au plancher', () => {
    expect(meteringToLevel(null)).toBe(0);
    expect(meteringToLevel(Number.NaN)).toBe(0);
    expect(meteringToLevel(undefined)).toBe(0);
  });
});

describe('VOCAL — la bulle : un pic par tranche, sur TOUT le vocal', () => {
  it('31 barres par défaut, quelle que soit la durée', () => {
    expect(VOICE_BUBBLE_BARS).toBe(31);
    expect(bucketPeaks(Array.from({ length: 1200 }, () => 0.5))).toHaveLength(31);
    expect(bucketPeaks(Array.from({ length: 7 }, () => 0.5))).toHaveLength(31);
  });

  it('le PIC, pas la moyenne : une syllabe isolée reste visible', () => {
    const niveaux = Array.from({ length: 310 }, () => 0.1);
    niveaux[155] = 0.9; // une seule syllabe forte, au milieu
    const pics = bucketPeaks(niveaux);
    expect(Math.max(...pics)).toBe(1); // normalisé sur le pic du vocal
    expect(pics.indexOf(1)).toBe(15);
  });

  it('normalisé sur le pic, avec un plancher à 0,2 : un chuchotement garde sa forme sans devenir un cri', () => {
    const chuchotement = Array.from({ length: 62 }, (_, i) => (i % 2 ? 0.1 : 0.05));
    const pics = bucketPeaks(chuchotement);
    expect(Math.max(...pics)).toBeCloseTo(0.1 / 0.2, 6);
  });

  it('un vocal d\'une minute garde sa première moitié', () => {
    const niveaux = [...Array.from({ length: 600 }, () => 0.9), ...Array.from({ length: 600 }, () => 0)];
    const pics = bucketPeaks(niveaux);
    expect(pics.slice(0, 15).every((v) => v === 1)).toBe(true);
    expect(pics.slice(16).every((v) => v === 0)).toBe(true);
  });
});

describe('VOCAL — l\'onde ENREGISTRÉE avec le message reste lisible par les anciennes versions', () => {
  it('31 valeurs entières entre 4 et 20 : l\'ancienne échelle, que le serveur (0 → 40, 64 max) et l\'app déjà installée (≤ 32) acceptent', () => {
    const onde = levelsToStoredWaveform(Array.from({ length: 400 }, (_, i) => (i % 40) / 40));
    expect(onde).toHaveLength(31);
    onde.forEach((h) => {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(4);
      expect(h).toBeLessThanOrEqual(20);
    });
    expect(Math.max(...onde)).toBe(20);
  });

  it('relire une onde stockée rend des niveaux 0 → 1 (aller-retour sans dérive)', () => {
    expect(storedWaveformToLevels([4, 12, 20])).toEqual([0, 0.5, 1]);
    const onde = levelsToStoredWaveform([0, 0.25, 0.5, 1]);
    expect(levelsToStoredWaveform(storedWaveformToLevels(onde))).toEqual(onde);
  });

  it('une onde vide ou illisible ne jette pas : elle rend une liste vide', () => {
    expect(storedWaveformToLevels(undefined)).toEqual([]);
    expect(storedWaveformToLevels(['a', null])).toEqual([]);
    expect(levelsToStoredWaveform([])).toEqual([]);
  });

  it('une vieille onde en décibels (négatifs) est ramenée entre 0 et 1', () => {
    const niveaux = storedWaveformToLevels([-60, -30, 0]);
    expect(niveaux).toEqual([0, 0.5, 1]);
  });
});

describe('VOCAL — les seuils des gestes (section « Gestes » de la maquette)', () => {
  it('les valeurs de la maquette, une par une', () => {
    expect(VOICE_HOLD_ACTIVATION_MS).toBe(200);
    expect(VOICE_AXIS_LOCK_PX).toBe(12);
    expect(VOICE_CANCEL_TX).toBe(-120);
    expect(VOICE_LOCK_TY).toBe(-80);
    expect(VOICE_MIN_TAKE_MS).toBe(800);
  });

  it('l\'axe se décide à 12 px : le premier qui sort du carré gagne', () => {
    expect(resolveGestureAxis(0, 0, null)).toBe(null);
    expect(resolveGestureAxis(-12, 0, null)).toBe(null);
    expect(resolveGestureAxis(-13, 0, null)).toBe('x');
    expect(resolveGestureAxis(0, -13, null)).toBe('y');
    expect(resolveGestureAxis(-20, -15, null)).toBe('x');
    expect(resolveGestureAxis(-10, -20, null)).toBe('y');
  });

  it('une fois choisi, l\'axe ne change plus jusqu\'au relâché', () => {
    expect(resolveGestureAxis(0, -90, 'x')).toBe('x');
    expect(resolveGestureAxis(-90, 0, 'y')).toBe('y');
  });

  it('une prise de moins de 0,8 s est jetée', () => {
    expect(isTakeTooShort(799)).toBe(true);
    expect(isTakeTooShort(800)).toBe(false);
  });
});

describe('VOCAL — ce qui s\'écrit à l\'écran', () => {
  it('le chronomètre en m:ss, plus de 00:02', () => {
    expect(formatVoiceClock(0)).toBe('0:00');
    expect(formatVoiceClock(2999)).toBe('0:02');
    expect(formatVoiceClock(42000)).toBe('0:42');
    expect(formatVoiceClock(61000)).toBe('1:01');
    expect(formatVoiceClock(300000)).toBe('5:00');
    expect(formatVoiceClock(-5)).toBe('0:00');
    expect(formatVoiceClock(undefined)).toBe('0:00');
  });

  it('la vitesse : 1×, 1,5×, 2× (séparateur de la langue)', () => {
    expect(formatVoiceSpeed(1, ',')).toBe('1×');
    expect(formatVoiceSpeed(1.5, ',')).toBe('1,5×');
    expect(formatVoiceSpeed(1.5, '.')).toBe('1.5×');
    expect(formatVoiceSpeed(2, ',')).toBe('2×');
  });
});

// Décision d'Adel, 23/09 ~17h50 : 10 minutes.
describe('VOCAL2 — la durée maximale d\'une prise', () => {
  // eslint-disable-next-line global-require
  const onde = require('@/services/chat/voiceWaveform');

  it('10:00, et on prévient 15 s avant', () => {
    expect(onde.VOICE_MAX_TAKE_MS).toBe(10 * 60 * 1000);
    expect(onde.VOICE_LIMIT_WARNING_MS).toBe(15000);
    expect(onde.isNearTakeLimit(584999)).toBe(false);
    expect(onde.isNearTakeLimit(585000)).toBe(true);
    expect(onde.isNearTakeLimit(599999)).toBe(true);
  });

  it('marge avec le plafond d\'envoi (20 Mo) : 10 min tiennent, même à débit double', () => {
    const plafondOctets = 20 * 1024 * 1024;
    const octets = (debitBits) => (onde.VOICE_MAX_TAKE_MS / 1000) * (debitBits / 8);
    // 128 kbit/s réglés à l'enregistrement : 9,6 Mo, moins de la moitié du plafond.
    expect(onde.VOICE_ENCODING_BITRATE).toBe(128000);
    expect(octets(onde.VOICE_ENCODING_BITRATE)).toBe(9600000);
    expect(octets(onde.VOICE_ENCODING_BITRATE) / plafondOctets).toBeLessThan(0.5);
    expect(octets(2 * onde.VOICE_ENCODING_BITRATE)).toBeLessThan(plafondOctets);
  });
});
