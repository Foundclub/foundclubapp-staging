import {
  cleDuJour,
  estModifiable,
  etatDesCoches,
  evenementDuMessage,
  indiceDeCouleur,
  libelleDuJour,
  rangerLeFil,
} from '../filDuSite';

// MESSAGERIE-1W — les regles du fil du site (groupes, puces de date, coches), sans rendu.

const BRUNO = { documentId: 'bruno' };
const MOI = { documentId: 'moi' };

const message = (documentId, sender, createdAt, extra = {}) => ({
  createdAt, documentId, sender, ...extra,
});

describe('rangerLeFil', () => {
  it('pose une puce par jour et marque le premier et le dernier de chaque groupe', () => {
    const fil = rangerLeFil([
      message('a', BRUNO, '2026-10-06T16:02:00'),
      message('b', BRUNO, '2026-10-06T16:05:00'),
      message('c', MOI, '2026-10-06T16:10:00'),
      // Meme auteur que la veille, mais un AUTRE jour : un nouveau groupe.
      message('d', MOI, '2026-10-07T09:00:00'),
    ]);

    expect(fil.map((entree) => (entree.type === 'jour' ? `[${entree.cle}]` : entree.cle))).toEqual([
      '[jour-2026-10-06]', 'a', 'b', 'c', '[jour-2026-10-07]', 'd',
    ]);
    const parCle = Object.fromEntries(
      fil.filter((e) => e.type === 'message').map((e) => [e.cle, e]),
    );
    expect([parCle.a.premier, parCle.a.dernier]).toEqual([true, false]);
    expect([parCle.b.premier, parCle.b.dernier]).toEqual([false, true]);
    expect([parCle.c.premier, parCle.c.dernier]).toEqual([true, true]);
    expect([parCle.d.premier, parCle.d.dernier]).toEqual([true, true]);
  });

  it('une ligne systeme (sans expediteur) coupe le groupe qui l entoure', () => {
    const fil = rangerLeFil([
      message('a', BRUNO, '2026-10-06T16:02:00'),
      message('sys', null, '2026-10-06T16:03:00', { message: 'Bruno a rejoint le canal' }),
      message('b', BRUNO, '2026-10-06T16:05:00'),
    ]).filter((entree) => entree.type === 'message');

    expect(fil.map((entree) => [entree.cle, entree.premier, entree.dernier])).toEqual([
      ['a', true, true],
      ['sys', true, true],
      ['b', true, true],
    ]);
  });

  it('ne casse pas sur un fil vide ou des dates illisibles', () => {
    expect(rangerLeFil(undefined)).toEqual([]);
    const illisible = rangerLeFil([message('a', BRUNO, 'pas une date')]);
    expect(illisible.map((e) => e.type)).toEqual(['message']);
    expect(cleDuJour('pas une date')).toBe('');
  });
});

describe('libelleDuJour', () => {
  const maintenant = new Date('2026-10-07T12:00:00');
  const textes = { aujourdhui: "Aujourd'hui", hier: 'Hier', maintenant };

  it('dit Aujourd hui, Hier, puis le nom du jour dans la semaine ecoulee', () => {
    expect(libelleDuJour('2026-10-07T08:00:00', textes)).toBe("Aujourd'hui");
    expect(libelleDuJour('2026-10-06T23:30:00', textes)).toBe('Hier');
    expect(libelleDuJour('2026-10-03T10:00:00', textes)).toBe('Samedi');
  });

  it('au-dela d une semaine, la date ; l annee seulement si ce n est pas la meme', () => {
    expect(libelleDuJour('2026-09-12T10:00:00', textes)).toBe('12 septembre');
    expect(libelleDuJour('2025-12-24T10:00:00', textes)).toBe('24 décembre 2025');
  });
});

describe('etatDesCoches', () => {
  it('suit la regle du telephone : lu des qu une personne l a lu', () => {
    expect(etatDesCoches({ readBy: ['bruno'] })).toBe('lu');
    expect(etatDesCoches({ readBy: [] })).toBe('envoye');
    expect(etatDesCoches({})).toBe('envoye');
    expect(etatDesCoches({ pending: true })).toBe('en-cours');
    expect(etatDesCoches({ failed: true, pending: true })).toBe('echec');
  });
});

describe('indiceDeCouleur', () => {
  it('donne toujours la meme couleur a la meme personne, dans la palette', () => {
    const indice = indiceDeCouleur('bruno-msg1w', 13);
    expect(indice).toBe(indiceDeCouleur('bruno-msg1w', 13));
    expect(indice).toBeGreaterThanOrEqual(0);
    expect(indice).toBeLessThan(13);
    expect(indiceDeCouleur('', 0)).toBe(0);
  });
});

describe('estModifiable', () => {
  it('texte ou composition : oui ; sondage, vocal, partage ou proposition : non', () => {
    expect(estModifiable({ message: 'Salut' })).toBe(true);
    expect(estModifiable({ composition: { type: 'lineup_share' } })).toBe(true);
    ['poll', 'voice_note', 'event_share', 'location_share', 'contact_share', 'proposal']
      .forEach((type) => expect(estModifiable({ composition: { type } })).toBe(false));
  });
});

describe('evenementDuMessage', () => {
  it('un partage sans relation : l apercu du partage', () => {
    const apercu = { documentId: 'e1', name: 'Match', team: { name: 'U15' } };
    expect(evenementDuMessage({
      composition: { eventDocumentId: 'e1', eventPreview: apercu, type: 'event_share' },
    })).toEqual(apercu);
  });

  it('la relation complete l apercu, sans effacer ce qu elle ne porte pas', () => {
    const evenement = evenementDuMessage({
      composition: {
        eventDocumentId: 'e1',
        eventPreview: { name: 'Match', team: { name: 'U15' } },
        type: 'event_share',
      },
      event: { documentId: 'e1', rsvpEnabled: true, team: null },
    });
    expect(evenement).toEqual({
      documentId: 'e1', name: 'Match', rsvpEnabled: true, team: { name: 'U15' },
    });
  });

  it('un partage sans apercu : reconstruit depuis le partage ; rien sans identifiant', () => {
    expect(evenementDuMessage({
      composition: {
        eventDocumentId: 'e2', eventName: 'Tournoi', teamName: 'Seniors', type: 'event_share',
      },
    })).toMatchObject({ documentId: 'e2', name: 'Tournoi', team: { name: 'Seniors' } });
    expect(evenementDuMessage({ composition: { type: 'event_share' } })).toBeNull();
    expect(evenementDuMessage({ message: 'Salut' })).toBeNull();
  });
});
