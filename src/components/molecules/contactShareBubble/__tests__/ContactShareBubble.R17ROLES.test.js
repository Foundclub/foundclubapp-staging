import renderer, { act } from 'react-test-renderer';

import ContactShareBubble from '../ContactShareBubble';

// R17-ROLES (REC17-006, 19/10) — la carte « Contact partagé » d'une conversation
// (téléphone ET site) affichait le nom technique du rôle, tel que l'envoyeur l'a lu sur le
// serveur : « Entraineur », sans accent. Elle passe désormais par la table commune
// (`libelleDuRole`) : « Coach / Prof ». Les cartes DÉJÀ envoyées (le nom brut est enregistré
// dans le message) sont traduites à l'affichage ; un nom hors de la table (« SuperAdmin »)
// reste tel quel.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: jest.requireActual('i18next').t }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: generateFonts(Colors) }),
  };
});

/**
 * Les textes affichés par la carte.
 * @param {any} composition
 * @returns {string[]}
 */
const textesDe = (composition) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ContactShareBubble composition={composition} />);
  });
  const textes = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === 'Text')
    .flatMap((/** @type {any} */ noeud) => [].concat(noeud.props.children))
    .filter((/** @type {any} */ morceau) => typeof morceau === 'string');
  act(() => arbre.unmount());
  return textes;
};

describe('ContactShareBubble · le rôle du contact (R17-ROLES)', () => {
  it('« Entraineur » (nom du serveur) se lit « Coach / Prof »', () => {
    const textes = textesDe({ firstname: 'Karim', lastname: 'Benali', roleLabel: 'Entraineur' });
    expect(textes).toContain('Coach / Prof');
    expect(textes).not.toContain('Entraineur');
  });

  it('« Joueur » se lit « Pratiquant / Joueur »', () => {
    expect(textesDe({ firstname: 'Ali', roleLabel: 'Joueur' })).toContain('Pratiquant / Joueur');
  });

  it('un rôle hors de la table reste tel quel', () => {
    expect(textesDe({ firstname: 'Adel', roleLabel: 'SuperAdmin' })).toContain('SuperAdmin');
  });

  it('un libellé déjà lisible (« Coach / Prof ») ne bouge pas', () => {
    expect(textesDe({ firstname: 'Karim', roleLabel: 'Coach / Prof' })).toContain('Coach / Prof');
  });
});
