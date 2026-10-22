import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

import { enUnMot, textes } from '@/testSupport/temoinComplexe';

// RESA-FIN-APP (20/10/2026) — tournées 1 et 2 (Android 16) : un texte GRAS de plusieurs mots, dans une boîte qui
// épouse sa largeur (une puce, une pastille), perd son dernier mot : l'onglet choisi de « Mes réservations »
// affichait « À » au lieu de « À venir », la pastille « Annulée par le [complexe] ». La parade prouvée à l'écran
// (FINITIONS19, mémoire piege-android16-gras-dernier-mot-perdu) : `texteInsecable`, le texte se comporte comme un
// mot seul. On la pose UNE fois, dans la puce et dans la pastille partagées par tous les écrans du joueur.
// La lecture d'écran garde ses espaces ordinaires.

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const monter = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  return arbre;
};

describe('RESA-FIN-APP (1) — les puces du joueur dessinées en un seul mot', () => {
  it.each(['À venir', 'En collecte', 'Refusées et annulées', '17 h · Padel A'])('« %s »', (libelle) => {
    const arbre = monter(<PuceChoix libelle={libelle} onPress={jest.fn()} />);
    expect(textes(arbre)).toEqual([enUnMot(libelle)]);
    // Le libellé lu garde ses espaces.
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === libelle).length)
      .toBeGreaterThan(0);
  });
});

describe('RESA-FIN-APP (1) — les pastilles d’état dessinées en un seul mot', () => {
  it.each([
    ['annuleeParLeComplexe', 'Annulée par le complexe'],
    ['annuleeParToi', 'Annulée par toi'],
    ['enAttente', 'En attente'],
    ['nonHonoree', 'Non honorée'],
    ['sansReponse', 'Sans réponse'],
  ])('%s : « %s »', (etat, mot) => {
    const arbre = monter(<PastilleEtat etat={etat} />);
    expect(arbre.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children))
      .toEqual([enUnMot(mot)]);
  });
});
