import { formatNotificationRelativeTime } from '@/utils/notifications/notificationPresentation';

// IMPL-4B-ACCUEIL (19/11/2026) — E6 : `formatNotificationRelativeTime` (la cloche, la liste des
// notifications) n'avait AUCUN témoin direct, et la carte d'invitation de l'accueil s'en sert
// désormais (« Il y a 5 min »). Ce fichier décrit ce que la fonction rend AUJOURD'HUI ; il ne la
// change pas. L'horloge est figée : aucune date ne dépend du jour où le témoin tourne.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const MAINTENANT = new Date('2026-11-19T12:00:00.000Z');
const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * Une date située `ms` millisecondes avant l'horloge figée.
 * @param {number} ms - L'écart.
 * @returns {string} La date, en ISO (la forme que rend le serveur).
 */
const ilYA = (ms) => new Date(MAINTENANT.getTime() - ms).toISOString();

beforeAll(() => { jest.useFakeTimers().setSystemTime(MAINTENANT); });
afterAll(() => { jest.useRealTimers(); });

describe('formatNotificationRelativeTime — caractérisation (état au 19/11/2026)', () => {
  it.each([
    [undefined], [null], [''], [0], ['pas-une-date'],
  ])('rien pour une date absente ou illisible (%p)', (entree) => {
    expect(formatNotificationRelativeTime(entree)).toBe('');
  });

  it.each([
    ['maintenant', 0, 'À l’instant'],
    ['59 secondes', 59_000, 'À l’instant'],
    ['une date à venir (horloges décalées)', -5 * MINUTE, 'À l’instant'],
    ['1 minute', MINUTE, 'Il y a 1 min'],
    ['5 minutes', 5 * MINUTE, 'Il y a 5 min'],
    ['59 minutes', 59 * MINUTE, 'Il y a 59 min'],
    ['60 minutes', 60 * MINUTE, 'Il y a 1 h'],
    ['3 heures', 3 * HEURE, 'Il y a 3 h'],
    ['23 heures', 23 * HEURE, 'Il y a 23 h'],
    ['24 heures', 24 * HEURE, 'Il y a 1 j'],
    ['2 jours', 2 * JOUR, 'Il y a 2 j'],
    ['6 jours', 6 * JOUR, 'Il y a 6 j'],
  ])('%s → « %s »', (_cas, ecart, attendu) => {
    expect(formatNotificationRelativeTime(ilYA(ecart))).toBe(attendu);
  });

  it('accepte aussi un objet Date et un nombre de millisecondes', () => {
    expect(formatNotificationRelativeTime(new Date(MAINTENANT.getTime() - 5 * MINUTE)))
      .toBe('Il y a 5 min');
    expect(formatNotificationRelativeTime(MAINTENANT.getTime() - 3 * HEURE)).toBe('Il y a 3 h');
  });

  it.each([
    ['7 jours', 7 * JOUR, '12'],
    ['8 jours', 8 * JOUR, '11'],
  ])('dès %s : la date courte (jour et mois), plus « Il y a »', (_cas, ecart, jour) => {
    const texte = formatNotificationRelativeTime(ilYA(ecart));
    expect(texte).not.toMatch(/Il y a|instant/);
    expect(texte).toMatch(new RegExp(`^${jour}\\b`));
    expect(texte).toMatch(/nov/i);
  });
});
