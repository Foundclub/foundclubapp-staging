import client from '@/services/client';

import { leaveTeam } from '../teamService';

jest.mock('@/services/client', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
const mockPost = /** @type {jest.Mock} */ (client.post);

describe('IPH09-SORTIE — un seul geste atomique serveur', () => {
  beforeEach(() => { mockPost.mockReset(); });
  it.each([
    { message: 'You have been removed from the team' },
    { changed: true, leftClubDocumentId: 'club-a', message: 'You have been removed from the team' },
  ])('rend la reponse ancienne/nouvelle sans appel separe de depart de club', async (data) => {
    mockPost.mockResolvedValue({ data });
    expect(await leaveTeam('equipe-a')).toEqual(data);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/teams/equipe-a/quit');
  });
  it('propage une erreur reseau sans second appel ni fausse reussite', async () => {
    const erreur = new Error('reseau indisponible');
    mockPost.mockRejectedValue(erreur);
    await expect(leaveTeam('equipe-a')).rejects.toBe(erreur);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
