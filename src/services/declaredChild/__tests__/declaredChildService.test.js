/**
 * PARENT P2 — LE SERVICE « MES ENFANTS ».
 *
 * Ce que ces témoins protègent, et ce sont trois défauts déjà payés ailleurs :
 *
 * ① 🧨 UNE LISTE VALIDÉE EN BLOC MEURT POUR UNE LIGNE. Le serveur rend `null`
 *    sur `club`, `team`, `photo`, `position` et `number` (declared-child.ts,
 *    `toPublicChild`). Un schéma qui les déclare `optional()` sans `allow(null)`
 *    refuse la ligne — et si la validation porte sur le TABLEAU, un enfant
 *    illisible efface les trois autres. On valide donc LIGNE PAR LIGNE, comme
 *    `clubMembershipRequestService`.
 *
 * ② 🔢 `Number('')` VAUT ZÉRO. Un numéro de maillot laissé vide deviendrait
 *    « maillot n°0 ». Le champ absent doit rester ABSENT.
 *
 * ③ 🔒 LA DATE DE NAISSANCE NE REDESCEND JAMAIS. Le serveur ne rend qu'un `age`.
 *    Une modification qui ne la renvoie pas ne doit pas l'effacer : une clef
 *    absente reste absente (le serveur garde alors la date stockée).
 */

import {
  buildChildPayload,
  deleteDeclaredChild,
  getMyDeclaredChildren,
  updateDeclaredChild,
} from '../declaredChildService';

jest.mock('../../client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import client from '../../client';

const unEnfant = (extra = {}) => ({
  age: 9,
  club: null,
  documentId: 'enfant-1',
  firstname: 'Léa',
  lastname: 'Martin',
  number: null,
  photo: null,
  position: null,
  team: null,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PARENT P2 — le service des fiches enfants', () => {
  test('① une fiche tout en nuls (club, équipe, photo, poste, n°) reste LISIBLE', async () => {
    client.get.mockResolvedValue({ data: { data: [unEnfant()] } });

    const enfants = await getMyDeclaredChildren();

    expect(enfants).toHaveLength(1);
    expect(enfants[0].firstname).toBe('Léa');
    expect(enfants[0].age).toBe(9);
  });

  test('① une ligne illisible est ÉCARTÉE, les autres survivent', async () => {
    client.get.mockResolvedValue({
      data: {
        data: [
          unEnfant(),
          { firstname: 'Sans identifiant' },
          unEnfant({ documentId: 'enfant-3', firstname: 'Tom' }),
        ],
      },
    });

    const enfants = await getMyDeclaredChildren();

    expect(enfants.map((enfant) => enfant.firstname)).toEqual(['Léa', 'Tom']);
  });

  test('② un numéro de maillot laissé VIDE ne part pas en zéro : la clef est absente', () => {
    const payload = buildChildPayload({
      birthdate: '2017-05-04',
      firstname: 'Léa',
      lastname: 'Martin',
      number: '',
      position: '',
    });

    expect(payload).toEqual({
      birthdate: '2017-05-04',
      firstname: 'Léa',
      lastname: 'Martin',
    });
    expect(Object.prototype.hasOwnProperty.call(payload, 'number')).toBe(false);
  });

  test('② un numéro RENSEIGNÉ part bien, en nombre', () => {
    const payload = buildChildPayload({
      birthdate: '2017-05-04',
      firstname: 'Léa',
      lastname: 'Martin',
      number: '10',
      position: 'Gardienne',
    });

    expect(payload.number).toBe(10);
    expect(payload.position).toBe('Gardienne');
  });

  test("③ modifier SANS la date ne l'envoie pas : le serveur garde la sienne", async () => {
    client.put.mockResolvedValue({ data: { data: unEnfant({ number: 7 }) } });

    await updateDeclaredChild('enfant-1', buildChildPayload({
      firstname: 'Léa',
      lastname: 'Martin',
      number: '7',
    }));

    const [, body] = client.put.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(body.data, 'birthdate')).toBe(false);
    expect(body.data.number).toBe(7);
  });

  test('la suppression vise la fiche par son identifiant STABLE', async () => {
    client.delete.mockResolvedValue({ data: { data: { deleted: true, documentId: 'enfant-1' } } });

    await deleteDeclaredChild('enfant-1');

    expect(client.delete).toHaveBeenCalledWith('/declared-children/enfant-1');
  });
});
