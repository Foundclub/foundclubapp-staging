import {
  getSlotHoursLabel,
  getSlotLabel,
  toIsoDay,
  toReadableDay,
  toShortDay,
} from './friendlyMatchDateLabels';

describe('friendlyMatchDateLabels', () => {
  test('la saisie du selecteur devient la date attendue par le serveur', () => {
    expect(toIsoDay('12/05/2099')).toBe('2099-05-12');
  });

  test('une saisie illisible rend une chaine vide, elle ne leve pas', () => {
    expect(toIsoDay('demain')).toBe('');
    expect(toIsoDay('')).toBe('');
    expect(toIsoDay(null)).toBe('');
  });

  test('une date ISO complete est coupee au jour', () => {
    expect(toReadableDay('2099-05-12T18:30:00.000Z')).toBe('mardi 12 mai');
    expect(toShortDay('2099-05-12T18:30:00.000Z')).toBe('mar. 12 mai');
  });

  test('une valeur illisible s affiche telle quelle plutot que de laisser un trou', () => {
    expect(toReadableDay('pas une date')).toBe('pas une date');
    expect(toReadableDay(null)).toBe('');
  });

  test('l horaire manquant est une information, pas une ligne vide', () => {
    expect(getSlotHoursLabel({ date: '2099-05-12' })).toBe('horaire à convenir');
    expect(getSlotHoursLabel({ start: '18:00' })).toBe('à partir de 18:00');
    expect(getSlotHoursLabel({ end: '20:00', start: '18:00' })).toBe('de 18:00 à 20:00');
  });

  test('un creneau sans heure n affiche pas de tiret orphelin', () => {
    expect(getSlotLabel({ date: '2099-05-12' })).toBe('mardi 12 mai');
    expect(getSlotLabel({ date: '2099-05-12', end: '20:00', start: '18:00' }))
      .toBe('mardi 12 mai — de 18:00 à 20:00');
  });
});
