import { colors } from '@/theme/colors';

import {
  couleurDuNom,
  estUnTeteATete,
  indexDeLaCouleurDuNom,
  NOMBRE_DE_COULEURS_DE_NOM,
  placeDansLeGroupe,
  reserveDeLHeure,
} from './habillageDuFil';

const message = (auteur, quand, extra = {}) => ({
  _id: `${auteur}-${quand}`,
  createdAt: new Date(quand),
  user: { _id: auteur },
  ...extra,
});

describe('MSG1A — habillage du fil', () => {
  test('la couleur d un nom est STABLE et tombe dans les 13 jetons du pack', () => {
    const premiere = indexDeLaCouleurDuNom('user-abc');
    expect(indexDeLaCouleurDuNom('user-abc')).toBe(premiere);
    expect(premiere).toBeGreaterThanOrEqual(0);
    expect(premiere).toBeLessThan(NOMBRE_DE_COULEURS_DE_NOM);
    expect(couleurDuNom(colors, 'user-abc')).toBe(colors[`chatName${premiere + 1}`]);
  });

  test('les 13 couleurs existent dans le theme (aucune ne retombe sur l accent)', () => {
    for (let i = 1; i <= NOMBRE_DE_COULEURS_DE_NOM; i += 1) {
      expect(colors[`chatName${i}`]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test('les identifiants se repartissent sur plusieurs couleurs', () => {
    const vues = new Set();
    for (let i = 0; i < 60; i += 1) vues.add(indexDeLaCouleurDuNom(`compte-${i}`));
    expect(vues.size).toBeGreaterThan(8);
  });

  test('un groupe = memes auteur ET jour ; le premier porte le nom, le dernier la queue', () => {
    const a1 = message('a', '2026-10-07T10:00:00');
    const a2 = message('a', '2026-10-07T10:01:00');
    const a3 = message('a', '2026-10-07T10:02:00');
    const b1 = message('b', '2026-10-07T10:03:00');

    expect(placeDansLeGroupe({ courant: a1, suivant: a2 }))
      .toEqual({ dernier: false, premier: true });
    expect(placeDansLeGroupe({ courant: a2, precedent: a1, suivant: a3 })).toEqual({
      dernier: false,
      premier: false,
    });
    expect(placeDansLeGroupe({ courant: a3, precedent: a2, suivant: b1 })).toEqual({
      dernier: true,
      premier: false,
    });
    expect(placeDansLeGroupe({ courant: b1, precedent: a3 }))
      .toEqual({ dernier: true, premier: true });
  });

  test('un changement de jour coupe le groupe, une ligne systeme aussi', () => {
    const hier = message('a', '2026-10-06T23:59:00');
    const aujourdhui = message('a', '2026-10-07T00:01:00');
    expect(placeDansLeGroupe({ courant: aujourdhui, precedent: hier }).premier).toBe(true);

    const systeme = message('a', '2026-10-07T00:02:00', { system: true });
    expect(placeDansLeGroupe({ courant: aujourdhui, suivant: systeme }).dernier).toBe(true);
  });

  test('la reserve de l heure est plus large sur mes bulles (heure + coches)', () => {
    expect(reserveDeLHeure(true).length).toBeGreaterThan(reserveDeLHeure(false).length);
    expect(reserveDeLHeure(true)).toMatch(/^\u00A0+$/);
  });

  test('seul le tete-a-tete cache noms et avatars', () => {
    expect(estUnTeteATete('whisper')).toBe(true);
    ['group', 'team', 'club', 'league_match', 'friendly_match', 'collectivite_club'].forEach(
      (type) => expect(estUnTeteATete(type)).toBe(false),
    );
  });
});

describe('MSG1A — §3.3 la citation', () => {
  // eslint-disable-next-line global-require
  const { auteurDuMessageCite, extraitDuMessageCite } = require('./habillageDuFil');
  const t = (cle, repli) => repli;

  test('Q1 — un texte se cite tel quel, sans icone', () => {
    expect(extraitDuMessageCite({ message: 'Je ramene les plots' }, t)).toEqual({
      icone: '',
      texte: 'Je ramene les plots',
    });
  });

  test('Q2 — un contenu riche se dit avec son icone', () => {
    expect(
      extraitDuMessageCite({ composition: { question: 'Quel creneau ?', type: 'poll' } }, t),
    ).toEqual({ icone: 'chartSimpleHorizontal', texte: 'Quel creneau ?' });
    expect(extraitDuMessageCite({ composition: { type: 'voice_note' } }, t)).toEqual({
      icone: 'microphone',
      texte: 'Message vocal',
    });
    expect(
      extraitDuMessageCite(
        { composition: { eventDisplayName: 'Match vs US Pelican', type: 'lineup_share' } },
        t,
      ),
    ).toEqual({ icone: 'users', texte: 'Composition · Match vs US Pelican' });
    expect(extraitDuMessageCite({ image: 'https://x/y.jpg', text: '' }, t)).toEqual({
      icone: 'image',
      texte: 'Photo',
    });
    expect(
      extraitDuMessageCite({ attachments: [{ mime: 'application/pdf', name: 'Programme.pdf' }] }, t)
        .icone,
    ).toBe('file');
  });

  test('Q3 — l auteur cite : « Vous » si c est moi, sinon prenom nom', () => {
    const cite = { sender: { documentId: 'moi', firstname: 'Adel' } };
    expect(auteurDuMessageCite(cite, 'moi', t)).toEqual(
      { identifiant: 'moi', nom: 'Vous' },
    );
    expect(
      auteurDuMessageCite(
        { sender: { documentId: 'k', firstname: 'Karim', lastname: 'Benali' } },
        'moi',
        t,
      ),
    ).toEqual({ identifiant: 'k', nom: 'Karim Benali' });
    expect(auteurDuMessageCite({ user: { _id: 'k', name: 'Karim B' } }, 'moi', t)).toEqual({
      identifiant: 'k',
      nom: 'Karim B',
    });
  });
});
