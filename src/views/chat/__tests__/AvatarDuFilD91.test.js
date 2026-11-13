import renderer, { act } from 'react-test-renderer';

import AvatarDuFil from '../AvatarDuFil';

// D91 (12/11, chef A) — le fil complexe ↔ client est un tête-à-tête (`whisper`) qui porte le nom
// du complexe (`groupName`) et son côté complexe (`groupAdmins`). Le client y lit « Gérant -
// <complexe> » : la pastille dit donc le COMPLEXE (ses initiales), pas le gérant (« DF »).
// Le gérant, lui, voit toujours la personne du client.

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

const FIL = {
  groupAdmins: [{ documentId: 'gerant' }],
  groupName: 'Five Arena',
  participants: [
    { documentId: 'client', firstname: 'Karim', lastname: 'Haddad' },
    {
      avatar: { url: '/uploads/df.jpg' }, documentId: 'gerant', firstname: 'Dan', lastname: 'Fer',
    },
  ],
  type: 'whisper',
};

/**
 * Rend la pastille d'un fil, vue par `meId`.
 * @param {any} chat
 * @param {string} meId
 * @returns {any}
 */
const rendre = (chat, meId) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AvatarDuFil chat={chat} meId={meId} size={52} />);
  });
  return arbre;
};
const parNom = (/** @type {any} */ arbre, /** @type {string} */ nom) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'function' && n.type.name === nom,
);

describe('AvatarDuFil — D91 fil de complexe', () => {
  test('le client voit les initiales du complexe, pas le gérant', () => {
    const arbre = rendre(FIL, 'client');
    expect(parNom(arbre, 'ProfileAvatar')).toHaveLength(0);
    expect(parNom(arbre, 'ClubLogoMark')[0].props.name).toBe('Five Arena');
  });

  test('le gérant voit toujours le client', () => {
    const [avatar] = parNom(rendre(FIL, 'gerant'), 'ProfileAvatar');
    expect(avatar.props.name).toBe('Karim Haddad');
  });

  test('un tête-à-tête ordinaire (sans côté complexe) garde la personne d en face', () => {
    const ordinaire = { ...FIL, groupAdmins: [], groupName: null };
    const [avatar] = parNom(rendre(ordinaire, 'client'), 'ProfileAvatar');
    expect(avatar.props.name).toBe('Dan Fer');
  });
});
