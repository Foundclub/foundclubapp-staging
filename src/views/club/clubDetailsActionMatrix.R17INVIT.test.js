import { resolveClubDetailsActionMatrix } from './clubDetailsActionMatrix';

// 🏛️ R17-INVITER (19/10/2026) — correction du chef après la 2ᵉ passe de design (planche « tel que
// codé ») : la fiche d'un club ouverte par la Ville affichait « Je dirige ce club ». Un compte
// « Ville seule » (aucun rôle sportif, il gère une collectivité : isVilleOnlyAccount) n'a AUCUNE
// porte d'affiliation sur une fiche club : il ne dirige pas, ne joue pas, n'attend pas le club.
// La décision vit ICI, avec toutes les portes de la fiche (correction à la source, par le rôle).
// Ce qui ne bouge pas : le compte NEUF (sans rôle, sans Ville) garde « Je dirige ce club » — c'est
// la porte d'entrée d'un dirigeant qui arrive ; le compte MIXTE (dirigeant qui gère aussi une
// Ville) n'est pas « Ville seule ».

const CLUB_VIDE = {
  clubHasTeams: false,
  isAuthenticated: true,
  ownerCount: 0,
};

const PORTES = [
  'showChildInterestAction',
  'showClubArrivalInterestAction',
  'showClubInterestAction',
  'showClubPartneringAction',
  'showContactAdminClaimAction',
  'showEmptyClubClaimAction',
  'showJoinClubAction',
  'showPlayerClubAction',
  'showPlayerNoTeamAction',
  'showTeenSelfRequestHint',
];

describe('R17INVIT — la Ville seule n’a aucune porte d’affiliation sur une fiche club', () => {
  it('📌 le compte NEUF garde « Je dirige ce club » et « prévenez-moi »', () => {
    expect(resolveClubDetailsActionMatrix(CLUB_VIDE)).toMatchObject({
      showClubArrivalInterestAction: true,
      showEmptyClubClaimAction: true,
    });
  });

  it('✅ la Ville seule : aucune porte, club vide comme club qui a des équipes', () => {
    [
      { ...CLUB_VIDE, isVilleOnlyAccount: true },
      {
        ...CLUB_VIDE,
        canContactAdmin: true,
        canJoinClub: true,
        clubHasTeams: true,
        isVilleOnlyAccount: true,
        ownerCount: 1,
      },
      {
        ...CLUB_VIDE,
        canPlayerSignalMissingTeam: true,
        childrenUnder13Count: 1,
        isVilleOnlyAccount: true,
      },
    ].forEach((entree) => {
      const matrice = resolveClubDetailsActionMatrix(entree);
      expect(PORTES.filter((porte) => matrice[porte])).toEqual([]);
    });
  });

  it('📌 un visiteur sans compte garde ses deux portes de connexion', () => {
    expect(resolveClubDetailsActionMatrix({ isAuthenticated: false, isVilleOnlyAccount: false }))
      .toMatchObject({ showPublicClaimLogin: true, showPublicPlayerLogin: true });
  });
});
