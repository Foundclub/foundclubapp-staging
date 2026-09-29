import {
  countLabel,
  findManagedCollectivite,
  formatOpeningHours,
  formatSlot,
  toTimeInput,
} from './collectiviteDisplay';

// COLLECTIVITES 1c — les fonctions PURES de « Ma collectivite » (aucun client HTTP).

describe('collectiviteDisplay', () => {
  it('trouve la collectivite gérée par son documentId, sinon null', () => {
    const mine = [{ documentId: 'a', name: 'Ville A' }, { documentId: 'b', name: 'Ville B' }];
    expect(findManagedCollectivite(mine, 'b')?.name).toBe('Ville B');
    expect(findManagedCollectivite(mine, 'z')).toBeNull();
    expect(findManagedCollectivite(undefined, 'a')).toBeNull();
    expect(findManagedCollectivite(mine, null)).toBeNull();
  });

  it('un nombre, « … » pendant la lecture, « — » en échec : jamais un 0 inventé', () => {
    expect(countLabel({ data: [1, 2, 3], isLoading: false })).toBe('3');
    expect(countLabel({ data: [], isLoading: false })).toBe('0');
    expect(countLabel({ isLoading: true })).toBe('…');
    expect(countLabel({ data: undefined, error: new Error('403') })).toBe('—');
    expect(countLabel(undefined)).toBe('—');
  });

  it('les horaires d ouverture : « 08:00 – 22:00 », rien s il en manque un', () => {
    expect(formatOpeningHours('08:00:00.000', '22:00:00')).toBe('08:00 – 22:00');
    expect(formatOpeningHours('08:00', null)).toBe('');
    expect(toTimeInput('07:45:00.000')).toBe('07:45');
    expect(toTimeInput(null)).toBe('');
  });

  it('le moment d une demande porte le jour et les deux heures', () => {
    const debut = new Date(2030, 9, 7, 18, 0).toISOString();
    const fin = new Date(2030, 9, 7, 19, 30).toISOString();
    expect(formatSlot(debut, fin)).toBe('lun 07/10/2030 · 18:00 – 19:30');
    expect(formatSlot('pas une date', fin)).toBe('');
  });
});
