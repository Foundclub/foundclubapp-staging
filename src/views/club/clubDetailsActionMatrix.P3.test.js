import {
  childrenForPlaceRequest,
  countChildrenByAgeBand,
  pendingChildRequestKey,
  pendingChildRequestKeys,
  resolveClubDetailsActionMatrix,
} from './clubDetailsActionMatrix';

// ─────────────────────────────────────────────────────────────────────────────
// 👶 PARENT P3 (2026-09-11) — « UNE PLACE POUR MON ENFANT », SUR LA FICHE CLUB.
//
// Decision d'Adel du 11/09 (« 1- a ») : la demande porte l'enfant — les
// responsables de l'equipe voient son prenom et son age. La fiche club doit donc
// savoir deux choses, et elles se decident ICI, a cote des autres portes :
//   · QUELS enfants peuvent encore demander une place (moins de 13 ans, E17 ; et
//     pas deja dans une equipe : le serveur le refuserait) ;
//   · POUR QUI une demande est deja partie, equipe par equipe.
//
// ⛔ La fiche club ne recoit que le PRENOM et l'IDENTIFIANT : c'est ce que la
// phrase « Une place pour Léa » et l'envoi de la demande exigent, rien de plus.
// ─────────────────────────────────────────────────────────────────────────────

const LEA = {
  age: 7,
  documentId: 'enfant-lea',
  firstname: 'Léa',
  lastname: 'Benali',
  team: null,
};
const NOUR_DEJA_EN_EQUIPE = {
  age: 9,
  documentId: 'enfant-nour',
  firstname: 'Nour',
  team: { documentId: 'team-u9', name: 'U9' },
};
const HUGO_16_ANS = {
  age: 16,
  documentId: 'enfant-hugo',
  firstname: 'Hugo',
  team: null,
};

describe('P3/10 — une place pour mon enfant, sur la fiche club', () => {
  // 👶 PAR-L4 (13/10, design parent E11) — la feuille montre TOUS les enfants mineurs ; seuls
  // ceux de MOINS DE 13 ANS et SANS equipe peuvent demander (`reason` nul). AVANT (P3) :
  // `eligibleChildrenForTeamRequest` ne rendait QUE ceux-la, et les autres disparaissaient.
  it('seuls les enfants de MOINS DE 13 ANS et SANS equipe peuvent demander une place', () => {
    const enfants = childrenForPlaceRequest([LEA, NOUR_DEJA_EN_EQUIPE, HUGO_16_ANS]);

    expect(enfants.map((enfant) => [enfant.documentId, enfant.reason])).toEqual([
      ['enfant-lea', null],
      ['enfant-nour', 'placed'],
      ['enfant-hugo', 'teen'],
    ]);
    expect(enfants[1].teamName).toBe('U9');
  });

  it('age inconnu : ni « moins de 13 ans », ni ado — sa raison a lui', () => {
    const [noe] = childrenForPlaceRequest([
      { age: null, documentId: 'enfant-noe', firstname: 'Noé' },
    ]);
    expect(noe.reason).toBe('unknownAge');
    expect(noe.age).toBeNull();
    expect(countChildrenByAgeBand([{ age: null }, LEA])).toEqual({
      childrenUnder13Count: 1,
      childrenWithUnknownAgeCount: 1,
      minorChildrenCount: 2,
    });
  });

  it('un adulte (18 ans) n apparait pas : le lien parental est eteint', () => {
    expect(childrenForPlaceRequest([{ age: 18, documentId: 'enfant-adulte', firstname: 'Sam' }]))
      .toEqual([]);
  });

  it('la feuille recoit ce qu elle montre, et rien de plus (ni naissance, ni photo)', () => {
    const [lea] = childrenForPlaceRequest([
      { ...LEA, birthdate: '2019-01-01', photo: { url: 'x' } },
    ]);

    expect(Object.keys(lea).sort()).toEqual([
      'age', 'documentId', 'firstname', 'lastname', 'pendingHereCount', 'reason', 'teamName',
    ]);
  });

  it('une liste absente ou abimee ne fait pas tomber la fiche club', () => {
    expect(childrenForPlaceRequest(undefined)).toEqual([]);
    expect(childrenForPlaceRequest([null, { age: 7 }])).toEqual([]);
  });

  it('les demandes en attente ICI se comptent par enfant — pas celles d un frere', () => {
    const demandes = [
      { declaredChild: { documentId: 'enfant-lea' }, status: 'pending', team: { documentId: 'a' } },
      { declaredChild: { documentId: 'enfant-lea' }, status: 'pending', team: { documentId: 'b' } },
      {
        declaredChild: { documentId: 'enfant-lea' },
        status: 'responded',
        team: { documentId: 'c' },
      },
    ];
    const [lea, nour] = childrenForPlaceRequest(
      [LEA, { ...NOUR_DEJA_EN_EQUIPE, team: null }],
      demandes,
    );

    expect(lea.pendingHereCount).toBe(2);
    expect(nour.pendingHereCount).toBe(0);
  });

  it('une demande EN ATTENTE se reconnait par equipe ET par enfant — pas celle d un adulte', () => {
    const demandes = [
      {
        declaredChild: { documentId: 'enfant-lea' },
        status: 'pending',
        team: { documentId: 'team-u11' },
      },
      {
        declaredChild: { documentId: 'enfant-lea' },
        status: 'responded',
        team: { documentId: 'team-u13' },
      },
      { status: 'pending', team: { documentId: 'team-u11' } },
    ];

    const cles = pendingChildRequestKeys(demandes);

    expect(cles.has(pendingChildRequestKey('team-u11', 'enfant-lea'))).toBe(true);
    expect(cles.has(pendingChildRequestKey('team-u13', 'enfant-lea'))).toBe(false);
    expect(cles.size).toBe(1);
  });

  it('un enfant DEJA dans une equipe : la porte RESTE, sans explication pour ado', () => {
    // 👶 PAR-L4 (design parent E10) — AVANT : Lea deja placee, la porte s'effacait sans un mot.
    // Elle reste : la feuille dit « Déjà dans U9 ». Et ce n'est PAS un ado, donc la phrase
    // « a partir de 13 ans » serait fausse.
    expect(resolveClubDetailsActionMatrix({
      childrenUnder13Count: 1,
      clubHasTeams: true,
      isAuthenticated: true,
      minorChildrenCount: 1,
    })).toMatchObject({
      showChildInterestAction: true,
      showTeenSelfRequestHint: false,
    });
  });

  it('age inconnu seulement : la porte (la feuille dira « Âge inconnu »), pas la phrase ado', () => {
    expect(resolveClubDetailsActionMatrix({
      childrenUnder13Count: 0,
      childrenWithUnknownAgeCount: 1,
      clubHasTeams: true,
      isAuthenticated: true,
      minorChildrenCount: 1,
    })).toMatchObject({
      showChildInterestAction: true,
      showTeenSelfRequestHint: false,
    });
  });
});
