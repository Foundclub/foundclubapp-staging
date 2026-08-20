import { resolveExternalMatchDisplay } from '@/utils/externalMatchDisplay';

import {
  isMatchTypeName,
  normalizeOpponentName,
  resolveEventDisplayName,
  resolveEventOpponentName,
} from './eventDisplayName';

// Y02 (E6) — UN MATCH PORTE LE NOM DE SON ADVERSAIRE, cote app.
//
// Idee d'Adel du 2026-08-19 : « Match vs (nom de l'equipe adverse) ».
//
// Les six temoins du lot vivent ici pour la partie app. Le jumeau serveur, qui
// tient la meme regle sur `event.name`, est
// `admin/tests/authz/event-opponent-name.test.js` — les deux doivent dire la
// MEME chose, c'est ce que le temoin 5 verifie.

const TYPE_MATCH = { name: 'Match' };
const TYPE_ENTRAINEMENT = { name: 'Entraînement' };
const EQUIPE_U15 = { documentId: 'team-u15', name: 'U15' };

// -- 1. Le temoin principal --------------------------------------------------
describe('Y02/1 — un match avec adversaire connu s appelle « Match vs X »', () => {
  test('depuis le champ saisi au tunnel', () => {
    expect(resolveEventDisplayName({
      opponentName: 'US Blaisoise',
      team: EQUIPE_U15,
      type: TYPE_MATCH,
    })).toBe('Match vs US Blaisoise');
  });

  test('le vrai nom du type est garde, pas une constante « Match »', () => {
    expect(resolveEventDisplayName({
      opponentName: 'US Blaisoise',
      type: { name: 'Match amical' },
    })).toBe('Match amical vs US Blaisoise');
  });
});

// -- 2. Jamais un « vs » orphelin --------------------------------------------
describe('Y02/2 — un match SANS adversaire garde son nom d aujourd hui', () => {
  test('le nom en base est rendu tel quel', () => {
    expect(resolveEventDisplayName({
      name: 'Match - 12/09/2026 - U15',
      team: EQUIPE_U15,
      type: TYPE_MATCH,
    })).toBe('Match - 12/09/2026 - U15');
  });

  test('aucun « vs » n apparait jamais sans nom derriere', () => {
    const sansRien = resolveEventDisplayName({ type: TYPE_MATCH });
    expect(sansRien).toBe('Match');
    expect(sansRien).not.toMatch(/\bvs\b/i);
  });

  test('« Adversaire » et ses cousins ne nomment personne', () => {
    ['Adversaire', 'adversaire', 'À définir', 'inconnu', 'TBD', '   ']
      .forEach((valeur) => {
        expect(normalizeOpponentName(valeur)).toBe('');
        expect(resolveEventDisplayName({ opponentName: valeur, type: TYPE_MATCH }))
          .not.toMatch(/\bvs\b/i);
      });
  });
});

// -- 3. Le champ passe devant, les entites suivent ---------------------------
describe('Y02/3 — l ordre des sources est stable', () => {
  test('le champ saisi gagne sur l equipe invitee', () => {
    expect(resolveEventOpponentName({
      invitedTeams: [{ documentId: 'team-x', name: 'AS Foot' }],
      opponentName: 'US Blaisoise',
      team: EQUIPE_U15,
    })).toBe('US Blaisoise');
  });

  test('sans champ, l equipe invitee prend le relais — et jamais la notre', () => {
    expect(resolveEventOpponentName({
      invitedTeams: [EQUIPE_U15, { documentId: 'team-x', name: 'AS Foot' }],
      team: EQUIPE_U15,
    })).toBe('AS Foot');
  });

  test('sans champ ni invitation, le match de League donne le camp d en face', () => {
    expect(resolveEventOpponentName({
      league_match: { team_a: { name: 'U15' }, team_b: { name: 'FC Lyon' } },
      team: EQUIPE_U15,
    })).toBe('FC Lyon');
  });

  test('un evenement sans aucune source rend une chaine vide', () => {
    expect(resolveEventOpponentName({ team: EQUIPE_U15 })).toBe('');
    expect(resolveEventOpponentName(undefined)).toBe('');
  });
});

// -- 4. Le calendrier importe ------------------------------------------------
describe('Y02/4 — un match importe d un calendrier a deja son adversaire', () => {
  test('le champ ecrit par la synchro federale suffit', () => {
    expect(resolveExternalMatchDisplay({
      opponentName: 'AS Saint-Priest',
      team: EQUIPE_U15,
      type: TYPE_MATCH,
    })).toEqual({ contextLabel: '', title: 'VS AS Saint-Priest' });
  });

  test('le domicile / exterieur de la description est conserve', () => {
    expect(resolveExternalMatchDisplay({
      description: 'Match externe synchronisé (FFF) - Domicile - VS AS Saint-Priest',
      opponentName: 'AS Saint-Priest',
    })).toEqual({ contextLabel: 'Domicile', title: 'VS AS Saint-Priest' });
  });

  test('l ancien parc, lui, continue de passer par la description', () => {
    // Aucun champ `opponentName` : c'est le chemin d'avant Y02, il ne bouge pas.
    expect(resolveExternalMatchDisplay({
      description: 'Match externe synchronisé (FFF) - Exterieur - VS FC Lyon',
    })).toEqual({ contextLabel: 'Exterieur', title: 'VS FC Lyon' });
  });
});

// -- 5. Le meme nom des deux cotes -------------------------------------------
describe('Y02/5 — la convocation porte le meme nom que la fiche', () => {
  test('app et serveur produisent la MEME chaine', () => {
    const evenement = {
      // Ce que le serveur a ecrit dans `event.name` (lifecycles.ts, meme regle).
      name: 'Match vs US Blaisoise',
      opponentName: 'US Blaisoise',
      team: EQUIPE_U15,
      type: TYPE_MATCH,
    };

    // La fiche (`compositionEventLabel`) et la convocation lisent toutes deux
    // ce nom-la : il n'existe qu'UNE regle de nommage dans le projet.
    expect(resolveEventDisplayName(evenement)).toBe(evenement.name);
  });
});

// -- 6. NON-REGRESSION -------------------------------------------------------
describe('Y02/6 — les autres types d evenement n ont pas change de nom', () => {
  test('un entrainement garde exactement son nom, adversaire ou pas', () => {
    expect(resolveEventDisplayName({
      name: 'Entraînement - 12/09/2026 - U15',
      opponentName: 'US Blaisoise',
      type: TYPE_ENTRAINEMENT,
    })).toBe('Entraînement - 12/09/2026 - U15');
  });

  test('la regle « est-ce un match » ne deborde sur aucun autre type', () => {
    expect(isMatchTypeName('Match')).toBe(true);
    expect(isMatchTypeName('Match amical')).toBe(true);
    ['Entraînement', 'Stage', 'Tournoi', 'Détection', 'Réservation', 'Autre', '']
      .forEach((type) => expect(isMatchTypeName(type)).toBe(false));
  });

  test('un evenement sans rien du tout garde son mot de repli', () => {
    expect(resolveEventDisplayName({})).toBe('Evenement');
    expect(resolveEventDisplayName({}, 'Événement')).toBe('Événement');
  });
});
