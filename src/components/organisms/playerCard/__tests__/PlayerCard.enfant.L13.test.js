// @ts-nocheck
/**
 * PAR-L13 (13/10) — LA CARTE D UN ENFANT DECLARE (moins de 13 ans), « pareille que les
 * autres » (decision d'Adel du 12/10, registre des mineurs ligne 23), avec deux differences
 * que la maquette (planche 13, E28 et E29) dessine :
 *  - une rangee ÉQUIPE (« U11 Filles · FoundClub ») : la fiche porte son equipe ;
 *  - AUCUN statut : « disponible » n existe pas pour une fiche (design §2 ter).
 * Et ce qui ne change pas : sans `qrValue`, la case du code reste vide (« FC ») — jamais de
 * code QR sur la carte d un enfant.
 * Les autres cartes ne bougent pas : leur rendu est garde par PlayerCard.L14 et la
 * caracterisation.
 */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import PlayerCard from '../PlayerCard';

// Le vrai dictionnaire français : la rangée ÉQUIPE n'a pas de texte de secours dans le code.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (chemin) => chemin.split('.').reduce(
    (noeud, segment) => (noeud && typeof noeud === 'object' ? noeud[segment] : undefined),
    traductions,
  );
  const t = (cle, repli) => {
    const valeur = lire(cle);
    if (typeof valeur === 'string') return valeur;
    return typeof repli === 'string' ? repli : cle;
  };
  return { useTranslation: () => ({ t }) };
});

jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const Boite = ({ children }) => reactActuel.createElement(VueRN, null, children);
  return {
    __esModule: true,
    Circle: Boite,
    default: Boite,
    Defs: Boite,
    Ellipse: Boite,
    G: Boite,
    Line: Boite,
    LinearGradient: Boite,
    Path: Boite,
    Polygon: Boite,
    RadialGradient: Boite,
    Rect: Boite,
    Stop: Boite,
    Text: () => null,
  };
});

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return ({ children }) => reactActuel.createElement(VueRN, null, children);
});

jest.mock('react-native-qrcode-svg', () => function QRCodeDoublure() {
  return null;
});

const ANISSA = {
  age: '11 ANS',
  equipe: 'U11 Filles · FoundClub',
  nationalite: 'Française',
  nom: 'DUBELLOY',
  numero: '7',
  poste: 'Meneuse',
  prenom: 'Anissa',
  rarity: 'COMMON',
  statut: null,
  ville: 'Marseille',
};

const monter = (props) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, { ...props, width: 327 }));
  });
  return arbre;
};

const textes = (arbre) => arbre.root.findAll((n) => n.type === 'Text')
  .map((n) => [].concat(n.props.children).join(''));

describe('PAR-L13 — la carte d un enfant declare', () => {
  it('🔴 porte une rangee ÉQUIPE avec son equipe et son club', () => {
    const vus = textes(monter(ANISSA));

    expect(vus).toContain('ÉQUIPE');
    expect(vus).toContain('U11 FILLES · FOUNDCLUB');
  });

  it('🔴 n a AUCUN statut : ni « STATUT », ni « DISPONIBLE », ni « INDISPONIBLE »', () => {
    const vus = textes(monter(ANISSA));

    expect(vus).not.toContain('STATUT');
    expect(vus).not.toContain('DISPONIBLE');
    expect(vus).not.toContain('INDISPONIBLE');
  });

  it('sans `qrValue`, aucun code QR : la case montre « FC »', () => {
    const arbre = monter(ANISSA);

    expect(arbre.root.findAll((n) => n.type?.name === 'QRCodeDoublure')).toHaveLength(0);
    expect(textes(arbre)).toContain('FC');
  });

  it('les autres cartes gardent leur statut (rendu par defaut inchange)', () => {
    const { equipe, statut, ...adulte } = ANISSA;
    const vus = textes(monter({ ...adulte, club: 'FoundClub', statut: 'DISPONIBLE' }));

    expect(vus).toContain('STATUT');
    expect(vus).toContain('DISPONIBLE');
    expect(vus).not.toContain('ÉQUIPE');
  });
});
