/**
 * INVIT2 · B — QUI PROPOSER, ET POURQUOI. Temoins des fonctions pures de la feuille.
 *
 * Avant le lot, la feuille ne proposait que les membres du club — et chez Adel,
 * ils etaient tous deja dans l'equipe : « Personne d'autre ». Le serveur rend
 * desormais des propositions avec leur RAISON (demande, candidature, autre
 * equipe du club, club) ; ces fonctions les trient, les filtrent et disent
 * pourquoi chacune est la.
 */
import i18next from 'i18next';

import fr from '@/theme/strings/translations/fr';

import {
  buildTeamInviteShareText,
  describeSentInviteState,
  describeSuggestionReason,
  isPlausibleInvitePhone,
  selectSheetSuggestions,
} from '../teamInviteSuggestions';

beforeAll(async () => {
  await i18next.init({
    compatibilityJSON: 'v4',
    fallbackLng: 'fr',
    lng: 'fr',
    resources: { fr: { translation: fr } },
  });
});

const deuxChiffres = (valeur) => String(valeur).padStart(2, '0');

const formatDate = (iso) => {
  const date = new Date(iso);
  return `${deuxChiffres(date.getUTCDate())}/${deuxChiffres(date.getUTCMonth() + 1)}`;
};

const raison = (proposition) => describeSuggestionReason(proposition, formatDate);

describe('INVIT2 · B — pourquoi une personne est proposee', () => {
  test('🔴 chaque raison a sa phrase', () => {
    expect(raison({ reason: 'requested', reasonDate: '2026-09-12T10:00:00Z' }))
      .toBe('A demandé à rejoindre l\'équipe le 12/09');
    expect(raison({ reason: 'applied', reasonLabel: 'Recherche gardien' }))
      .toBe('A candidaté : Recherche gardien');
    expect(raison({ reason: 'otherTeam', reasonLabel: 'U17' })).toBe('Joue en U17');
    expect(raison({ reason: 'club' })).toBe('Membre de ton club');
    expect(raison({ reason: 'clubStaff' })).toBe('Encadrant de ton club');
  });
});

describe('INVIT2 · B — la liste de la feuille', () => {
  const serveur = [
    {
      documentId: 'zoe', firstname: 'Zoé', lastname: 'D', reason: 'requested', requestId: 'req-1',
    },
    {
      documentId: 'ines', firstname: 'Inès', lastname: 'M', reason: 'otherTeam', reasonLabel: 'U17',
    },
  ];

  test('🔴 les propositions du SERVEUR passent avant les membres du club', () => {
    const liste = selectSheetSuggestions({
      clubMembers: [{ documentId: 'autre', firstname: 'Autre', lastname: 'X' }],
      serverSuggestions: serveur,
      team: { players: [], trainers: [] },
    });
    expect(liste.map((p) => p.documentId)).toEqual(['zoe', 'ines']);
  });

  test('sans reponse du serveur, on retombe sur les membres du club (raison « club »)', () => {
    const liste = selectSheetSuggestions({
      clubMembers: [{ documentId: 'autre', firstname: 'Autre', lastname: 'X' }],
      serverSuggestions: undefined,
      team: { players: [], trainers: [] },
    });
    expect(liste).toEqual([expect.objectContaining({ documentId: 'autre', reason: 'club' })]);
  });

  test('la recherche filtre, et une personne invitee a l instant garde son etat', () => {
    const liste = selectSheetSuggestions({
      invitedIds: ['ines'],
      search: 'in',
      serverSuggestions: serveur,
      team: { players: [], trainers: [] },
    });
    expect(liste).toEqual([
      expect.objectContaining({ documentId: 'ines', hasPendingInvitation: true }),
    ]);
  });

  test('🔒 une personne qui vient d ENTRER dans l equipe n est plus proposee', () => {
    const liste = selectSheetSuggestions({
      serverSuggestions: serveur,
      team: { players: [{ documentId: 'zoe' }], trainers: [] },
    });
    expect(liste.map((p) => p.documentId)).toEqual(['ines']);
  });
});

describe('INVIT2 · D — l etat d une invitation envoyee', () => {
  test('🔴 chaque etat se lit', () => {
    const etat = (invitation) => describeSentInviteState(invitation, formatDate);
    expect(etat({ expiresAt: '2026-10-15T18:00:00Z', state: 'pending' }))
      .toBe('En attente · expire le 15/10');
    expect(etat({ state: 'accepted' })).toBe('Acceptée');
    expect(etat({ state: 'refused' })).toBe('Refusée');
    expect(etat({ state: 'expired' })).toBe('Expirée');
    expect(etat({ state: 'cancelled' })).toBe('Annulée');
  });
});

describe('INVIT2 · C — le texte partage est pret a coller', () => {
  test('🔴 une phrase humaine : qui invite, quelle equipe, quel club', () => {
    const noms = { clubName: 'FoundClub', inviterName: 'Adel', teamName: 'SENIOR' };
    expect(buildTeamInviteShareText(noms))
      .toBe(
        'Adel t\'invite à rejoindre l\'équipe SENIOR (FoundClub) sur FoundClub.'
        + ' Ouvre ce lien pour voir l\'invitation :',
      );
  });

  test('sans prenom ni club, la phrase tient debout', () => {
    expect(buildTeamInviteShareText({ teamName: 'SENIOR' }))
      .toBe(
        'Tu es invité·e à rejoindre l\'équipe SENIOR sur FoundClub.'
        + ' Ouvre ce lien pour voir l\'invitation :',
      );
  });
});

describe('INVIT2 · E — le numero tape', () => {
  test('un numero plausible a au moins 8 chiffres, et un champ vide n en est pas un', () => {
    expect(isPlausibleInvitePhone('06 12 34 56 78')).toBe(true);
    expect(isPlausibleInvitePhone('+33 6 12 34 56 78')).toBe(true);
    expect(isPlausibleInvitePhone('0612')).toBe(false);
    expect(isPlausibleInvitePhone('')).toBe(false);
  });
});
