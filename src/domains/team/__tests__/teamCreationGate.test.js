import {
  clubAllowsCoachTeamCreation,
  isClubAffiliationPending,
  resolveTeamCreationGate,
  TEAM_CREATION_BLOCK,
} from '@/domains/team/teamCreationGate';

// FILET E6 — lot EQUIPES (2026-08-28).
//
// Recette d'Adel du 28/08, club STADE MARSEILLAIS UNIVERSITE CLUB : à l'étape
// 8/8 du tunnel d'équipe, une fenêtre « Erreur » affiche, en anglais,
// `User is not an authorized staff member of this club`.
//
// MESURE FAITE AVANT D'ÉCRIRE UNE LIGNE :
//   · `admin/src/api/team/policies/is-team-staff-create.ts:95` appelle
//     `isClubStaffMember(user, data.club)` SANS liste de rôles, donc avec le
//     défaut `['dirigeant', 'entraineur']`. Un entraîneur n'est donc PAS exclu
//     par son rôle.
//   · Le refus vient une couche plus bas : `getClubAuthorizationContext` ne
//     reconnaît comme membre que `club.members` / `user.club` /
//     `user.clubAffiliations` / `multisportClubs.sections`. Une
//     `club-membership-request` à l'état `pending` n'en fait PAS partie.
//   · Et `app/src/domains/auth/authUseCases.js:92` (`resolveMyClubDocumentId`)
//     laisse ENTRER dans le tunnel sur cette même demande `pending`.
//   ⇒ Le serveur avait RAISON de refuser. Les deux vrais défauts sont la
//     LANGUE du message et le MOMENT où il arrive.
//
// Ce fichier fige les deux questions que l'app peut trancher toute seule :
// ① suis-je affilié ? ② ce club autorise-t-il ses coachs ?
// ⛔ Il ne fige PAS ③ « ai-je la place » : ça reste au serveur.

const CLUB_ID = 'club-smuc';

const buildClub = (/** @type {any} */ overrides = {}) => ({
  documentId: CLUB_ID,
  name: 'SMUC',
  ...overrides,
});

const buildCoach = (/** @type {any} */ overrides = {}) => ({
  documentId: 'moi',
  role: { name: 'Entraineur', type: 'entraineur' },
  ...overrides,
});

describe('EQUIPES ① — être affilié', () => {
  it("reconnaît une adhésion qui n'est encore qu'une demande en attente", () => {
    const coach = buildCoach({
      club: null,
      clubMembershipRequests: [{ club: { documentId: CLUB_ID }, state: 'pending' }],
    });

    expect(isClubAffiliationPending(coach, CLUB_ID)).toBe(true);
  });

  it("ne bloque pas quand l'adhésion est acquise, même si une vieille demande traîne", () => {
    const coach = buildCoach({
      club: { documentId: CLUB_ID },
      clubMembershipRequests: [{ club: { documentId: CLUB_ID }, state: 'pending' }],
    });

    expect(isClubAffiliationPending(coach, CLUB_ID)).toBe(false);
  });

  it("le refus arrive à l'ENTRÉE, en français, et il dit quoi faire", () => {
    const coach = buildCoach({
      club: null,
      clubMembershipRequests: [{ club: { documentId: CLUB_ID }, state: 'pending' }],
    });

    const decision = resolveTeamCreationGate({ club: buildClub(), userData: coach });

    expect(decision.isAllowed).toBe(false);
    expect(decision.blockReason).toBe(TEAM_CREATION_BLOCK.affiliationPending);
    // Le texte d'Adel : jamais un code, jamais de l'anglais.
    expect(decision.message).not.toMatch(/authorized staff member/i);
    expect(decision.message).toMatch(/dirigeant/i);
    expect(decision.title.length).toBeGreaterThan(0);
  });
});

describe('EQUIPES ② — avoir le droit', () => {
  it('autorise les coachs par DÉFAUT : un club existant ne change pas de comportement', () => {
    // ⚠️ Le cliquet du lot. `isClubStaffMember` accepte `entraineur` par défaut
    // aujourd'hui : un club qui n'a jamais touché au réglage doit continuer.
    expect(clubAllowsCoachTeamCreation(buildClub())).toBe(true);
    expect(clubAllowsCoachTeamCreation(buildClub({ teamCreationManagementMode: undefined }))).toBe(true);

    const decision = resolveTeamCreationGate({ club: buildClub(), userData: buildCoach({ club: { documentId: CLUB_ID } }) });
    expect(decision.isAllowed).toBe(true);
  });

  it('bloque le coach quand le dirigeant a réservé la création aux dirigeants', () => {
    const club = buildClub({ teamCreationManagementMode: 'CLUB_OWNER_ONLY' });
    const decision = resolveTeamCreationGate({
      club,
      userData: buildCoach({ club: { documentId: CLUB_ID } }),
    });

    expect(clubAllowsCoachTeamCreation(club)).toBe(false);
    expect(decision.isAllowed).toBe(false);
    expect(decision.blockReason).toBe(TEAM_CREATION_BLOCK.coachNotAllowed);
    expect(decision.message).toMatch(/dirigeant/i);
  });

  it('ne bloque JAMAIS le dirigeant, même avec le réglage le plus fermé', () => {
    const decision = resolveTeamCreationGate({
      club: buildClub({ teamCreationManagementMode: 'CLUB_OWNER_ONLY' }),
      userData: { club: { documentId: CLUB_ID }, documentId: 'chef', role: { name: 'Dirigeant', type: 'president' } },
    });

    expect(decision.isAllowed).toBe(true);
  });
});

describe('EQUIPES ⑤ — la validation par le dirigeant', () => {
  it('annonce au coach que son équipe devra être validée', () => {
    const decision = resolveTeamCreationGate({
      club: buildClub({ teamCreationByCoachesRequiresValidation: true }),
      userData: buildCoach({ club: { documentId: CLUB_ID } }),
    });

    expect(decision.isAllowed).toBe(true);
    expect(decision.requiresClubApproval).toBe(true);
  });

  it("ne l'annonce pas au dirigeant : ses équipes n'ont personne à attendre", () => {
    const decision = resolveTeamCreationGate({
      club: buildClub({ teamCreationByCoachesRequiresValidation: true }),
      userData: { club: { documentId: CLUB_ID }, documentId: 'chef', role: { name: 'Dirigeant', type: 'president' } },
    });

    expect(decision.requiresClubApproval).toBe(false);
  });

  it("n'annonce rien quand le club n'exige pas de validation (défaut)", () => {
    const decision = resolveTeamCreationGate({
      club: buildClub(),
      userData: buildCoach({ club: { documentId: CLUB_ID } }),
    });

    expect(decision.requiresClubApproval).toBe(false);
  });
});
