import {
  childIdsWithPendingRequest,
  eligibleChildrenForTeamRequest,
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
  it('seuls les enfants de MOINS DE 13 ANS et SANS equipe peuvent demander une place', () => {
    expect(eligibleChildrenForTeamRequest([LEA, NOUR_DEJA_EN_EQUIPE, HUGO_16_ANS])).toEqual([
      { documentId: 'enfant-lea', firstname: 'Léa' },
    ]);
  });

  it('la fiche club ne recoit que le prenom et l identifiant : ni nom, ni age, ni equipe', () => {
    const [lea] = eligibleChildrenForTeamRequest([LEA]);

    expect(Object.keys(lea).sort()).toEqual(['documentId', 'firstname']);
  });

  it('une liste absente ou abimee ne fait pas tomber la fiche club', () => {
    expect(eligibleChildrenForTeamRequest(undefined)).toEqual([]);
    expect(eligibleChildrenForTeamRequest([null, { age: 7 }])).toEqual([]);
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
    expect([...childIdsWithPendingRequest(demandes)]).toEqual(['enfant-lea']);
  });

  it('un enfant DEJA dans une equipe : ni porte, ni explication pour ado', () => {
    // Lea a moins de 13 ans, mais elle est deja placee : le serveur refuserait une
    // seconde equipe. La porte s'efface — et ce n'est PAS un ado, donc la phrase
    // « a partir de 13 ans » serait fausse.
    expect(resolveClubDetailsActionMatrix({
      childrenAwaitingTeamCount: 0,
      childrenUnder13Count: 1,
      clubHasTeams: true,
      isAuthenticated: true,
      minorChildrenCount: 1,
    })).toMatchObject({
      showChildInterestAction: false,
      showTeenSelfRequestHint: false,
    });
  });

  it('sans l information nouvelle, la regle de P2 reste intacte', () => {
    expect(resolveClubDetailsActionMatrix({
      childrenUnder13Count: 1,
      clubHasTeams: true,
      isAuthenticated: true,
      minorChildrenCount: 1,
    })).toMatchObject({ showChildInterestAction: true });
  });
});
