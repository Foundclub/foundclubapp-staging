import renderer, { act } from 'react-test-renderer';

import AvatarDuFil from '../AvatarDuFil';

// MSG1BA (§3.13) — LA PHOTO DE GROUPE. Le serveur 1B pose `groupPhoto: { url } | null` sur
// chaque groupe, dans la liste (avatar 52) et le detail (en-tete 38). Avec une photo, on la
// montre en rond ; sans photo (ou serveur d'avant, sans la clef), l'ecusson aux initiales.

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMark() {
  return null;
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatar() {
  return null;
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/views/collectivite/components/BlocDeLaVille', () => ({ EcussonVille: () => null }));
jest.mock('@/views/collectivite/components/FilDeLaVille', () => ({ IconeDuCanal: () => null }));

/**
 * Rend l'avatar d'un fil.
 * @param {any} chat
 * @param {number} [size]
 * @returns {any}
 */
const rendre = (chat, size = 52) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AvatarDuFil chat={chat} meId="moi" size={size} />);
  });
  return arbre;
};

/**
 * Le composant double rendu, par son nom.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any[]}
 */
const parNom = (arbre, nom) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'function' && n.type.name === nom,
);

describe('AvatarDuFil — §3.13 photo de groupe', () => {
  test('AP1 — un groupe AVEC photo : la photo, en rond, a la taille demandee', () => {
    const arbre = rendre({
      groupName: 'Covoit',
      groupPhoto: { url: '/uploads/g.jpg' },
      type: 'group',
    });
    const [photo] = parNom(arbre, 'ProfileAvatar');
    expect(photo.props.imageUrl).toBe('/uploads/g.jpg');
    expect(photo.props.size).toBe(52);
    expect(parNom(arbre, 'ClubLogoMark')).toHaveLength(0);
  });

  test('AP2 — sans photo (`null`) ou serveur d avant (pas de clef) : l ecusson', () => {
    [
      { groupName: 'Covoit', groupPhoto: null, type: 'group' },
      { groupName: 'Covoit', type: 'group' },
      { groupName: 'Covoit', groupPhoto: { url: '' }, type: 'group' },
    ].forEach((chat) => {
      const arbre = rendre(chat, 38);
      expect(parNom(arbre, 'ProfileAvatar')).toHaveLength(0);
      expect(parNom(arbre, 'ClubLogoMark')[0].props.name).toBe('Covoit');
    });
  });

  test('AP3 — un tete-a-tete ne lit pas `groupPhoto` : la photo de la personne', () => {
    const arbre = rendre({
      groupPhoto: { url: '/uploads/g.jpg' },
      participants: [
        { documentId: 'moi' },
        { avatar: { url: '/uploads/karim.jpg' }, documentId: 'karim', firstname: 'Karim' },
      ],
      type: 'whisper',
    });
    expect(parNom(arbre, 'ProfileAvatar')[0].props.imageUrl).toBe('/uploads/karim.jpg');
  });
});
