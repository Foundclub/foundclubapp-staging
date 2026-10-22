import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

// RESA-FIN-SITE (21/10/2026) — tournée connectée du site du 22/10 : « 1 repères visibles » sur la carte
// de recherche. Un repère : le singulier ; plusieurs : le pluriel (inchangé).

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const textes = async (/** @type {number} */ reperes) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SearchMapHud
        geolocatableCount={reperes}
        onLocateMe={jest.fn()}
        onRecenter={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        renderStats={{ clusterCount: 0, markerCount: reperes }}
        scope="complexes"
        totalCount={reperes}
      />,
    );
  });
  return arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [n.props.children].flat().join(''));
};

describe('RESA-FIN-SITE — le nombre de repères visibles', () => {
  it('un repère : « 1 repère visible »', async () => {
    const lus = await textes(1);
    expect(lus).toContain('1 repère visible');
    expect(lus.join(' ')).not.toMatch(/1 repères/);
  });

  it('trois repères : « 3 repères visibles » (inchangé)', async () => {
    expect(await textes(3)).toContain('3 repères visibles');
  });
});
