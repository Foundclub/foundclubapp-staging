import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';

// ═══════════════════════════════════════════════════════════════════════════
// S10-B D5 — LE BROUILLON WEB QUI SURVIT AU LOT
//
// 🧊 Le tunnel se persiste dans `sessionStorage` (`fc:web:event-wizard`) a
// chaque changement d'etat. Un brouillon commence AVANT S10-B est donc relu
// APRES : il peut ne pas porter les champs que les deux sections d'invitation
// parcourent desormais depuis deux ecrans differents.
//
// 🧨 CE QUE `{ ...initialState, ...parsed }` NE COUVRE PAS. Le champ ABSENT est
// bien remplace par sa valeur de depart. Le champ PRESENT MAIS ABIME — `null`,
// un objet, un nombre — ECRASE la valeur de depart, et le premier `.map` du
// tunnel jette. L'organisateur voit un ecran blanc, et son brouillon est perdu.
//
// ⚠️ Et `sessionStorage` vit cote NAVIGATEUR : son contenu se modifie a la main
// dans la console. Ce n'est donc pas seulement de la compatibilite entre
// versions, c'est une frontiere de confiance.
// ═══════════════════════════════════════════════════════════════════════════

const CLE = 'fc:web:event-wizard';

/** Ce que la doublure de `sessionStorage` sert. */
const mockStockage = { valeur: /** @type {string | null} */ (null) };

/** L'etat du tunnel, relu apres le montage. */
let etatRestaure = /** @type {any} */ ({});

/**
 * Sonde sans rendu : elle expose l'etat du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  etatRestaure = useEventWizard().state;
  return null;
}

/**
 * Ecrit un brouillon dans le stockage, puis monte le tunnel dessus.
 * @param {any} brouillon Ce que le stockage contient (deja au format objet).
 * @returns {() => void} De quoi demonter l'arbre.
 */
const monterSurLeBrouillon = (brouillon) => {
  mockStockage.valeur = typeof brouillon === 'string' ? brouillon : JSON.stringify(brouillon);

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(PriseDeCourant),
    ));
  });
  return () => act(() => arbre.unmount());
};

/** Le `window` d'origine du bac a sable, a rendre en partant. */
let fenetreDOrigine;
/** Vrai quand c'est CE fichier qui a fabrique `window`. */
let fenetreFabriquee = false;

beforeAll(() => {
  // Le tunnel ne se persiste que si `window.sessionStorage` existe : on lui en
  // donne un, qui sert ce que le temoin courant a pose.
  const faux = {
    getItem: (/** @type {string} */ cle) => (cle === CLE ? mockStockage.valeur : null),
    removeItem: () => {},
    setItem: () => {},
  };
  if (typeof global.window === 'undefined') {
    fenetreFabriquee = true;
    // @ts-expect-error — on fabrique le minimum dont le tunnel a besoin.
    global.window = { sessionStorage: faux };
    return;
  }
  fenetreDOrigine = global.window.sessionStorage;
  Object.defineProperty(global.window, 'sessionStorage', { value: faux, writable: true });
});

// 🧨 ON REND LE BAC A SABLE COMME ON L'A TROUVE. `--runInBand` fait tourner
// TOUTES les suites dans le MEME processus : un `global.window` laisse derriere
// soi ferait croire aux suites suivantes qu'elles tournent sur le WEB, et
// chacune prendrait l'autre branche de ses `Platform`/`typeof window`. C'est
// exactement le motif « deux lots verts, une recolte rouge ».
afterAll(() => {
  if (fenetreFabriquee) {
    // @ts-expect-error — on retire ce qu'on avait ajoute.
    delete global.window;
    return;
  }
  Object.defineProperty(global.window, 'sessionStorage', {
    value: fenetreDOrigine,
    writable: true,
  });
});

beforeEach(() => {
  mockStockage.valeur = null;
  etatRestaure = {};
});

describe('S10-B D5 — un vieux brouillon ne fait pas planter le tunnel', () => {
  test('temoin 15 — un brouillon SANS les champs d invitation part avec des listes vides', () => {
    // Le cas nominal du lot : un brouillon d'une version qui ne connaissait pas
    // encore `teamAudiences` ni `matchCallUpPlayerIds`.
    const demonter = monterSurLeBrouillon({
      description: 'Un brouillon commence avant le lot',
      type: { documentId: 'type-match', name: 'Match' },
    });

    expect(etatRestaure.teamAudiences).toEqual([]);
    expect(etatRestaure.invitedTeams).toEqual([]);
    expect(etatRestaure.matchCallUpPlayerIds).toEqual([]);
    // Et ce que le brouillon PORTAIT est bien restaure : la garde repare, elle
    // n'efface pas.
    expect(etatRestaure.description).toBe('Un brouillon commence avant le lot');

    demonter();
  });

  test('temoin 16 🔒 — un champ ABIME ne remplace pas la liste : c est lui qui cede', () => {
    // 🧨 Le vrai piege. `{ ...initial, ...parsed }` laisse passer `null`, et le
    // premier `.map` du tunnel jette. Sans cette garde, l'ecran est blanc.
    const demonter = monterSurLeBrouillon({
      invitedTeams: 'equipe-2',
      matchCallUpPlayerIds: { 0: 'j1' },
      teamAudiences: null,
    });

    expect(etatRestaure.teamAudiences).toEqual([]);
    expect(etatRestaure.invitedTeams).toEqual([]);
    expect(etatRestaure.matchCallUpPlayerIds).toEqual([]);

    demonter();
  });

  test('temoin 17 — un brouillon SAIN traverse le lot sans rien perdre', () => {
    const audienceInterne = {
      audienceKind: 'internal_invited',
      selectedMembers: ['j10'],
      selectionMode: 'SELECTED_MEMBERS',
      status: 'ACCEPTED',
      team: { documentId: 'equipe-2', name: 'U17 B' },
    };
    const audienceExterne = {
      audienceKind: 'external_invited',
      selectedMembers: [],
      selectionMode: 'ALL_MEMBERS',
      status: 'PENDING',
      team: { documentId: 'eq-voisin-1', name: 'Voisine U17' },
    };

    const demonter = monterSurLeBrouillon({
      invitedTeams: ['equipe-2'],
      matchCallUpPlayerIds: ['j1', 'j3'],
      teamAudiences: [audienceInterne, audienceExterne],
    });

    expect(etatRestaure.teamAudiences).toEqual([audienceInterne, audienceExterne]);
    expect(etatRestaure.invitedTeams).toEqual(['equipe-2']);
    expect(etatRestaure.matchCallUpPlayerIds).toEqual(['j1', 'j3']);

    demonter();
  });

  test('temoin 18 🔒 — une invitation SANS equipe est jetee, pas affichee', () => {
    // Elle rendrait une carte sans nom a l ecran, et partirait au serveur comme
    // une invitation qui ne designe personne.
    const bonne = {
      audienceKind: 'internal_invited',
      status: 'ACCEPTED',
      team: { documentId: 'equipe-2', name: 'U17 B' },
    };

    const demonter = monterSurLeBrouillon({
      teamAudiences: [
        bonne,
        { audienceKind: 'internal_invited', status: 'ACCEPTED', team: null },
        { audienceKind: 'external_invited', status: 'PENDING' },
        null,
      ],
    });

    expect(etatRestaure.teamAudiences).toEqual([bonne]);

    demonter();
  });

  test('temoin 19 — un stockage illisible rend un tunnel NEUF, jamais une erreur', () => {
    const demonter = monterSurLeBrouillon('{ ceci n est pas du JSON');

    expect(etatRestaure.teamAudiences).toEqual([]);
    expect(etatRestaure.type).toBeNull();

    demonter();
  });
});
