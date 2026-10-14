import { USER_ROLES } from '@/domains/auth/authUseCases';

import {
  describeChildChoices,
  errorKey,
  resolveChildRegistrationOffer,
  resultLine,
  statusLine,
} from './childRegistrationFlow';
import { resolveParticipationOffer } from './participationFlow';

// 👪 PAR-L11b (13/10) — « INSCRIRE MES ENFANTS » : la regle par type (D4 B d Adel, 12/10)
// telle que l ecran la montre, le choix des enfants avec la raison de ceux qu on ne peut pas
// cocher, et une ligne de resultat PAR enfant. Le serveur reste juge (admin
// `child-registration-rules.js`) : ces fonctions disent seulement quoi montrer.
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).
const MAINTENANT = Date.now();
const JOUR = 24 * 3600 * 1000;
const DANS_UNE_SEMAINE = new Date(MAINTENANT + 7 * JOUR).toISOString();
const HIER = new Date(MAINTENANT - JOUR).toISOString();
const BLOQUE = 'childEventRegistration.blocked';
const RAISON = 'childEventRegistration.reasons';

const evenement = (typeName, extra = {}) => ({
  date: DANS_UNE_SEMAINE,
  eventFormat: 'single',
  isActive: true,
  sessionStatus: 'open',
  type: { name: typeName },
  ...extra,
});
const offre = (event) => resolveChildRegistrationOffer(event, MAINTENANT);

describe('PAR-L11b — la regle par type (D4 B)', () => {
  test.each([
    ["Détection / Séance d'essai"],
    ['Entraînement'],
    ['Match'],
    ['Autre'],
  ])('%s : une demande, validee par l organisateur', (typeName) => {
    expect(offre(evenement(typeName))).toEqual({
      admission: 'request',
      blockedKey: null,
      canAct: true,
    });
  });

  test('stage principal : une demande pour le stage ENTIER ; une journee renvoie au stage', () => {
    expect(offre(evenement('Stage', { eventFormat: 'stage_parent' })).admission).toBe('request');
    expect(offre(evenement('Stage', { eventFormat: 'stage_day' }))).toEqual({
      admission: null,
      blockedKey: `${BLOQUE}.stageDay`,
      canAct: false,
    });
  });

  test('reservation qui recrute : immediate ; complete ou en groupe ferme : pas de bouton', () => {
    const resa = (extra) => evenement('Réservation', {
      missingPlayers: 2,
      reservationMode: 'RECRUITING',
      ...extra,
    });
    expect(offre(resa()).admission).toBe('immediate');
    expect(offre(resa({ missingPlayers: 0 })).blockedKey).toBe(`${BLOQUE}.full`);
    expect(offre(resa({ reservationMode: 'FULL_GROUP' })).blockedKey)
      .toBe(`${BLOQUE}.reservationClosed`);
  });

  test('tournoi et match amical : PAS de bouton, une phrase qui dit pourquoi', () => {
    expect(offre(evenement('Tournoi'))).toEqual({
      admission: null,
      blockedKey: `${BLOQUE}.tournament`,
      canAct: false,
    });
    expect(offre(evenement('Match amical')).blockedKey).toBe(`${BLOQUE}.friendly`);
  });

  test('evenement ferme, passe ou annule : pas de bouton', () => {
    expect(offre(evenement('Match', { sessionStatus: 'closed' })).blockedKey)
      .toBe(`${BLOQUE}.invitedTeamsOnly`);
    expect(offre(evenement('Match', { date: HIER })).blockedKey).toBe(`${BLOQUE}.past`);
    expect(offre(evenement('Match', { status: 'cancelled' })).blockedKey)
      .toBe(`${BLOQUE}.cancelled`);
  });
});

describe('PAR-L11b — qui peut-on cocher ?', () => {
  test('deja inscrits, en attente, 13 ans et plus : MONTRES, avec leur raison', () => {
    const enfants = [
      { age: 9, documentId: 'anissa', firstname: 'Anissa' },
      { age: 7, documentId: 'martin', firstname: 'Martin' },
      { age: 14, documentId: 'lina', firstname: 'Lina' },
      { age: 8, documentId: 'sami', firstname: 'Sami' },
      { age: 10, documentId: 'noe', firstname: 'Noe' },
    ];
    const inscriptions = [
      { child: { documentId: 'martin' }, status: 'pending' },
      { child: { documentId: 'sami' }, status: 'accepted' },
      { child: { documentId: 'noe' }, status: 'declined' },
    ];

    expect(describeChildChoices(enfants, inscriptions).map(
      ({ documentId, reasonKey, selectable }) => ({ documentId, reasonKey, selectable }),
    )).toEqual([
      { documentId: 'anissa', reasonKey: null, selectable: true },
      { documentId: 'martin', reasonKey: `${RAISON}.alreadyPending`, selectable: false },
      { documentId: 'lina', reasonKey: `${RAISON}.tooOld`, selectable: false },
      { documentId: 'sami', reasonKey: `${RAISON}.alreadyRegistered`, selectable: false },
      { documentId: 'noe', reasonKey: null, selectable: true },
    ]);
    expect(describeChildChoices(enfants, [])[0]).toEqual({
      age: 9,
      documentId: 'anissa',
      firstname: 'Anissa',
      reasonKey: null,
      selectable: true,
    });
  });
});

describe('PAR-L11b — une ligne par enfant', () => {
  test('resultat : envoyee, inscrit, plus de place, deja en attente, refus inconnu', () => {
    expect(resultLine({ firstname: 'Anissa', outcome: 'pending' })).toEqual({
      key: 'childEventRegistration.result.pending',
      params: { firstname: 'Anissa' },
      tone: 'ok',
    });
    expect(resultLine({ firstname: 'Anissa', outcome: 'accepted' }).key)
      .toBe('childEventRegistration.result.accepted');
    expect(resultLine({ code: 'FULL', firstname: 'Sami', outcome: 'refused' })).toEqual({
      key: 'childEventRegistration.result.refused.FULL',
      params: { firstname: 'Sami' },
      tone: 'refused',
    });
    expect(resultLine({ code: 'ALREADY_PENDING', firstname: 'Martin', outcome: 'refused' }).key)
      .toBe('childEventRegistration.result.refused.ALREADY_PENDING');
    expect(resultLine({ code: 'QUELQUE_CHOSE', firstname: 'Noe', outcome: 'refused' }).key)
      .toBe('childEventRegistration.result.refused.default');
  });

  test('statut relu par le parent : en attente, confirmee, refusee avec son motif', () => {
    const anissa = { firstname: 'Anissa' };
    expect(statusLine({ child: anissa, status: 'pending' }).key)
      .toBe('childEventRegistration.status.pending');
    expect(statusLine({ child: anissa, status: 'accepted' }).key)
      .toBe('childEventRegistration.status.accepted');
    expect(statusLine({ child: anissa, reason: 'Complet', status: 'declined' })).toEqual({
      key: 'childEventRegistration.status.declinedWithReason',
      params: { firstname: 'Anissa', reason: 'Complet' },
      tone: 'refused',
    });
  });
});

describe('PAR-L11b — participationFlow : le parent n a rien a repondre POUR LUI', () => {
  test('un parent connecte : « ses enfants », jamais une reponse ni la connexion', () => {
    expect(resolveParticipationOffer({
      isConvenedMember: false,
      user: { documentId: 'compte-maman', role: { name: USER_ROLES.parent } },
    })).toBe('children');
  });
});

describe('PAR-L11b — un refus du serveur se lit en clair', () => {
  test('le code du serveur (details.code) choisit la phrase ; un inconnu : la generique', () => {
    expect(errorKey({ details: { code: 'FULL' }, message: 'Plus de place.' }))
      .toBe(`${BLOQUE}.full`);
    expect(errorKey({ details: { code: 'TEAMS_ONLY' } })).toBe(`${BLOQUE}.teamsOnly`);
    expect(errorKey('Network Error')).toBe('childEventRegistration.errors.generic');
  });
});
