/**
 * 👶 PARENT P3 — LE SERVICE DES DEMANDES SAIT PARLER D UN ENFANT.
 *
 * Decision d'Adel du 11/09 (« 1- a ») : la demande porte l'enfant. Ce que ces
 * temoins protegent :
 *  ① la demande pour un enfant part avec l'EQUIPE et l'ENFANT — jamais l'enfant
 *    seul, qui deviendrait en silence l'interet du parent pour le club ;
 *  ② les deux envois d'avant ne changent pas d'une virgule ;
 *  ③ les listes ne recoivent les demandes d'enfant que si on les demande : le
 *    serveur les cache aux apps deja installees ;
 *  ④ une ligne portant un enfant se lit — et une ligne ABIMEE ne fait pas tomber
 *    la liste entiere (defaut deja paye : une liste validee en bloc meurt pour
 *    une seule ligne).
 */

import {
  createClubInterestRequest,
  getClubInterestRequests,
  getMyClubInterestRequests,
} from '../clubInterestRequestService';

jest.mock('../../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import client from '../../client';

const PAGE_VIDE = {
  data: [],
  meta: {
    pagination: {
      page: 1,
      pageCount: 1,
      pageSize: 50,
      total: 0,
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  client.post.mockResolvedValue({ data: { data: {} } });
  client.get.mockResolvedValue({ data: PAGE_VIDE });
});

describe('PARENT P3 — le service des demandes et l enfant', () => {
  test('① une demande POUR UN ENFANT part avec l equipe ET l enfant', async () => {
    await createClubInterestRequest({ declaredChild: 'enfant-lea', team: 'team-u11' });

    expect(client.post).toHaveBeenCalledWith('/club-interest-requests', {
      data: { declaredChild: 'enfant-lea', team: 'team-u11' },
    });
  });

  test('① bis un enfant SANS equipe ne part pas : ce serait l interet du parent', async () => {
    await expect(
      createClubInterestRequest({ club: 'club-1', declaredChild: 'enfant-lea' }),
    ).rejects.toThrow();

    expect(client.post).not.toHaveBeenCalled();
  });

  test('② les deux envois d avant ne changent pas d une virgule', async () => {
    await createClubInterestRequest({ team: 'team-u11' });
    await createClubInterestRequest({ club: 'club-1' });

    expect(client.post.mock.calls).toEqual([
      ['/club-interest-requests', { data: { team: 'team-u11' } }],
      ['/club-interest-requests', { data: { club: 'club-1' } }],
    ]);
  });

  test('③ la liste du club ne demande les demandes d enfant que si on le lui dit', async () => {
    await getClubInterestRequests({ clubId: 'club-1' });
    await getClubInterestRequests({ clubId: 'club-1', includeChildRequests: true });

    expect(client.get.mock.calls[0][1].params.includeChildRequests).toBeUndefined();
    expect(client.get.mock.calls[1][1].params.includeChildRequests).toBe(true);
  });

  test('③ bis « mes demandes » suit la meme regle', async () => {
    await getMyClubInterestRequests({ clubId: 'club-1' });
    await getMyClubInterestRequests({ clubId: 'club-1', includeChildRequests: true });

    expect(client.get.mock.calls[0][1].params.includeChildRequests).toBeUndefined();
    expect(client.get.mock.calls[1][1].params.includeChildRequests).toBe(true);
  });

  test('④ une ligne portant un enfant se lit, et une ligne d avant aussi', async () => {
    client.get.mockResolvedValue({
      data: {
        ...PAGE_VIDE,
        data: [
          {
            declaredChild: { age: 7, documentId: 'enfant-lea', firstname: 'Léa' },
            documentId: 'demande-1',
            status: 'pending',
          },
          { documentId: 'demande-2', status: 'pending' },
        ],
      },
    });

    const reponse = await getClubInterestRequests({ clubId: 'club-1', includeChildRequests: true });

    expect(reponse.data.map((ligne) => ligne.documentId)).toEqual(['demande-1', 'demande-2']);
    expect(reponse.data[0].declaredChild.firstname).toBe('Léa');
  });

  test('④ bis une ligne d enfant ABIMEE ne fait pas tomber la liste entiere', async () => {
    client.get.mockResolvedValue({
      data: {
        ...PAGE_VIDE,
        data: [
          { declaredChild: { firstname: 'Léa' }, documentId: 'demande-1', status: 'pending' },
          { documentId: 'demande-2', status: 'pending' },
        ],
      },
    });

    const reponse = await getClubInterestRequests({ clubId: 'club-1', includeChildRequests: true });

    expect(reponse.data).toHaveLength(2);
  });
});
