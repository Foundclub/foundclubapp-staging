import {
  casquetteDeLaNotification,
  casquetteDuFil,
  casquettesMelees,
} from '@/domains/messaging/casquette';

/**
 * CORR-MESSAGERIE p114 (décision d'Adel « B ») — l'étiquette « Club / Complexe / Ville » d'un
 * compte à deux casquettes : le classement des lignes, et quand l'afficher.
 */
describe('CORR-MESSAGERIE p114 — la casquette d une ligne', () => {
  test.each([
    [{ type: 'collectivite_dirigeants' }, 'ville'],
    [{ type: 'collectivite_ville' }, 'ville'],
    [{ participantsCount: 12, type: 'group' }, 'complexe'],
    [{ type: 'team' }, 'club'],
    [{ type: 'club' }, 'club'],
    [{ type: 'multisport' }, 'club'],
    [{ type: 'whisper' }, null],
    [{ type: 'assistance' }, null],
    [{ type: 'group' }, null],
  ])('fil %j : %s', (chat, attendu) => {
    expect(casquetteDuFil(chat)).toBe(attendu);
  });

  test.each([
    [{ type: 'collectiviteNewsPublished' }, 'ville'],
    [{ type: 'complexeReservationGerant' }, 'complexe'],
    [{ type: 'newEvent' }, 'club'],
  ])('notification %j : %s', (notification, attendu) => {
    expect(casquetteDeLaNotification(notification)).toBe(attendu);
  });

  test('une seule casquette (ou des fils privés) : pas d étiquette', () => {
    expect(casquettesMelees(['club', 'club', null])).toBe(false);
    expect(casquettesMelees([null, null])).toBe(false);
  });

  test('deux casquettes mêlées : les étiquettes', () => {
    expect(casquettesMelees(['club', 'complexe', null])).toBe(true);
    expect(casquettesMelees(['ville', 'club'])).toBe(true);
  });
});
