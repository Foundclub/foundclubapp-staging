import {
  describeMatchStatsEmptyReason,
  MATCH_STATS_EMPTY_REASONS,
  UNKNOWN_EMPTY_REASON,
} from '@/utils/matchStatsEmptyReason';
import {
  clampMatchStatsValue,
  getMatchStatsFieldMax,
  MAX_MATCH_SCORE,
  MAX_MINUTES_PLAYED,
  MAX_STAT_VALUE,
} from '@/utils/matchStatsBounds';

// ---------------------------------------------------------------------------
// SCORE1 — LA MOITIÉ APP DU BILAN DE MATCH
//
// Le serveur est témoigné côté admin (tests/authz/SCORE1-bilan-de-match.test.js).
// Ici on vérifie les deux choses qu'Adel voit à l'écran :
//   H1 — un écran vide DIT pourquoi il est vide ;
//   H6 — la saisie s'arrête EXACTEMENT là où le serveur refuse.
// ---------------------------------------------------------------------------

describe('H1 — un écran vide dit pourquoi il est vide', () => {
  it('le compte SuperAdmin reçoit une explication, pas un écran blanc', () => {
    const explication = describeMatchStatsEmptyReason(MATCH_STATS_EMPTY_REASONS.SUPERADMIN);

    expect(explication.title).toBe('Ton compte ne peut pas saisir ici');
    // 🎯 C'est LA phrase qui manquait à Adel le 26/08 : le serveur ne montre
    // jamais rien à ce compte, exprès, et personne ne le lui disait.
    expect(explication.body).toContain('joueur ou entraîneur');
  });

  it('chacune des 5 causes du serveur a sa phrase, et aucune ne se répète', () => {
    const causes = Object.values(MATCH_STATS_EMPTY_REASONS);
    expect(causes).toHaveLength(5);

    const titres = causes.map((cause) => describeMatchStatsEmptyReason(cause).title);
    expect(new Set(titres).size).toBe(5);

    causes.forEach((cause) => {
      const { body, title } = describeMatchStatsEmptyReason(cause);
      expect(title.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  it('un serveur plus ancien, qui n\'envoie aucune cause, ne produit pas d\'écran blanc', () => {
    // ⛔ Le filet : jamais d'écran vide sans un mot, même en cas de désynchro
    // entre la version de l'app et celle du serveur.
    [undefined, null, '', 'cause_inconnue'].forEach((valeur) => {
      expect(describeMatchStatsEmptyReason(valeur)).toEqual(UNKNOWN_EMPTY_REASON);
    });
  });
});

describe('H6 — la saisie s\'arrête là où le serveur refuse', () => {
  it('les minutes jouées sont bornées, les autres stats gardent leur plafond', () => {
    // 🧨 Avant : `getLineFieldMaxValue` retombait sur 999 pour TOUT — 999 minutes
    // pour un match de 90 étaient publiables.
    expect(getMatchStatsFieldMax('minutesPlayed')).toBe(MAX_MINUTES_PLAYED);
    expect(getMatchStatsFieldMax('rebounds')).toBe(MAX_STAT_VALUE);
    expect(getMatchStatsFieldMax('points')).toBe(MAX_STAT_VALUE);
  });

  it('les trois plafonds valent EXACTEMENT ceux du serveur', () => {
    // ⚠️ Ces nombres sont recopiés dans
    // admin/src/api/match-stats-report/services/match-stats-report.ts.
    // Une valeur différente ici et là-bas = un refus à l'envoi, après avoir
    // rempli tout le formulaire.
    expect(MAX_MINUTES_PLAYED).toBe(240);
    expect(MAX_STAT_VALUE).toBe(999);
    expect(MAX_MATCH_SCORE).toBe(999);
  });

  it('un score délirant ne peut plus être tapé', () => {
    expect(clampMatchStatsValue('999999999', MAX_MATCH_SCORE)).toBe('999');
  });

  it('le signe moins et la virgule ne franchissent pas la saisie', () => {
    // Le serveur les REFUSE désormais au lieu de raboter en silence : l'app ne
    // doit donc jamais lui envoyer ni l'un ni l'autre.
    expect(clampMatchStatsValue('-5', MAX_MATCH_SCORE)).toBe('5');
    expect(clampMatchStatsValue('2,7', MAX_MATCH_SCORE)).toBe('27');
    expect(clampMatchStatsValue('2.7', MAX_MATCH_SCORE)).toBe('27');
  });

  it('un champ vidé reste vide, il ne devient pas 0', () => {
    // Sinon le compteur affiche « 0 » dès qu'on efface pour retaper.
    expect(clampMatchStatsValue('', MAX_STAT_VALUE)).toBe('');
    expect(clampMatchStatsValue(null, MAX_STAT_VALUE)).toBe('');
    expect(clampMatchStatsValue(undefined, MAX_STAT_VALUE)).toBe('');
  });

  it('une valeur normale traverse sans être touchée', () => {
    expect(clampMatchStatsValue('3', MAX_MATCH_SCORE)).toBe('3');
    expect(clampMatchStatsValue('90', MAX_MINUTES_PLAYED)).toBe('90');
    expect(clampMatchStatsValue('241', MAX_MINUTES_PLAYED)).toBe('240');
  });
});
