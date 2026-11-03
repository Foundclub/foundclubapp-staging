import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Le vrai i18next en français : les libellés viennent de fr.js, pas des replis.
import '@/theme/strings';

import RequestFeedItem from '../RequestFeedItem';

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

// T4-PARENT-RETOURS (03/11/2026, M0091, Adel : « l'heure des notifs doit être visible dans les
// demandes ») — la carte dit quand la demande est arrivée. Seulement quand `createdAt` est bien
// l'heure de la demande : ailleurs, le tri y met la date de l'événement ou du créneau.
const CREEE = new Date(2026, 10, 3, 13, 29);

const carte = (type, extra = {}) => ({
  actions: {},
  createdAt: CREEE.toISOString(),
  id: `${type}-1`,
  meta: { requesterName: 'Yolaine Bard' },
  subtitle: 'Sous-titre',
  title: 'Titre',
  type,
  ...extra,
});
const texte = (item) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<RequestFeedItem item={item} />); });
  return arbre.root.findAllByType(Text).map((noeud) => [].concat(noeud.props.children).join('')).join(' | ');
};

test.each(['interest', 'team', 'club'])('une demande « %s » dit son jour et son heure', (type) => {
  const rendu = texte(carte(type));
  expect(rendu).toContain('Reçue le');
  expect(rendu).toContain('13:29');
});

test.each(['installation', 'teamInvite', 'featured', 'friendly'])('« %s » n invente pas d heure de réception', (type) => {
  expect(texte(carte(type))).not.toContain('Reçue le');
});

test('sans date lisible, la carte ne dit rien', () => {
  expect(texte(carte('interest', { createdAt: null }))).not.toContain('Reçue le');
});
