import { splitAdminInvitations } from '@/domains/collectivite/collectiviteConsole';
/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import {
  etatDeDemandeVille,
  gesteDeRecherche,
  ligneDeDemandeDuClub,
  villeSujet,
} from '@/domains/collectivite/collectiviteRattachement';

// 🏛️ VILLE-INVITER-CLUB (07/10/2026) — le rattachement dans les deux sens, décisions d'Adel
// « club A » (le club accepte : rattaché tout de suite) et « lien A » (la Ville juge les
// demandes venues de son lien). Ce que ce témoin exige (ROUGE avant le lot : le module
// n'existait pas) :
//   R1 — la ligne d'un club, dans la recherche de la Ville, propose LE bon geste ;
//   R2 — la Ville lit l'état de chaque demande, dans les deux sens, au « vous » ;
//   R3 — le club lit l'état de SES demandes, au « tu » ;
//   R4 — la console range une demande refusée par la Ville avec les demandes traitées.

const t = (/** @type {string} */ _cle, /** @type {any} */ defaut, /** @type {any} */ valeurs) => (
  String(defaut).replace(/\{\{(\w+)\}\}/g, (_m, nom) => String(valeurs?.[nom] ?? ''))
);

describe('VINV · R1 — le geste de chaque ligne de la recherche', () => {
  it.each([
    [{ attached: true, hasLeader: true }, 'rattache'],
    [{ attachedElsewhere: true, hasLeader: true }, 'ailleurs'],
    [{ hasLeader: true, request: { state: 'pending' } }, 'aRepondre'],
    [{ hasLeader: true, proposal: { state: 'pending' } }, 'envoyee'],
    [{ hasLeader: true, proposal: { state: 'refused' } }, 'refusee'],
    [{ hasLeader: false }, 'sansDirigeant'],
    [{ hasLeader: true }, 'envoyer'],
    [{ hasLeader: true, request: { state: 'refused' } }, 'envoyer'],
  ])('%j ⇒ %s', (club, attendu) => {
    expect(gesteDeRecherche(club)).toBe(attendu);
  });
});

describe('VINV · R2 — la Ville lit ses demandes', () => {
  it('sa demande au club, en attente : « En attente », ses dirigeants répondent', () => {
    const etat = etatDeDemandeVille(t, { kind: 'proposal', state: 'pending' });
    expect(etat).toEqual({
      ligne: 'Envoyée au club : ses dirigeants acceptent ou refusent.',
      pastille: 'En attente',
      ton: 'neutre',
    });
  });

  it('la demande venue du lien, en attente : « À traiter », hors commune signalé', () => {
    expect(etatDeDemandeVille(t, { kind: 'attach_request', outsideCommune: true, state: 'pending' })).toEqual({
      ligne: 'Le club demande à rejoindre la Ville. Il n’est pas dans la commune.',
      pastille: 'À traiter',
      ton: 'cyan',
    });
  });

  it('rattaché, refusé : le bon mot, des deux côtés', () => {
    expect(etatDeDemandeVille(t, { kind: 'proposal', state: 'attached' }).pastille).toBe('Rattaché');
    expect(etatDeDemandeVille(t, { kind: 'proposal', state: 'refused' })).toEqual({
      ligne: 'Le club a refusé votre demande.', pastille: 'Refusée', ton: 'rouge',
    });
    expect(etatDeDemandeVille(t, { kind: 'attach_request', state: 'refused' }).ligne).toBe('Vous avez refusé sa demande.');
  });

  it('une demande du lien dont le club a été rattaché AILLEURS entre-temps le dit', () => {
    expect(etatDeDemandeVille(t, { attachedElsewhere: true, kind: 'attach_request', state: 'pending' }).ligne)
      .toBe('Ce club a été rattaché à une autre collectivité entre-temps.');
  });
});

describe('VINV · R3 — le club lit ses demandes, au « tu »', () => {
  const ville = { name: 'Ville de Montrivage', type: 'commune' };
  it.each([
    [{ kind: 'attach_request', state: 'pending' }, 'Ta demande de rattachement à la Ville de Montrivage attend sa réponse.'],
    [{ kind: 'attach_request', state: 'attached' }, 'Ton club est rattaché à la Ville de Montrivage.'],
    [{ kind: 'attach_request', state: 'refused' }, 'La Ville de Montrivage n’a pas accepté ta demande de rattachement.'],
    [{ kind: 'proposal', state: 'attached' }, 'Ton club est rattaché à la Ville de Montrivage.'],
    [{ kind: 'proposal', state: 'refused' }, 'Tu as refusé la demande de la Ville de Montrivage.'],
  ])('%j', (demande, attendu) => {
    expect(ligneDeDemandeDuClub(t, { ...demande, collectivite: ville })).toBe(attendu);
  });

  it('la Ville en sujet de phrase prend sa majuscule', () => {
    expect(villeSujet('Ville de Montrivage')).toBe('La Ville de Montrivage');
  });
});

describe('VINV · R4 — la console range la demande refusée par la Ville', () => {
  it('refusée : avec les demandes traitées, plus dans « Rattachements »', () => {
    const piles = splitAdminInvitations([
      {
        answer: 'pending', documentId: 'a', kind: 'attach_request', status: 'registered',
      },
      {
        answer: 'refused', documentId: 'b', kind: 'attach_request', status: 'registered',
      },
      {
        answer: 'accepted', documentId: 'c', kind: 'attach_request', status: 'attached',
      },
    ]);
    expect(piles.attachRequests.map((l) => l.documentId)).toEqual(['a']);
    expect(piles.done.map((l) => l.documentId)).toEqual(['b', 'c']);
  });
});
