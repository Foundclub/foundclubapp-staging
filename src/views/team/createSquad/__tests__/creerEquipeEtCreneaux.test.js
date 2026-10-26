// C10BIS · P12-11 — creer une equipe de ligue puis ses creneaux : si un creneau echoue,
// le nouvel essai ne recree PAS l'equipe (doublon), il ne relance que les creneaux manquants.
import { creerEquipeEtCreneaux } from '@/views/team/createSquad/creerEquipeEtCreneaux';

const nouveauProgres = () => ({ creneauxFaits: new Set(), teamId: null });

describe('creerEquipeEtCreneaux (C10BIS · P12-11)', () => {
  it('cree l equipe puis tous ses creneaux', async () => {
    const creerEquipe = jest.fn(async () => ({ documentId: 'eq-1' }));
    const creerCreneau = jest.fn(async () => ({}));

    const teamId = await creerEquipeEtCreneaux({
      creerCreneau, creerEquipe, creneaux: ['lundi', 'mardi'], progres: nouveauProgres(),
    });

    expect(teamId).toBe('eq-1');
    expect(creerEquipe).toHaveBeenCalledTimes(1);
    expect(creerCreneau.mock.calls).toEqual([['lundi', 'eq-1'], ['mardi', 'eq-1']]);
  });

  it('un creneau echoue : le 2e essai garde l equipe, ne relance que le manquant', async () => {
    const progres = nouveauProgres();
    const creerEquipe = jest.fn(async () => ({ documentId: 'eq-1' }));
    const creerCreneau = jest.fn(async (creneau) => {
      if (creneau === 'mardi') throw new Error('creneau refuse');
      return {};
    });

    await expect(creerEquipeEtCreneaux({
      creerCreneau, creerEquipe, creneaux: ['lundi', 'mardi'], progres,
    })).rejects.toThrow('creneau refuse');

    creerCreneau.mockImplementation(async () => ({}));
    creerCreneau.mockClear();
    const teamId = await creerEquipeEtCreneaux({
      creerCreneau, creerEquipe, creneaux: ['lundi', 'mardi'], progres,
    });

    expect(teamId).toBe('eq-1');
    expect(creerEquipe).toHaveBeenCalledTimes(1);
    expect(creerCreneau.mock.calls).toEqual([['mardi', 'eq-1']]);
  });

  it('l equipe n est pas creee : rien n est garde, le prochain essai la recree', async () => {
    const progres = nouveauProgres();
    const creerEquipe = jest.fn(async () => ({}));

    await expect(creerEquipeEtCreneaux({
      creerCreneau: jest.fn(), creerEquipe, creneaux: [], progres,
    })).rejects.toThrow('Failed to create league team');
    expect(progres.teamId).toBeNull();
  });
});
