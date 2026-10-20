import renderer, { act } from 'react-test-renderer';

import '@/theme/strings';

import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import { lisibles } from '@/testSupport/temoinComplexe';

// RESA-L6B-2 (20/10/2026) — LA PASTILLE AVEC LA VRAIE TRADUCTION. Le banc du site l'a vue :
// « En collecte · 1&#x2F;10 ». i18next échappe les valeurs interpolées (sansEchappement.js) et la
// doublure des autres témoins, elle, n'échappe rien : ce témoin-ci monte la pastille avec le VRAI
// i18next (pas de doublure de `react-i18next`).

jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

it('« En collecte · 1/10 » : le compte passe tel quel, sans entité HTML', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PastilleEtat compte="1/10" etat="enCollecte" />);
  });
  expect(lisibles(arbre)).toEqual(['En collecte · 1/10']);
});
