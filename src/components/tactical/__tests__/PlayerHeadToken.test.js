import { Image, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerHeadToken from '../PlayerHeadToken';

// COMPOMSG — le jeton unique des deux petits terrains (carte du fil et « Tu es
// convoqué »). Ce qu'il promet : la photo quand il y en a une, sous ses trois
// formes serveur ; les initiales sinon ; jamais la photo d'un joueur ajouté à
// la main (il n'a pas de compte, donc pas de photo à lui).

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
    }),
  };
});

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ { player, size }) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerHeadToken player={player} size={size} />);
  });
  montes.push(arbre);
  return arbre;
};

const photo = (/** @type {any} */ arbre) => {
  const images = arbre.root.findAllByType(Image);
  return images.length ? String(images[0].props.source?.uri) : null;
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('PlayerHeadToken — COMPOMSG', () => {
  test.each([
    ['une chaine', '/uploads/a.jpg'],
    ['un objet { url }', { url: '/uploads/a.jpg' }],
    ['une miniature seule', { formats: { thumbnail: { url: '/uploads/a.jpg' } } }],
  ])('🥇 la photo est lue quand l avatar arrive sous forme de %s', (_forme, avatar) => {
    const arbre = rendre({ player: { avatar, firstname: 'Adel', lastname: 'Ferchichi' } });

    expect(photo(arbre)).toContain('/uploads/a.jpg');
  });

  test('🔒 sans photo : les initiales, jamais un rond vide', () => {
    const arbre = rendre({ player: { firstname: 'Amin', lastname: 'Hsino' } });

    expect(photo(arbre)).toBeNull();
    expect(arbre.root.findByType(Text).props.children).toBe('AH');
  });

  test('🔒 un joueur ajouté à la main n affiche JAMAIS de photo', () => {
    const arbre = rendre({
      player: {
        avatar: '/uploads/a.jpg', firstname: 'Jules', id: 'manual_1', isManual: true,
      },
    });

    expect(photo(arbre)).toBeNull();
    expect(arbre.root.findByType(Text).props.children).toBe('J');
  });

  test('le diamètre demandé est tenu', () => {
    const arbre = rendre({ player: { firstname: 'A' }, size: 30 });
    const racine = arbre.toJSON();
    const style = [racine.props.style].flat()
      .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});

    expect(style.width).toBe(30);
    expect(style.height).toBe(30);
  });
});
