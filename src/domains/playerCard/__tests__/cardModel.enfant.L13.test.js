/**
 * PAR-L13 (13/10) — CE QUE LA CARTE D UN ENFANT DECLARE MONTRE, calcule a partir de la fiche
 * que rend le serveur (prenom, nom, AGE — jamais la date —, equipe, club, numero, poste, photo,
 * ville, nationalite). Decision d'Adel du 12/10 (registre des mineurs, ligne 23) : carte
 * « pareille que les autres », photo, ville et nationalite OUI, code QR NON.
 */
import { buildDeclaredChildCardProps } from '../cardModel';

const LIBELLES = { noTeam: 'Pas encore d’équipe', years: 'ANS' };

const ANISSA = {
  age: 11,
  city: 'Marseille',
  club: { documentId: 'club-fc', name: 'FoundClub' },
  documentId: 'anissa',
  firstname: 'Anissa',
  lastname: 'Dubelloy',
  nationality: 'Française',
  number: 7,
  photo: { url: '/uploads/anissa.jpg' },
  position: 'Meneuse',
  team: { documentId: 'u11', name: 'U11 Filles' },
};

describe('PAR-L13 — buildDeclaredChildCardProps', () => {
  test('🔴 une fiche complete donne la carte de la maquette (E29)', () => {
    expect(buildDeclaredChildCardProps({ enfant: ANISSA, libelles: LIBELLES })).toEqual({
      age: '11 ANS',
      // CARTECODE Q7 B : les cases de son equipe (vides : la fiche du test n en porte pas).
      categorie: '',
      equipe: 'U11 Filles · FoundClub',
      nationalite: 'Française',
      niveau: '',
      nom: 'DUBELLOY',
      numero: '7',
      photoUrl: '/uploads/anissa.jpg',
      poste: 'Meneuse',
      prenom: 'Anissa',
      rarity: 'COMMON',
      section: '',
      sport: '',
      statut: null,
      ville: 'Marseille',
    });
  });

  test('🔴 jamais de code QR ni de lien : la carte n a pas de `qrValue`', () => {
    const carte = buildDeclaredChildCardProps({ enfant: ANISSA, libelles: LIBELLES });

    expect(carte).not.toHaveProperty('qrValue');
    expect(JSON.stringify(carte)).not.toMatch(/https?:/);
  });

  test('🔴 une fiche toute neuve (E28) : numero « ? », pas encore d equipe, rangees vides', () => {
    const carte = buildDeclaredChildCardProps({
      enfant: {
        age: 9, documentId: 'lea', firstname: 'Léa', lastname: 'Martin',
      },
      libelles: LIBELLES,
    });

    expect(carte.numero).toBe('?');
    expect(carte.equipe).toBe('Pas encore d’équipe');
    expect(carte.poste).toBe('');
    expect(carte.ville).toBe('');
    expect(carte.nationalite).toBe('');
    expect(carte.photoUrl).toBeNull();
  });

  test('🔴 la carte se remplit a mesure qu on tape (E28) : la saisie passe devant la fiche', () => {
    const carte = buildDeclaredChildCardProps({
      enfant: ANISSA,
      libelles: LIBELLES,
      saisie: {
        city: ' Aix ', nationality: '', number: '10', position: 'Ailière',
      },
    });

    expect(carte.numero).toBe('10');
    expect(carte.poste).toBe('Ailière');
    expect(carte.ville).toBe('Aix');
    expect(carte.nationalite).toBe('');
  });

  test('un maillot n° 0 est un maillot', () => {
    expect(buildDeclaredChildCardProps({ enfant: { ...ANISSA, number: 0 } }).numero).toBe('0');
  });
});
