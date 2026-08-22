import { aggregateRemindReports } from './aggregateRemindReports';
import { buildRemindMessage } from './remindReport';

// ==========================================================================
// N4 (D3) — RELANCER PLUSIEURS EQUIPES SANS MENTIR SUR LE RESULTAT.
//
// Le serveur n accepte qu UN `teamId` par appel. Deux equipes cochees = deux
// POST, donc deux comptes rendus, et UNE SEULE phrase a afficher.
//
// Ce qui se verifie ici est le CONTRAT DE REUNION, pas un rendu :
//   · les nombres affiches sont ceux du serveur, additionnes ;
//   · `nextReminderAt` est la date la PLUS TARDIVE — annoncer la plus proche
//     promettrait une relance complete qui n aurait pas lieu ;
//   · la ventilation garde une ligne PAR EQUIPE APPELEE, y compris celle qui
//     n a relance personne ;
//   · le resultat se traduit par `buildRemindMessage` SANS ADAPTATION, ce qui
//     est la raison d etre de la forme choisie.
// ==========================================================================

const rapport = (/** @type {any} */ champs = {}) => ({
  blockedCount: 0,
  lastRemindedAt: null,
  nextReminderAt: null,
  recipients: [],
  remindedCount: 0,
  unansweredCount: 0,
  ...champs,
});

describe('N4/D3 — les sommes viennent du SERVEUR', () => {
  test('deux equipes : les compteurs s additionnent', () => {
    const reuni = aggregateRemindReports([
      {
        report: rapport({ blockedCount: 1, remindedCount: 3, unansweredCount: 4 }),
        teamId: 'equipe-a',
        teamName: 'U15 A',
      },
      {
        report: rapport({ blockedCount: 2, remindedCount: 5, unansweredCount: 7 }),
        teamId: 'equipe-b',
        teamName: 'U15 B',
      },
    ]);

    expect(reuni.remindedCount).toBe(8);
    expect(reuni.blockedCount).toBe(3);
    expect(reuni.unansweredCount).toBe(11);
  });

  test('les destinataires se mettent bout a bout', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ recipients: ['a', 'b'] }), teamId: 'equipe-a' },
      { report: rapport({ recipients: ['c'] }), teamId: 'equipe-b' },
    ]);

    expect(reuni.recipients).toEqual(['a', 'b', 'c']);
  });

  test('une liste vide ne rend pas `undefined` : elle rend des zeros', () => {
    const reuni = aggregateRemindReports([]);

    expect(reuni.remindedCount).toBe(0);
    expect(reuni.blockedCount).toBe(0);
    expect(reuni.recipients).toEqual([]);
    expect(reuni.parEquipe).toEqual([]);
    expect(reuni.echecCount).toBe(0);
    expect(reuni.nextReminderAt).toBeNull();
  });
});

describe('N4/D3 — la prochaine relance est la PLUS TARDIVE', () => {
  test('entre 10 h et 12 h, la reunion retient 12 h', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ nextReminderAt: '2026-08-25T10:00:00.000Z' }), teamId: 'a' },
      { report: rapport({ nextReminderAt: '2026-08-25T12:00:00.000Z' }), teamId: 'b' },
    ]);

    expect(reuni.nextReminderAt).toBe('2026-08-25T12:00:00.000Z');
  });

  test("l ordre d arrivee ne change rien : 12 h gagne aussi quand elle vient d abord", () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ nextReminderAt: '2026-08-25T12:00:00.000Z' }), teamId: 'b' },
      { report: rapport({ nextReminderAt: '2026-08-25T10:00:00.000Z' }), teamId: 'a' },
    ]);

    expect(reuni.nextReminderAt).toBe('2026-08-25T12:00:00.000Z');
  });

  test('une equipe sans date n efface pas celle de l autre', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ nextReminderAt: '2026-08-25T12:00:00.000Z' }), teamId: 'a' },
      { report: rapport({ nextReminderAt: null }), teamId: 'b' },
    ]);

    expect(reuni.nextReminderAt).toBe('2026-08-25T12:00:00.000Z');
  });

  test('`lastRemindedAt` retient elle aussi la plus recente', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ lastRemindedAt: '2026-08-20T08:00:00.000Z' }), teamId: 'a' },
      { report: rapport({ lastRemindedAt: '2026-08-22T08:00:00.000Z' }), teamId: 'b' },
    ]);

    expect(reuni.lastRemindedAt).toBe('2026-08-22T08:00:00.000Z');
  });
});

describe('N4/D3 — la ventilation n oublie aucune equipe appelee', () => {
  test('chaque equipe garde sa ligne, avec son nom et ses chiffres', () => {
    const reuni = aggregateRemindReports([
      {
        report: rapport({ blockedCount: 1, remindedCount: 3, unansweredCount: 4 }),
        teamId: 'equipe-a',
        teamName: 'U15 A',
      },
      {
        report: rapport({ blockedCount: 2, remindedCount: 0, unansweredCount: 2 }),
        teamId: 'equipe-b',
        teamName: 'U15 B',
      },
    ]);

    expect(reuni.parEquipe).toEqual([
      {
        blockedCount: 1,
        echec: false,
        remindedCount: 3,
        teamId: 'equipe-a',
        teamName: 'U15 A',
        unansweredCount: 4,
      },
      {
        blockedCount: 2,
        echec: false,
        remindedCount: 0,
        teamId: 'equipe-b',
        teamName: 'U15 B',
        unansweredCount: 2,
      },
    ]);
  });

  test('🚨 une equipe dont le serveur n a RIEN rendu reste visible, a zero', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ remindedCount: 3 }), teamId: 'equipe-a', teamName: 'U15 A' },
      { report: null, teamId: 'equipe-b', teamName: 'U15 B' },
    ]);

    expect(reuni.parEquipe).toHaveLength(2);
    expect(reuni.parEquipe[1]).toEqual({
      blockedCount: 0,
      echec: false,
      remindedCount: 0,
      teamId: 'equipe-b',
      teamName: 'U15 B',
      unansweredCount: 0,
    });
  });
});

describe('N4/D3 — 🚨 un echec PARTIEL se dit, il ne se noie pas', () => {
  test('la 2e equipe en echec ne fait pas mentir la 1re : 3 relances tiennent', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ remindedCount: 3 }), teamId: 'equipe-a', teamName: 'U15 A' },
      { echec: true, report: null, teamId: 'equipe-b', teamName: 'U15 B' },
    ]);

    expect(reuni.remindedCount).toBe(3);
    expect(reuni.echecCount).toBe(1);
    expect(reuni.parEquipe[0].echec).toBe(false);
    expect(reuni.parEquipe[1].echec).toBe(true);
  });

  test('sans echec, le compteur reste a zero', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ remindedCount: 3 }), teamId: 'a' },
      { report: rapport({ remindedCount: 1 }), teamId: 'b' },
    ]);

    expect(reuni.echecCount).toBe(0);
  });
});

describe('N4/D3 — le resultat se traduit SANS ADAPTATION', () => {
  test('8 relances sur deux equipes se disent « 8 personnes relancees »', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ remindedCount: 3 }), teamId: 'a' },
      { report: rapport({ remindedCount: 5 }), teamId: 'b' },
    ]);

    expect(buildRemindMessage(reuni).title).toBe('8 personnes relancees');
    expect(buildRemindMessage(reuni).outcome).toBe('sent');
  });

  test('🚨 deux equipes entierement bloquees ne disent JAMAIS « envoye »', () => {
    const reuni = aggregateRemindReports([
      { report: rapport({ blockedCount: 2 }), teamId: 'a' },
      { report: rapport({ blockedCount: 3 }), teamId: 'b' },
    ]);
    const message = buildRemindMessage(reuni);

    expect(message.outcome).toBe('blocked');
    expect(message.title).toBe('Personne n a ete relance');
    expect(`${message.title} ${message.description}`).not.toContain('envoye');
  });
});
