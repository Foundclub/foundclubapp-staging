// FIN-INSCRIPTION p4 (02/11) : un lecteur d'écran annonçait la case de l'accord parental sans dire
// à quoi elle engage. Son nom est la phrase de la déclaration, celle que le serveur empreinte.
import renderer, { act } from 'react-test-renderer';

import { PARENTAL_DECLARATION_SIGNATORIES } from '@/constants/parentalDeclaration';

import ParentalDeclarationCard, { parentalDeclarationTextFor } from '../ParentalDeclarationCard';

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));
jest.mock('@/theme/themeContext', () => {
  /**
   * Échelle de style tolérante : n'importe quelle clé rend un objet vide.
   * @returns {any} L'échelle.
   */
  const echelle = () => new Proxy({}, {
    get: (/** @type {any} */ _cible, /** @type {any} */ cle) => (
      typeof cle === 'symbol' ? undefined : echelle()
    ),
  });
  return {
    __esModule: true,
    default: () => ({
      Alignments: echelle(), Colors: {}, Fonts: echelle(), Spaces: echelle(),
    }),
  };
});

/**
 * Rend la carte et rend sa case.
 * @param {string} [signatory] - Qui coche.
 * @returns {Promise<any>} La case rendue.
 */
const caseDeLaCarte = async (signatory) => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ParentalDeclarationCard checked={false} onChange={jest.fn()} signatory={signatory} />,
    );
  });
  return /** @type {any} */ (arbre).root.findAll(
    (/** @type {any} */ n) => n.props.accessibilityRole === 'checkbox'
      && typeof n.type !== 'string',
  )[0];
};

describe('ParentalDeclarationCard - FIN-INSCRIPTION, nom de la case', () => {
  it('l ado : la case porte la phrase de sa déclaration', async () => {
    const laCase = await caseDeLaCarte();
    expect(laCase.props.accessibilityLabel).toBe(parentalDeclarationTextFor());
  });

  it('le parent : la case porte la phrase du parent', async () => {
    const laCase = await caseDeLaCarte(PARENTAL_DECLARATION_SIGNATORIES.PARENT);
    expect(laCase.props.accessibilityLabel)
      .toBe(parentalDeclarationTextFor(PARENTAL_DECLARATION_SIGNATORIES.PARENT));
  });
});
