import { findMyApplicationOnAd } from '../friendlyMatchService';

// C07 / Q4-19 — « Mes propositions » lit la candidature de mes equipes sur
// chaque annonce. Apres un retrait puis une nouvelle proposition, l annonce
// porte DEUX candidatures de la meme equipe : la plus ancienne (retiree)
// sortait la premiere, et la liste affichait « retirée » alors qu une
// proposition attendait une reponse.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

describe('findMyApplicationOnAd', () => {
  const team = { club: { documentId: 'C1' }, documentId: 'T1' };
  const retiree = { documentId: 'a1', status: 'withdrawn', team };
  const enAttente = { documentId: 'a2', status: 'pending', team };

  it('rend la proposition active plutot qu une ancienne retiree', () => {
    const ad = { applications: [retiree, enAttente] };
    expect(findMyApplicationOnAd(ad, ['T1'], { clubId: '' })?.documentId).toBe('a2');
    expect(findMyApplicationOnAd(ad, [], { clubId: 'C1' })?.documentId).toBe('a2');
  });

  it('rend encore la retiree quand il n y a qu elle (liste « mes candidatures »)', () => {
    expect(findMyApplicationOnAd({ applications: [retiree] }, ['T1'])?.documentId).toBe('a1');
  });

  it('ignore la retiree en mode activeOnly', () => {
    const scope = { activeOnly: true };
    expect(findMyApplicationOnAd({ applications: [retiree] }, ['T1'], scope)).toBeNull();
  });

  it('ne rend rien sans equipe ni club', () => {
    expect(findMyApplicationOnAd({ applications: [enAttente] }, [], {})).toBeNull();
  });
});
