/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import {
  formatConvocationDay,
  formatConvocationTime,
} from '@/views/playerConvocation/playerConvocationUtils';

import CompositionMessageBubble from '../CompositionMessageBubble';
import CompositionMessageBubbleDuFil from '../CompositionMessageBubbleDuFil';

// La barre Present / Absent tire la couche de services : jamais affichee ici.
jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));

/**
 * FINITIONS16 · POINT 8 (tournee T15, photos F15-6 / F15-6b) — « OUVRIR » MENAIT A UN « AUTRE »
 * MATCH. La carte annonçait « Match vs RECETTE 28-09 A SUPPRIMER · sam. 03/10/2026 · 17:00 » ;
 * « Ouvrir » montrait « Match vs Équipe visiteuse · 15:00 ».
 *
 * 🔬 Lu en base de recette (chef, 06/10) : c'est le MEME match (`grqs5al0…`). Il a ete MODIFIE
 * apres la publication de la composition : adversaire renomme, coup d'envoi avance de 15:00 a
 * 13:00 UTC. La carte est une photo de la publication ; « Ouvrir » lit le match d'aujourd'hui.
 *
 * 🎯 Le message porte DEJA le match d'aujourd'hui (`message.event` : `name`, `date`, peuples par le
 * serveur avec chaque message) : la carte dit son titre et son heure du jour, sans aucune requete
 * de plus (regle « bulle A »). Sans match du jour lisible, elle garde sa photo.
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

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: undefined }),
}));

const MATCH = 'grqs5al0ju4utkhbudexr87w';

// La photo prise a la publication (version 3, lue en base de recette).
const COMPO = {
  eventDate: '2026-10-03T15:00:00.000Z',
  eventDisplayName: 'Match vs RECETTE 28-09 A SUPPRIMER',
  eventId: MATCH,
  eventName: 'Match recette sans convocation',
  placements: [],
  publishedVersion: 3,
  schemaVersion: 3,
  snapshotPlayers: [],
  teamId: 'xpzuyxb64l0mujluirrmq69l',
  teamName: 'U15',
  teams: [{ id: 'team_1', name: 'U15', placements: [] }],
  type: 'lineup_share',
};

// Le match tel que le serveur le joint au message aujourd'hui.
const MATCH_DU_JOUR = {
  date: '2026-10-03T13:00:00.000Z',
  documentId: MATCH,
  name: 'Match vs Équipe visiteuse',
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

const rendu = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  const texte = textes(arbre.toJSON()).join(' | ');
  act(() => { arbre.unmount(); });
  return texte;
};

const quandDuJour = `${formatConvocationDay(MATCH_DU_JOUR.date)} · ${formatConvocationTime(MATCH_DU_JOUR.date)}`;
const quandDeLaPhoto = `${formatConvocationDay(COMPO.eventDate)} · ${formatConvocationTime(COMPO.eventDate)}`;

describe('FINITIONS16 8 — la carte dit le match d aujourd hui, celui qu « Ouvrir » montre', () => {
  test('🔴 le titre du jour, pas celui de la photo', () => {
    const texte = rendu(<CompositionMessageBubble composition={COMPO} currentEvent={MATCH_DU_JOUR} />);

    expect(texte).toContain('Match vs Équipe visiteuse');
    expect(texte).not.toContain('RECETTE 28-09');
  });

  test('🔴 le jour et l heure du jour, pas ceux de la photo', () => {
    const texte = rendu(<CompositionMessageBubble composition={COMPO} currentEvent={MATCH_DU_JOUR} />);

    expect(texte).toContain(quandDuJour);
    expect(texte).not.toContain(quandDeLaPhoto);
  });

  test('🔴 la carte du fil transmet le match du message', () => {
    const texte = rendu(
      <CompositionMessageBubbleDuFil chatId="fil-80" composition={COMPO} currentEvent={MATCH_DU_JOUR} />,
    );

    expect(texte).toContain('Match vs Équipe visiteuse');
  });

  test('🔴 les deux messageries donnent le match du message a la carte', () => {
    const vues = path.join(__dirname, '..', '..', '..', '..', 'views');
    ['Conversation.js', 'Conversation.web.js'].forEach((fichier) => {
      const source = fs.readFileSync(path.join(vues, fichier), 'utf8');
      const montages = source.match(/<CompositionMessageBubbleDuFil[\s\S]*?\/>/g) || [];
      expect(montages.length).toBeGreaterThan(0);
      montages.forEach((montage) => expect(montage).toMatch(/currentEvent=\{/));
    });
  });

  test('🔒 sans match du jour, la carte garde sa photo', () => {
    const texte = rendu(<CompositionMessageBubble composition={COMPO} />);

    expect(texte).toContain('Match vs RECETTE 28-09 A SUPPRIMER');
    expect(texte).toContain(quandDeLaPhoto);
  });

  test('🔒 un match du jour SANS nom garde le titre de la photo (son heure du jour, oui)', () => {
    const texte = rendu(
      <CompositionMessageBubble composition={COMPO} currentEvent={{ ...MATCH_DU_JOUR, name: '' }} />,
    );

    expect(texte).toContain('Match vs RECETTE 28-09 A SUPPRIMER');
    expect(texte).toContain(quandDuJour);
  });

  test('🔒 le match d un AUTRE evenement n est jamais lu', () => {
    const texte = rendu(
      <CompositionMessageBubble
        composition={COMPO}
        currentEvent={{ ...MATCH_DU_JOUR, documentId: 'un-autre-match' }}
      />,
    );

    expect(texte).toContain('Match vs RECETTE 28-09 A SUPPRIMER');
    expect(texte).not.toContain('Équipe visiteuse');
  });
});
