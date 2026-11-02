import {
  casquetteDeLaNotification,
  casquetteDuFil,
  casquettesMelees,
} from '@/domains/messaging/casquette';

/**
 * CORR-MESSAGERIE p114 (décision d'Adel « B ») — l'étiquette « Club / Complexe / Ville » d'un
 * compte à deux casquettes : le classement des lignes, et quand l'afficher.
 */
const VILLE = 'Ville de Montrivage';
const avis = (/** @type {any} */ data) => ({ data, type: 'newGroupMessage' });

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
    // FIN-MESSAGERIE p88 (02/11) : le type du fil, envoyé par le serveur, décide.
    [avis({ chatType: 'collectivite_club', firstname: 'Dina', groupName: 'V · C', lastname: 'R' }), 'ville'],
    [avis({ chatType: 'collectivite_dirigeants', groupName: `Dirigeants · ${VILLE}` }), 'ville'],
    [avis({ chatType: 'group', firstname: 'Paul', groupName: 'Paul · Foot' }), 'club'],
    // Un avis d'avant le déploiement : relevé en recette, signé par la Ville.
    [avis({ firstname: VILLE, groupName: `${VILLE} · RWDIRIG`, lastname: '' }), 'ville'],
    [avis({ firstname: VILLE, groupName: `Toute la ville · ${VILLE}`, lastname: '' }), 'ville'],
    // Jamais de fausse étiquette « Ville » : un groupe de club ou de complexe avec « · ».
    [avis({ firstname: 'Karim', groupName: 'Parents · U11 Tunnel', lastname: 'Benali' }), 'club'],
    [avis({ firstname: 'Paul', groupName: 'Paul · Foot', lastname: 'Martin' }), 'club'],
    [avis({ firstname: 'Karim', groupName: 'Futsal 10 h · Complexe Test', lastname: '' }), 'club'],
    [avis({ firstname: 'Les parents', groupName: 'Les parents', lastname: '' }), 'club'],
    [{ data: { chatType: 'collectivite_club', groupName: 'A · B' }, type: 'newTeamMessage' }, 'club'],
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
