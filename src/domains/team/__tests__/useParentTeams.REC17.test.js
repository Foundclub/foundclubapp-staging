import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getUserById } from '@/services/auth/authService';
import { getMyDeclaredChildren } from '@/services/declaredChild/declaredChildService';
import { getParentLinksAsParent } from '@/services/parentLink/parentLinkService';

import useParentTeams, { buildParentTeamIndex } from '../useParentTeams';

jest.mock('@/services/auth/authService', () => ({ getUserById: jest.fn() }));
jest.mock('@/services/declaredChild/declaredChildService', () => ({ getMyDeclaredChildren: jest.fn() }));
jest.mock('@/services/parentLink/parentLinkService', () => ({ getParentLinksAsParent: jest.fn() }));

const romain = {
  documentId: 'romain', firstname: 'Romain', lastname: 'Roupie', team: { documentId: 'u11' },
};
const greg = {
  documentId: 'greg', firstname: 'Greg', lastname: 'Mesquin', team: { documentId: 'basket' },
};

describe('REC17-002 — index des equipes des enfants', () => {
  it('lit seulement les rattachements effectifs, jamais une demande en attente', () => {
    const pending = { firstname: 'En attente', team: null };
    expect(buildParentTeamIndex([romain, greg, pending])).toEqual({
      childrenByTeam: { basket: ['Greg Mesquin'], u11: ['Romain Roupie'] },
      teamIds: ['u11', 'basket'],
    });
  });

  it('regroupe deux enfants dans une seule equipe, avec leurs deux noms', () => {
    expect(buildParentTeamIndex([romain, { ...greg, team: romain.team }])).toEqual({
      childrenByTeam: { u11: ['Romain Roupie', 'Greg Mesquin'] }, teamIds: ['u11'],
    });
  });

  it('un enfant devenu compte relie prend les equipes de son profil, pas son ancienne fiche', () => {
    expect(buildParentTeamIndex(
      [{ ...romain, account: { documentId: 'compte' } }],
      [{ documentId: 'compte', firstname: 'Romain' }],
      [{ myTeams: [{ documentId: 'u15' }], trainedTeams: [{ documentId: 'equipe-entrainee' }] }],
    )).toEqual({ childrenByTeam: { u15: ['Romain'] }, teamIds: ['u15'] });
  });
});

describe('REC17-002 — lectures reelles par les hooks existants', () => {
  let client;
  let tree;
  let latest;
  const flush = async () => {
    for (let index = 0; index < 40; index += 1) {
      // Attendre les notifications asynchrones React Query avant de lire le rendu.
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      if (!latest.isLoading) break;
    }
    expect(latest.isLoading).toBe(false);
  };
  /**
   *
   * @param root0
   * @param root0.enabled
   */
  function Probe({ enabled }) {
    latest = useParentTeams({ enabled });
    return null;
  }
  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
    getMyDeclaredChildren.mockResolvedValue([romain, greg]);
    getParentLinksAsParent.mockResolvedValue({ children: [], requests: [] });
    getUserById.mockResolvedValue({ myTeams: [{ documentId: 'u15' }] });
  });
  afterEach(async () => {
    await act(async () => { tree?.unmount(); });
    client.clear();
  });
  const mount = async (enabled = true) => {
    await act(async () => {
      tree = renderer.create(<QueryClientProvider client={client}><Probe enabled={enabled} /></QueryClientProvider>);
    });
    await flush();
  };

  it('charge les deux equipes sans lire de profil tiers non relie', async () => {
    await mount();
    expect(latest.teamIds).toEqual(['u11', 'basket']);
    expect(getMyDeclaredChildren).toHaveBeenCalledTimes(1);
    expect(getParentLinksAsParent).toHaveBeenCalledTimes(1);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('ne charge les profils que des enfants effectivement relies', async () => {
    getParentLinksAsParent.mockResolvedValue({ children: [{ documentId: 'ado', firstname: 'Ado' }], requests: [{ child: { documentId: 'sans-accord' } }] });
    await mount();
    expect(latest.teamIds).toEqual(['u11', 'basket', 'u15']);
    expect(getUserById).toHaveBeenCalledTimes(1);
    expect(getUserById).toHaveBeenCalledWith('ado');
  });

  it('une relecture retrouve une adhesion acceptee apres la premiere ouverture', async () => {
    getMyDeclaredChildren.mockResolvedValue([{ ...romain, team: null }]);
    await mount();
    expect(latest.teamIds).toEqual([]);
    getMyDeclaredChildren.mockResolvedValue([romain]);
    await act(async () => { await latest.refetch(); });
    await flush();
    expect(latest.teamIds).toEqual(['u11']);
  });

  it('un rattachement retire disparait apres relecture', async () => {
    await mount();
    getMyDeclaredChildren.mockResolvedValue([{ ...romain, team: null }, greg]);
    await act(async () => { await latest.refetch(); });
    await flush();
    expect(latest.teamIds).toEqual(['basket']);
  });

  it('les erreurs ne sont pas transformees en une liste vide validee', async () => {
    const error = new Error('Lecture indisponible');
    getMyDeclaredChildren.mockRejectedValue(error);
    await mount();
    expect(latest.error).toBe(error);
  });

  it('en mode Joueur ou League, aucune lecture parent, meme sur relecture explicite', async () => {
    await mount(false);
    await act(async () => { await latest.refetch(); });
    expect(latest.teamIds).toEqual([]);
    expect(getMyDeclaredChildren).not.toHaveBeenCalled();
    expect(getParentLinksAsParent).not.toHaveBeenCalled();
    expect(getUserById).not.toHaveBeenCalled();
  });
});
