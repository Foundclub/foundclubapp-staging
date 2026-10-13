import {
  acceptationPour,
  clubDeLaDemande,
  demandesDe,
  enAttente,
  etatDeLEnfant,
} from '../demandesDeLEnfant';

/**
 * PAR-L5L6 (13/10) — CE QUE LES DEMANDES DISENT D UN ENFANT (E04 et E07 du design parent).
 * Les formes sont celles que rend le serveur (`/club-interest-requests/mine`, staging admin
 * `fe1d5eb8`) : `declaredChild` ne porte que l identifiant et le prenom.
 */

const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };
const SMUC = { documentId: 'club-smuc', name: 'SMUC' };

const demande = (extra = {}) => ({
  club: FOUNDCLUB,
  createdAt: '2026-10-11T09:00:00.000Z',
  declaredChild: { documentId: 'anissa', firstname: 'Anissa' },
  documentId: 'dem-1',
  status: 'pending',
  team: { club: FOUNDCLUB, documentId: 'senior', name: 'Senior' },
  ...extra,
});

describe('demandesDe — les demandes d UN enfant', () => {
  test('garde les siennes, la plus recente d abord ; laisse celles du parent et des freres', () => {
    const lignes = [
      demande({ createdAt: '2026-10-10T09:00:00.000Z', documentId: 'vieille' }),
      demande({ declaredChild: null, documentId: 'parent' }),
      demande({ declaredChild: { documentId: 'martin' }, documentId: 'frere' }),
      demande({ createdAt: '2026-10-12T09:00:00.000Z', documentId: 'recente' }),
    ];

    expect(demandesDe('anissa', lignes).map((d) => d.documentId)).toEqual(['recente', 'vieille']);
  });

  test('rien a lire : aucune demande, jamais d erreur', () => {
    expect(demandesDe('anissa', undefined)).toEqual([]);
    expect(demandesDe('', [demande()])).toEqual([]);
  });
});

test('enAttente — seules les demandes « pending »', () => {
  expect(enAttente([demande(), demande({ documentId: 'dem-2', status: 'responded' })])
    .map((d) => d.documentId)).toEqual(['dem-1']);
  expect(enAttente(undefined)).toEqual([]);
});

test('acceptationPour — la demande acceptee qui a mis l enfant dans CETTE equipe', () => {
  const acceptee = demande({
    documentId: 'ok',
    presetKey: 'child_accepted',
    respondedAt: '2026-10-11T18:00:00.000Z',
    status: 'responded',
  });
  const autre = demande({
    documentId: 'autre', presetKey: 'thanks', status: 'responded',
  });

  expect(acceptationPour([autre, acceptee], 'senior')).toBe(acceptee);
  expect(acceptationPour([acceptee], 'u11')).toBeNull();
  expect(acceptationPour([acceptee], '')).toBeNull();
});

test('clubDeLaDemande — le club de l equipe, a defaut celui de la demande', () => {
  expect(clubDeLaDemande(demande())).toBe('FoundClub');
  expect(clubDeLaDemande(demande({ club: SMUC, team: { documentId: 'b', name: 'Basket' } })))
    .toBe('SMUC');
  expect(clubDeLaDemande(null)).toBe('');
});

describe('etatDeLEnfant — la pastille de « Mes enfants »', () => {
  test('🔴 remarque d Adel (13/10) : Anissa est dans Senior de FoundClub — la fiche le DIT', () => {
    const anissa = {
      club: FOUNDCLUB,
      documentId: 'anissa',
      firstname: 'Anissa',
      team: { documentId: 'senior', name: 'Senior' },
    };

    expect(etatDeLEnfant(anissa, [])).toEqual({
      club: 'FoundClub', enAttente: 0, equipes: ['Senior'], ton: 'ok',
    });
  });

  test('equipe sur la fiche mais club pas encore lu : on le prend sur la demande acceptee', () => {
    const martin = {
      club: null, documentId: 'martin', team: { documentId: 'basket', name: 'Basket' },
    };
    const acceptee = demande({
      declaredChild: { documentId: 'martin' },
      presetKey: 'child_accepted',
      status: 'responded',
      team: { club: SMUC, documentId: 'basket', name: 'Basket' },
    });

    expect(etatDeLEnfant(martin, [acceptee]).club).toBe('SMUC');
  });

  test('une demande en attente : on nomme son equipe et son club', () => {
    expect(etatDeLEnfant({ documentId: 'anissa', team: null }, [demande()])).toEqual({
      club: 'FoundClub', enAttente: 1, equipes: ['Senior'], ton: 'attente',
    });
  });

  test('deux demandes en attente : le nombre, sans en choisir une', () => {
    expect(etatDeLEnfant({ documentId: 'anissa' }, [demande(), demande({ documentId: 'dem-2' })]))
      .toEqual({
        club: '', enAttente: 2, equipes: [], ton: 'attente',
      });
  });

  test('l equipe sur la fiche prime sur une demande qui attend encore', () => {
    const anissa = { documentId: 'anissa', team: { documentId: 'senior', name: 'Senior' } };

    expect(etatDeLEnfant(anissa, [demande({ team: { documentId: 'u15', name: 'U15' } })]).ton)
      .toBe('ok');
  });

  test('ni equipe ni demande : pas encore d equipe', () => {
    expect(etatDeLEnfant({ documentId: 'anissa' }, [])).toEqual({
      club: '', enAttente: 0, equipes: [], ton: 'neutre',
    });
  });
});
