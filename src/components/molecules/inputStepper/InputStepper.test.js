import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InputStepper from './InputStepper';

// Filet D58 (E6) — CE COMPOSANT N AVAIT AUCUN TEST, et il est partage par 4
// ecrans : la fiche « Nouvelle tache » du tunnel, les licences
// (`ClubLicenseCampaignSettings`) et deux ecrans de recrutement
// (`RecruitmentAdEdit`, `AdWizardCoachProfile`).
//
// Le pack « Tunnel Evenement » §2.8 demande « fini le stepper blanc » POUR LA
// FICHE TACHE. Repeindre le composant aurait repeint les 3 autres. D58 ajoute
// donc `tone`, qui vaut `'surface'` par defaut — l'apparence historique.
//
// ⚠️ Ici la retouche EST une couleur : il n'y a aucun texte qui change entre
// les deux registres. Le controle porte donc sur le style resolu, seule chose
// observable.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});

const Colors = jest.requireActual('@/theme/colors').default();

/**
 * Le fond du bloc compteur, et la couleur du chiffre affiche.
 * @param {'surface' | 'tunnel'} [tone] Registre demande, ou aucun.
 * @returns {{ fond: string, teinteDuChiffre: string }} Les deux couleurs.
 */
const rendreEtLire = (tone) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(InputStepper, {
      label: 'Nombre de personnes',
      max: 50,
      min: 1,
      onDecrement: () => {},
      onIncrement: () => {},
      value: 3,
      ...(tone ? { tone } : {}),
    }));
  });

  const blocs = arbre.root.findAll(
    (/** @type {any} */ noeud) => (
      typeof noeud.type === 'string'
      && Boolean(StyleSheet.flatten(noeud.props?.style)?.backgroundColor)
    ),
    { deep: true },
  );
  const fond = StyleSheet.flatten(blocs[0].props.style).backgroundColor;

  const chiffre = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.children?.includes?.('3'),
    { deep: true },
  );
  const teinteDuChiffre = StyleSheet.flatten(
    chiffre[chiffre.length - 1].props.style,
  ).color;

  act(() => arbre.unmount());
  return { fond, teinteDuChiffre };
};

describe('D58 — le registre visuel du compteur', () => {
  test('sans `tone`, il garde son apparence historique : les 3 autres ecrans ne bougent pas', () => {
    const { fond, teinteDuChiffre } = rendreEtLire();

    expect(fond).toBe(Colors.neutral100);
    expect(teinteDuChiffre).toBe(Colors.neutral900);
  });

  test('en `tone="tunnel"`, il quitte le blanc pour le fond sombre du tunnel', () => {
    const { fond, teinteDuChiffre } = rendreEtLire('tunnel');

    expect(fond).toBe('rgba(4, 31, 44, 0.82)');
    expect(fond).not.toBe(Colors.neutral100);
    // Le chiffre doit suivre : un chiffre sombre sur fond sombre serait pire
    // que le stepper blanc qu'on retire.
    expect(teinteDuChiffre).toBe(Colors.neutral00);
  });
});
