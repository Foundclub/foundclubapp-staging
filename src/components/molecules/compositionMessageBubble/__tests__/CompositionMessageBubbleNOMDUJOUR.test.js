import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// BULLE (29/09) — la barre Present / Absent tire la couche de services (client
// HTTP). Cette suite ne l affiche jamais (lecteur absent de la carte).
jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

/**
 * FINITIONS13-STATS · POINT 2 — LA CARTE DU FIL APPELLE ENCORE HUGO « PAUL VEUILLET ».
 *
 * 🔬 La carte « Composition publiee » est une PHOTO prise a la publication : sa
 * charge (`snapshotPlayers`, `reservePlayers`) fige le nom de chaque joueur. Le
 * compte 130 s appelait « Paul Veuillet » jusqu au 29/09 ; la carte du match du
 * 3 oct., postee avant, le garde (T11-T13).
 *
 * 🎯 Meme regle que la feuille (FINITIONS12-STATS 5) et que la vue Convocation
 * (FINITIONS13-STATS 2, serveur) : l identite vient du COMPTE quand on l a deja
 * lu. Ici, ce qui est deja lu, ce sont les PARTICIPANTS DU FIL (`chatData`,
 * relus avec le fil) : aucune requete de plus — la regle « bulle A » du 29/09
 * (rien n est demande au serveur pour un lecteur absent de la carte) tient.
 *
 * ✅ Ce filet exige :
 *   · un compte renomme porte, sur la carte, le nom (et la photo) de son compte,
 *     sur le terrain comme sur le banc ;
 *   · un joueur absent du fil (parti, renfort) et un joueur hors app gardent le
 *     nom de la photo : c est la seule trace qu on en a ;
 *   · une personne du fil SANS nom lu n efface pas le nom de la photo ;
 *   · les deux messageries (telephone et site) donnent les participants a la carte.
 */

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: { documentId: 'coach-134' } } }),
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

const HUGO = 'compte-130';
const LINA = 'compte-140';
const PARTI = 'compte-parti';
const HORS_APP = 'manual_1790632633865';

// La photo prise a la publication, AVANT les renommages.
const COMPO = {
  eventDate: '2026-10-03T13:00:00.000Z',
  eventId: 'match-du-03-10',
  eventName: 'Match recette',
  manualPlayers: [{
    documentId: HORS_APP, firstname: 'Gardien', id: HORS_APP, isManual: true, lastname: 'Invite',
  }],
  placements: [],
  publishedVersion: 1,
  reservePlayers: [
    { documentId: LINA, firstname: 'Lina', lastname: 'Durand' },
    { documentId: PARTI, firstname: 'Recette', lastname: 'HorsApp' },
  ],
  schemaVersion: 3,
  snapshotPlayers: [
    { avatar: { url: '/uploads/paul.jpg' }, documentId: HUGO, firstname: 'Paul', lastname: 'Veuillet' },
    { documentId: HORS_APP, firstname: 'Gardien', isManual: true, lastname: 'Invite' },
  ],
  teamId: 'equipe-u15',
  teamName: 'U15',
  teams: [{
    id: 't1',
    name: 'U15',
    placements: [
      { playerId: HUGO, positionX: 50, positionY: 80 },
      { playerId: HORS_APP, positionX: 50, positionY: 95 },
    ],
  }],
  type: 'lineup_share',
};

// Les participants du fil, relus AUJOURD HUI avec le fil.
const PARTICIPANTS = [
  { avatar: { url: '/uploads/hugo.jpg' }, documentId: HUGO, firstname: 'Hugo', lastname: 'Lemaire' },
  { avatar: null, documentId: LINA, firstname: 'Lina', lastname: 'Moreau' },
  { documentId: 'coach-134', firstname: 'Karim', lastname: 'Benali' },
];

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

/**
 * Monte la carte, avec les participants du fil.
 * @param {any[]} [participants] les participants lus avec le fil
 * @returns {any} l arbre
 */
const monter = (participants = PARTICIPANTS) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <CompositionMessageBubble composition={COMPO} currentPeople={participants} />,
    );
  });
  return arbre;
};

const rendu = (/** @type {any} */ arbre) => textes(arbre.toJSON()).join(' | ');

describe('FINITIONS13-STATS 2 — la carte du fil nomme chaque joueur par son COMPTE', () => {
  test('🔴 un compte renomme porte son nom du jour, sur le terrain comme sur le banc', () => {
    const texte = rendu(monter());

    expect(texte).toContain('Hugo Lemaire');
    expect(texte).toContain('Lina Moreau');
    expect(texte).not.toContain('Veuillet');
    expect(texte).not.toContain('Durand');
  });

  test('🔴 et la photo de son compte, pas celle de la publication', () => {
    const arbre = monter();
    const photos = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.type === 'string' && typeof n.props?.source?.uri === 'string'
    )).map((/** @type {any} */ n) => n.props.source.uri);

    expect(photos.some((uri) => uri.includes('/uploads/paul.jpg'))).toBe(false);
  });

  test('🔒 un joueur absent du fil et un joueur hors app gardent le nom de la photo', () => {
    const texte = rendu(monter());

    expect(texte).toContain('Recette HorsApp');
    expect(texte).toContain('Gardien Invite');
  });

  test('🔒 une personne du fil SANS nom lu n efface pas le nom de la photo', () => {
    const texte = rendu(monter([{ documentId: HUGO }]));

    expect(texte).toContain('Paul Veuillet');
  });

  test('🔒 sans participants (fil non encore lu), la carte reste la photo', () => {
    const texte = rendu(monter([]));

    expect(texte).toContain('Paul Veuillet');
    expect(texte).toContain('Lina Durand');
  });

  test('les deux messageries donnent les participants du fil a la carte', () => {
    // Lu dans les sources : la carte est montee a UN endroit par messagerie.
    const vues = path.join(__dirname, '..', '..', '..', '..', 'views');
    ['Conversation.js', 'Conversation.web.js'].forEach((fichier) => {
      const source = fs.readFileSync(path.join(vues, fichier), 'utf8');
      const montages = source.match(/<CompositionMessageBubble[\s\S]*?\/>/g) || [];
      expect(montages.length).toBeGreaterThan(0);
      montages.forEach((montage) => {
        expect(montage).toMatch(/currentPeople=\{chatData\?\.participants\}/);
      });
    });
  });
});
