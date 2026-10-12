import {
  buildDetailsMessageText,
  construireRendezVous,
  exempleHeureDeRendezVous,
  lieuPorteUneDonneePersonnelle,
  RENDEZ_VOUS_LIEU_MAX,
} from '../convocationWizardUtils';

// CONVOC-RDV (decision d'Adel du 08/10, `rdv lot`) — LE RENDEZ-VOUS DE L'ETAPE 4, EN REGLES PURES.
//
// L'heure ne se tape plus : c'est le selecteur partage (`TimePickerInput`), qui s'ouvre sur un
// EXEMPLE (decision `heure A`). L'exemple est l'heure du coup d'envoi moins une heure — et plus
// jamais une valeur pre-remplie : « 13h30 au club » partait tel quel si l'entraineur n'y touchait
// pas. Le lieu est un texte court, lu par toute l'equipe : la regle du serveur (ni telephone, ni
// courriel, ni lien, 120 caracteres) est repetee ici pour le dire SOUS le champ.

/**
 * Un horodatage a l'heure LOCALE donnee (le temoin passe quel que soit le fuseau de la machine).
 * @param {number} heures
 * @param {number} minutes
 * @returns {string}
 */
const aLHeureLocale = (heures, minutes) => new Date(2026, 9, 10, heures, minutes).toISOString();

describe('CRDV — l exemple d heure : le coup d envoi moins une heure', () => {
  test.each([
    [15, 0, '14:00'],
    [20, 45, '19:45'],
    [9, 7, '08:05'],
    [0, 30, '23:30'],
  ])('coup d envoi %i:%i -> %s', (heures, minutes, attendu) => {
    expect(exempleHeureDeRendezVous(aLHeureLocale(heures, minutes))).toBe(attendu);
  });

  test('sans date lisible : 13:30', () => {
    expect(exempleHeureDeRendezVous('')).toBe('13:30');
    expect(exempleHeureDeRendezVous(null)).toBe('13:30');
    expect(exempleHeureDeRendezVous('pas une date')).toBe('13:30');
  });
});

describe('CRDV — ce qui part au serveur', () => {
  test('l heure et le lieu, nettoyes', () => {
    expect(construireRendezVous({ place: '  Au   club ', time: '13:30' }))
      .toEqual({ place: 'Au club', time: '13:30' });
  });

  test('l heure seule, ou un lieu seul DIFFERENT de celui de l evenement', () => {
    expect(construireRendezVous({ place: '', time: '09:05' }))
      .toEqual({ place: null, time: '09:05' });
    expect(construireRendezVous({ eventPlace: 'Stade Ricard', place: 'Parking', time: '' }))
      .toEqual({ place: 'Parking', time: null });
  });

  test('rien de choisi : null — le lieu pre-rempli, sans heure, ne fait pas un RDV', () => {
    expect(construireRendezVous({ place: '  ', time: '' })).toBeNull();
    expect(construireRendezVous({ eventPlace: 'Stade Ricard', place: 'Stade Ricard', time: '' }))
      .toBeNull();
  });

  test('une heure mal formee n est jamais envoyee', () => {
    expect(construireRendezVous({ place: '', time: '25:00' })).toBeNull();
  });
});

describe('CRDV — le lieu est lu par toute l equipe', () => {
  test.each([
    'Appelle au 06 12 34 56 78',
    '+33612345678',
    'coach@club.fr',
    'https://exemple.fr',
    'www.exemple.fr',
  ])('refuse : %s', (texte) => {
    expect(lieuPorteUneDonneePersonnelle(texte)).toBe(true);
  });

  test.each([
    'Au club', 'Complexe 2000', 'Five 13', 'Parking du stade, entree B',
  ])('accepte : %s', (texte) => {
    expect(lieuPorteUneDonneePersonnelle(texte)).toBe(false);
  });

  test('120 caracteres, comme le serveur', () => {
    expect(RENDEZ_VOUS_LIEU_MAX).toBe(120);
  });
});

describe('CRDV — le repli texte (serveur sans le champ)', () => {
  test('le rendez-vous en une ligne, puis les infos', () => {
    expect(buildDetailsMessageText({
      infos: 'Maillot bleu', meetingPoint: '13:30 · Au club',
    })).toBe('Rendez-vous : 13:30 · Au club\nInfos : Maillot bleu');
  });
});
