import {
  getSlotHoursLabel,
  getSlotLabel,
  toAgreedInstant,
  toIsoDay,
  toPickerDay,
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

  // D24 : le chemin du retour. Il sert a remettre un creneau deja pose dans le
  // formulaire pour lui donner son horaire — sans lui, l heure etait impossible
  // a ajouter apres coup.
  test('un jour deja pose retourne dans le selecteur, et l aller-retour est neutre', () => {
    expect(toPickerDay('2099-05-12')).toBe('12/05/2099');
    expect(toPickerDay('2099-05-12T18:30:00.000Z')).toBe('12/05/2099');
    expect(toIsoDay(toPickerDay('2099-05-12'))).toBe('2099-05-12');
  });

  test('un jour illisible ne remplit pas le selecteur avec n importe quoi', () => {
    expect(toPickerDay('pas une date')).toBe('');
    expect(toPickerDay(null)).toBe('');
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

  test('l heure convenue est lue dans le fuseau de qui la saisit', () => {
    // On ne fige pas un ISO en dur : le test tournerait juste sur une machine
    // et faux sur une autre. Ce qui compte, c est que l instant produit RELISE
    // le meme jour et la meme heure localement.
    const instant = toAgreedInstant('2099-05-12', '18:30');
    const readBack = new Date(instant);
    expect(readBack.getFullYear()).toBe(2099);
    expect(readBack.getMonth()).toBe(4);
    expect(readBack.getDate()).toBe(12);
    expect(readBack.getHours()).toBe(18);
    expect(readBack.getMinutes()).toBe(30);
  });

  test('sans heure convenue, on vise midi — minuit changerait le jour affiché', () => {
    expect(new Date(toAgreedInstant('2099-05-12')).getHours()).toBe(12);
    expect(new Date(toAgreedInstant('2099-05-12', 'nawak')).getHours()).toBe(12);
  });

  test('un jour illisible ne produit pas une date inventée', () => {
    expect(toAgreedInstant('pas une date', '18:00')).toBe('');
    expect(toAgreedInstant('', '18:00')).toBe('');
  });

  test('un creneau sans heure n affiche pas de tiret orphelin', () => {
    expect(getSlotLabel({ date: '2099-05-12' })).toBe('mardi 12 mai');
    expect(getSlotLabel({ date: '2099-05-12', end: '20:00', start: '18:00' }))
      .toBe('mardi 12 mai — de 18:00 à 20:00');
  });
});
