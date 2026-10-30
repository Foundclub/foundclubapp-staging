import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { equipeDeSonAge } from '@/domains/category/ageEtCategorie';

import DemandePlaceEnfant from '../DemandePlaceEnfant';

// CORR-INSCRIPTION p19 (recette du site 30/10, décision A) — une enfant de 10 ans se voyait proposer
// « Sénior +18 » au même rang que sa U11 ; un adulte de 28 ans demandait une U11 sans repère. Les
// équipes de son âge viennent d'abord ; les autres, grisées sous « Autres équipes », restent
// demandables (cacher a été écarté : un club qui surclasse ne recevrait plus la demande).

// La catégorie lit `getCategorySortKey` dans son service, qui charge le client HTTP.
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return repli?.defaultValue || cle;
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      Colors: new Proxy({}, { get: () => '#000000' }),
      Fonts: rampe(),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><RNText>{title}</RNText></TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => {
  const { Text: RNText, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><RNText>{`EQUIPE:${title}`}</RNText></TouchableOpacity>
    ),
  };
});

describe('CORR-INSCRIPTION p19 — equipeDeSonAge', () => {
  it('une U11 accueille les 9-10 ans ; une Sénior les 18 ans et plus', () => {
    expect(equipeDeSonAge('U11 (11 ans)', 10)).toBe(true);
    expect(equipeDeSonAge('U11 (11 ans)', 9)).toBe(true);
    expect(equipeDeSonAge('U11 (11 ans)', 28)).toBe(false);
    expect(equipeDeSonAge('Sénior (+18 ans)', 10)).toBe(false);
    expect(equipeDeSonAge('Sénior (+18 ans)', 28)).toBe(true);
  });

  it('âge ou catégorie inconnus : rien n’est grisé', () => {
    expect(equipeDeSonAge('', 10)).toBe(true);
    expect(equipeDeSonAge('Loisir mixte', 10)).toBe(true);
    expect(equipeDeSonAge('U11 (11 ans)', null)).toBe(true);
  });
});

describe('CORR-INSCRIPTION p19 — la feuille du parent', () => {
  it('Lina, 10 ans : U11 d’abord, puis « Autres équipes » et Seniors A', () => {
    let arbre;
    act(() => {
      arbre = renderer.create(
        <DemandePlaceEnfant
          clesEnAttente={new Set()}
          clubName="RWDIRIG Tunnel Deux"
          enfantDeLaFiche="lina"
          enfants={[{ age: 10, documentId: 'lina', firstname: 'Lina', reason: '' }]}
          envoiEnCours={false}
          equipes={[
            { categorie: 'Sénior (+18 ans)', details: 'Sénior', documentId: 'sen', name: 'Seniors A' },
            { categorie: 'U11 (11 ans)', details: 'U11', documentId: 'u11', name: 'U11 Tunnel' },
          ]}
          onEnvoyer={jest.fn()}
        />,
      );
    });
    const choisir = /** @type {any} */ (arbre).root.findAll(
      (/** @type {any} */ n) => typeof n.props.onPress === 'function'
        && n.findAllByType(Text).some((tx) => tx.props.children === 'Choisir l’équipe'),
    )[0];
    act(() => { choisir.props.onPress(); });

    const textes = /** @type {any} */ (arbre).root.findAllByType(Text)
      .map((/** @type {any} */ n) => n.props.children)
      .filter((/** @type {any} */ c) => typeof c === 'string');
    const ordre = textes.filter((c) => c.startsWith('EQUIPE:') || c === 'Autres équipes');
    expect(ordre).toEqual(['EQUIPE:U11 Tunnel', 'Autres équipes', 'EQUIPE:Seniors A']);
  });
});
