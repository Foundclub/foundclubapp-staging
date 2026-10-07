/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import {
  gesteDuClub,
  valeurDeMaCollectivite,
} from '@/domains/collectivite/collectiviteRattachement';

// 🏛️ VILLE-INVITER-CLUB, VOIE 3 (07/10/2026) — « collectivité A » d'Adel : la case « Ma
// collectivité » de « Gérer mon club ». Ce que ce témoin exige (ROUGE avant : les deux fonctions
// n'existaient pas) :
//   D1 — la rangée du hub dit, d'un mot, où en est le club : rattaché (le nom de la Ville), une
//        Ville lui propose, sa demande attend, ou « Rechercher » ;
//   D2 — chaque collectivité trouvée propose LE bon geste au dirigeant.

const t = (/** @type {string} */ _cle, /** @type {any} */ defaut, /** @type {any} */ valeurs) => (
  String(defaut).replace(/\{\{(\w+)\}\}/g, (_m, nom) => String(valeurs?.[nom] ?? ''))
);

describe('VINV voie 3 · D1 — la valeur de la rangée « Ma collectivité »', () => {
  it.each([
    [{ attached: { name: 'Ville de Montrivage', type: 'commune' } }, [], 'Ville de Montrivage'],
    [{ attached: null }, [{ canAnswer: true, kind: 'proposal', state: 'pending' }], 'Une Ville te propose'],
    [{ attached: null }, [{ kind: 'attach_request', state: 'pending' }], 'Demande en cours'],
    [{ attached: null }, [{ kind: 'attach_request', state: 'refused' }], 'Rechercher'],
    [{ attached: null }, [], 'Rechercher'],
    [undefined, undefined, 'Rechercher'],
    // La lecture d'un serveur d'avant le lot (ou une doublure) : rien d'inventé.
    [[], [], 'Rechercher'],
  ])('%j + %j ⇒ %s', (ma, demandes, attendu) => {
    expect(valeurDeMaCollectivite(t, ma, demandes)).toBe(attendu);
  });
});

describe('VINV voie 3 · D2 — le geste de chaque collectivité trouvée', () => {
  it.each([
    [{ attached: true }, 'rattache'],
    [{ attachedElsewhere: true }, 'ailleurs'],
    [{ proposal: { state: 'pending' } }, 'aRepondre'],
    [{ request: { state: 'pending' } }, 'envoyee'],
    [{ request: { state: 'refused' } }, 'refusee'],
    [{ proposal: { state: 'refused' } }, 'demander'],
    [{}, 'demander'],
  ])('%j ⇒ %s', (ville, attendu) => {
    expect(gesteDuClub(ville)).toBe(attendu);
  });
});
