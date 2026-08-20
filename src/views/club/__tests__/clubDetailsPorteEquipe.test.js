import { canCreateTeamInClub } from '../clubDetailsActionMatrix';

// Filet AA04 ③ (E6) — « JE DIS "C'EST MON CLUB", ENSUITE JE CLIQUE SUR "CRÉER
// MON ÉQUIPE" — ÇA ME RENVOIE DANS LA PAGE "TROUVER UN CLUB" POUR CRÉER UNE
// ÉQUIPE » (Adel, 2026-08-20).
//
// 🚩 LA 4e IMPASSE, celle qu'aucun des trois constats ne nomme : sur la fiche
// de SON PROPRE club, un entraineur n'avait AUCUNE porte vers une equipe. La
// section « Equipes » et sa carte « + Creer une equipe » etaient reservees a
// `canEdit`, c'est-a-dire au seul role `president`. Or le serveur laisse
// l'entraineur qui cree un club RESTER entraineur tant qu'il n'a pas coche
// « je suis aussi dirigeant » (`club-self-onboard.ts`,
// `resolveCreatorRoleTarget`) — donc le cas par defaut du parcours d'Adel.

describe('AA04 ③ — « creer mon equipe » existe sur la fiche de SON club', () => {
  it('un entraineur rattache a ce club peut y creer une equipe', () => {
    expect(canCreateTeamInClub({
      canEdit: false,
      hasAdministrativeClubAccess: true,
      isClubStaffRole: true,
    })).toBe(true);
  });

  it('un dirigeant qui edite le club le peut toujours, comme avant', () => {
    expect(canCreateTeamInClub({
      canEdit: true,
      hasAdministrativeClubAccess: false,
      isClubStaffRole: false,
    })).toBe(true);
  });
});

describe('AA04 🔒 — la porte ne s ouvre pas chez les autres', () => {
  it('un entraineur de passage sur le club d un autre n a pas la porte', () => {
    expect(canCreateTeamInClub({
      canEdit: false,
      hasAdministrativeClubAccess: false,
      isClubStaffRole: true,
    })).toBe(false);
  });

  it('un joueur, meme rattache a ce club, ne l a pas non plus', () => {
    expect(canCreateTeamInClub({
      canEdit: false,
      hasAdministrativeClubAccess: true,
      isClubStaffRole: false,
    })).toBe(false);
  });

  it('sans rien de connu, la porte reste fermee', () => {
    expect(canCreateTeamInClub({})).toBe(false);
  });
});
