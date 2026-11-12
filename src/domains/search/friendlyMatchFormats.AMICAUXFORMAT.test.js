/* eslint-disable max-len -- intitulés de témoins et données d'exemple, lus en entier. */
/**
 * AMICAUX-FORMAT (10/11/2026) — le catalogue des formats, par sport.
 * Témoins : un sport à formats connus, le personnalisé, une annonce ancienne
 * (texte libre ou rien) qui reste lisible.
 */
import {
  buildCustomFormatCode,
  buildFormatServerFilters,
  formatDurationLabel,
  getFilterSports,
  getFormatLabel,
  getSportFormats,
  isSameDuration,
  OTHER_FORMATS_FILTER,
  parseVersusCode,
} from './friendlyMatchFormats';

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

describe('AMICAUX-FORMAT — catalogue des formats', () => {
  it('football : 11, 8, 7, 5 contre et futsal, 2 × 45 min pré-coché pour le 11', () => {
    const formats = getSportFormats('Football');
    expect(formats.map((format) => format.label)).toEqual([
      '11 contre 11', '8 contre 8', '7 contre 7', '5 contre 5', 'Futsal',
    ]);
    expect(formatDurationLabel(formats[0].durations[0])).toBe('2 × 45 min');
    expect(formats[4].detail).toBe('5 contre 5 en salle');
  });

  it('le nom du référentiel se lit sans accent ni casse, et les sports de l’app ont leur liste', () => {
    expect(getSportFormats('Football à 5').map((format) => format.code)).toEqual(['5v5']);
    expect(getSportFormats('BASKETBALL').map((format) => format.label)).toEqual(['5 contre 5', '3x3']);
    expect(getSportFormats('Volley').map((format) => format.code)).toEqual(['6v6', '4v4', '2v2']);
    expect(getSportFormats('Rugby').map((format) => format.label)).toEqual([
      'Rugby à XV', 'Rugby à 7', 'Rugby à X', 'Rugby à 5',
    ]);
    expect(getSportFormats('Water-polo')[0].durations[0]).toEqual({ minutes: 8, periods: 4 });
  });

  it('un sport hors catalogue ne propose rien : l’écran n’offre que « Personnalisé »', () => {
    expect(getSportFormats('Tennis de table')).toEqual([]);
    expect(getSportFormats(undefined)).toEqual([]);
  });

  it('le même code se lit selon le sport : 2v2 = beach-volley au volley, 2 contre 2 ailleurs', () => {
    expect(getFormatLabel('2v2', 'Volleyball')).toBe('Beach-volley');
    expect(getFormatLabel('2v2', 'Football')).toBe('2 contre 2');
    expect(getFormatLabel('5v5', 'Rugby')).toBe('Rugby à 5');
    expect(getFormatLabel('5v5', 'Basketball')).toBe('5 contre 5');
  });

  it('personnalisé : 10 contre 11 s’écrit et se relit', () => {
    expect(buildCustomFormatCode(10, 11)).toBe('10v11');
    expect(parseVersusCode('10v11')).toEqual({ them: 11, us: 10 });
    expect(getFormatLabel('10v11', 'Football')).toBe('10 contre 11');
    expect(parseVersusCode('futsal')).toBeNull();
  });

  it('annonce ancienne : texte libre affiché tel quel, rien → chaîne vide', () => {
    expect(getFormatLabel('beach 3v3', 'Volleyball')).toBe('beach 3v3');
    expect(getFormatLabel('', 'Football')).toBe('');
    expect(getFormatLabel(null)).toBe('');
    // Sans sport connu, un code à nom court garde son nom.
    expect(getFormatLabel('XV')).toBe('Rugby à XV');
  });

  it('durées : périodes, période unique, points, sets ; forme illisible → vide', () => {
    expect(formatDurationLabel({ minutes: 35, periods: 2 })).toBe('2 × 35 min');
    expect(formatDurationLabel({ minutes: 60, periods: 1 })).toBe('60 min');
    expect(formatDurationLabel({ minutes: 10, periods: 1, points: 21 })).toBe('10 min ou 21 points');
    expect(formatDurationLabel({ sets: 3, setsMode: 'win' })).toBe('3 sets gagnants');
    expect(formatDurationLabel({ sets: 1, setsMode: 'play' })).toBe('1 set joué');
    expect(formatDurationLabel({ minutes: 45 })).toBe('');
    expect(formatDurationLabel(null)).toBe('');
    expect(formatDurationLabel('2 × 45')).toBe('');
  });

  it('isSameDuration compare toutes les clefs', () => {
    expect(isSameDuration({ minutes: 45, periods: 2 }, { minutes: 45, periods: 2 })).toBe(true);
    expect(isSameDuration({ minutes: 45, periods: 2 }, { minutes: 40, periods: 2 })).toBe(false);
    expect(isSameDuration(null, { minutes: 45, periods: 2 })).toBe(false);
  });
});

describe('AMICAUX-FORMAT — la recherche filtrée, au serveur (4 A, 5 A)', () => {
  it('sans filtre : aucune clause', () => {
    expect(buildFormatServerFilters({})).toEqual([]);
    expect(buildFormatServerFilters()).toEqual([]);
  });

  // « 5 A » remplacée par le retour M1193 du 12/11 (T9-RETOURS-A) : plus d'annonce sans format
  // sous un filtre de format.
  it('un sport et un format : les annonces de ce format seulement', () => {
    expect(buildFormatServerFilters({ format: '7v7', sport: 'Football' })).toEqual([
      { activity: { name: { $eqi: 'Football' } } },
      { format: { $eq: '7v7' } },
    ]);
  });

  it('« Autres formats » : tout ce qui n’est pas au catalogue du sport, sans les annonces sans format', () => {
    expect(buildFormatServerFilters({ format: OTHER_FORMATS_FILTER, sport: 'Basketball' })[1]).toEqual({
      format: { $ne: '', $notIn: ['5v5', '3x3'], $notNull: true },
    });
  });

  it('la ligne « Sport » : les sports des équipes du lecteur, sinon les plus courants', () => {
    expect(getFilterSports(['Football', ' Football ', 'Futsal', ''])).toEqual(['Football', 'Futsal']);
    expect(getFilterSports([])).toEqual(['Football', 'Futsal', 'Basketball', 'Handball', 'Volleyball', 'Rugby', 'Hockey']);
  });
});
