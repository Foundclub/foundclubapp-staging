import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

/**
 * R6 (c) — LA CARTE DU TCHAT NOMME ENFIN LES CONVOQUES.
 *
 * 🗣️ Constat de recette 2.6.26 (24/08) : « la liste des convoques doit se voir
 * dans le groupe de messages de l equipe apres publication ».
 *
 * 🧨 Mesure : la bulle EXISTE et part deja toute seule a la publication
 * (`publishLineupShareToTeamChat`), et sa charge PORTE DEJA LES NOMS —
 * `snapshotPlayers`, `teams[].placements`, `reservePlayers`. Elle n en montrait
 * que le mini-terrain et un compteur : « 11 joueurs ». Onze QUI ?
 * ⇒ Zero changement serveur dans ce lot : la donnee etait la, personne ne
 * l ecrivait.
 *
 * ♻️ Les noms passent par `getPersonName` / `buildConvocationFieldTokens`, les
 * memes que la page d evenement et l ecran du joueur convoque. Une seconde
 * recette du nom divergerait des la premiere charge sans `lastname`.
 *
 * ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest ne met rien en page. Une carte de
 * 250 pt de large qui porte 11 noms se juge a la recette, pas ici.
 */

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: { documentId: 'personne-1' } } }),
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
      Spaces,
    }),
  };
});

const TITULAIRE = 'joueur-1';
const REMPLACANT = 'joueur-2';

// La charge telle que le serveur la poste : `schemaVersion: 3`, les placements
// dans `teams[]`, et `reservePlayers` DEJA resolus en personnes
// (`event-composition.ts` — `reserveSnapshotPlayers`).
const COMPO = {
  eventAddress: 'Stade Georges Ricard, 13710 Fuveau',
  eventDate: '2026-08-24T18:30:00.000Z',
  eventId: 'evt-1',
  eventName: 'US Fuveau - AS Gardanne',
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  schemaVersion: 3,
  snapshotPlayers: [{ documentId: TITULAIRE, firstname: 'Karim', lastname: 'Sylla' }],
  teamName: 'U15 A',
  teams: [{
    id: 't1',
    name: 'U15 A',
    placements: [{ playerId: TITULAIRE, positionX: 50, positionY: 90 }],
  }],
  type: 'lineup_share',
};

const textes = (/** @type {any} */ noeud, /** @type {any[]} */ acc = []) => {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return acc;
  if (typeof noeud === 'string' || typeof noeud === 'number') {
    acc.push(String(noeud));
    return acc;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((/** @type {any} */ enfant) => textes(enfant, acc));
    return acc;
  }
  textes(noeud.children, acc);
  return acc;
};

const rendre = (/** @type {any} */ composition) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} />);
  });
  return textes(arbre.toJSON()).join(' | ');
};

describe('R6 · (c) la bulle du tchat LISTE les convoques', () => {
  test('🥇 les titulaires et le banc sont NOMMES sous le mini-terrain', () => {
    const rendu = rendre(COMPO);

    expect(rendu).toContain('Karim Sylla');
    expect(rendu).toContain('Leo Diarra');
  });

  test('le terrain et le banc sont dits SEPAREMENT', () => {
    // Memes mots que l onglet « Convocation » de la page d evenement : c est la
    // meme information, lue a deux endroits — deux vocabulaires pour une seule
    // chose obligeraient le lecteur a refaire le rapprochement.
    const rendu = rendre(COMPO);

    expect(rendu).toContain('Sur le terrain');
    expect(rendu).toContain('Sur le banc');
  });

  test('🔒 sans remplacant, AUCUN titre de banc — un titre suivi de rien est un bug', () => {
    const rendu = rendre({ ...COMPO, reservePlayers: [] });

    expect(rendu).toContain('Sur le terrain');
    expect(rendu).not.toContain('Sur le banc');
  });

  test('🔒 une compo VIDE n ecrit aucun titre', () => {
    // Le cas d une carte partagee sans personne placee. Elle garde son terrain
    // et son contexte ; elle n annonce pas des sections creuses.
    const rendu = rendre({
      ...COMPO,
      reservePlayers: [],
      snapshotPlayers: [],
      teams: [{ id: 't1', name: 'U15 A', placements: [] }],
    });

    expect(rendu).not.toContain('Sur le terrain');
    expect(rendu).not.toContain('Sur le banc');
    // ⛔ Contre-epreuve : la carte n est pas vide pour autant.
    expect(rendu).toContain('US Fuveau - AS Gardanne');
  });

  test('🧨 un pack a plusieurs equipes DIT ce que la liste ne montre pas', () => {
    // Le mini-terrain n a jamais dessine que `teams[0]` — c est un apercu, et il
    // le reste. Mais une liste qui s arreterait la SANS RIEN DIRE ferait croire
    // a un lecteur qu il a vu tout le monde. La carte compte ce qui manque.
    const rendu = rendre({
      ...COMPO,
      teams: [
        ...COMPO.teams,
        {
          id: 't2',
          name: 'U15 B',
          placements: [{ playerId: 'joueur-3', positionX: 50, positionY: 40 }],
        },
      ],
    });

    expect(rendu).toContain('Karim Sylla');
    expect(rendu).toContain('1 autre équipe');
  });

  test('🔒 un nom incomplet ne rend jamais « undefined »', () => {
    // `getPersonName` filtre les vides. Sans lui, un joueur sans `lastname`
    // afficherait « Karim undefined » dans le tchat de toute l equipe.
    const rendu = rendre({
      ...COMPO,
      snapshotPlayers: [{ documentId: TITULAIRE, firstname: 'Karim' }],
    });

    expect(rendu).toContain('Karim');
    expect(rendu).not.toContain('undefined');
  });
});
