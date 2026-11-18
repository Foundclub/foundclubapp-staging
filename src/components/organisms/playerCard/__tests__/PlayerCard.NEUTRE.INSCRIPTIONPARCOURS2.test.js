// @ts-nocheck
/**
 * INSCRIPTION-PARCOURS-2 (18/11/2026, D257, Q5 d'Adel) — la carte NEUTRE : pour un sport qui n'a
 * pas de modèle (spéléo, course…), la carte modèle de fin d'inscription ne dessine ni terrain, ni
 * grand numéro, ni dos de maillot. Sans `neutre`, rien ne change.
 */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import BackJerseyFallback from '../BackJerseyFallback';
import { CourtLines } from '../courts';
import PlayerCard from '../PlayerCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const fabrique = (nom) => ({ children, ...props }) => (
    reactActuel.createElement(`svg:${nom}`, props, children)
  );
  const cache = {};
  return new Proxy(
    { __esModule: true },
    {
      get: (cible, cle) => {
        if (cle === '__esModule') return true;
        const nom = cle === 'default' ? 'Racine' : String(cle);
        cache[nom] = cache[nom] || fabrique(nom);
        return cache[nom];
      },
    },
  );
});

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  return ({ children, ...props }) => reactActuel.createElement('LinearGradient', props, children);
});

jest.mock('react-native-qrcode-svg', () => function QRCodeDoublure() {
  return null;
});

const MODELE = {
  age: '22 ans',
  categorie: 'Seniors',
  club: 'Club Exemple',
  nationalite: 'Française',
  niveau: 'Confirmé',
  nom: 'MARTIN',
  numero: '7',
  poids: '62 kg',
  poste: '',
  prenom: 'Léa',
  qrLabel: 'foundclub.app',
  qrValue: '',
  rarity: 'EPIC',
  sport: 'Spéléologie',
  taille: '1,72 m',
  ville: 'Lyon 69007',
};

const rendre = (props) => {
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(PlayerCard, {
      ...MODELE, mode: 'image', width: 320, ...props,
    }));
  });
  return arbre;
};

// Le grand numéro en contour derrière le joueur (fontSize 400), pas celui du dos de maillot.
const grandNumero = (arbre) => arbre.root.findAll((n) => n.type === 'svg:Text'
  && n.props.fontSize === 400);

describe('INSCRIPTION-PARCOURS-2 — la carte neutre (D257)', () => {
  it('sans `neutre` : le terrain, le grand numéro et le dos de maillot sont là (inchangé)', () => {
    const arbre = rendre({});

    expect(arbre.root.findAllByType(CourtLines)).toHaveLength(1);
    expect(grandNumero(arbre)).toHaveLength(1);
    expect(arbre.root.findAllByType(BackJerseyFallback)).toHaveLength(1);
  });

  it('avec `neutre` : ni terrain, ni grand numéro, ni dos de maillot', () => {
    const arbre = rendre({ neutre: true });

    expect(arbre.root.findAllByType(CourtLines)).toHaveLength(0);
    expect(grandNumero(arbre)).toHaveLength(0);
    expect(arbre.root.findAllByType(BackJerseyFallback)).toHaveLength(0);
  });

  it('avec `neutre` : le sport et le nom restent écrits', () => {
    const arbre = rendre({ neutre: true });
    const lus = arbre.root.findAll((n) => typeof n.props.children === 'string')
      .map((n) => n.props.children).join(' ');

    expect(lus).toMatch(/Spéléologie/i);
    expect(lus).toMatch(/MARTIN/);
  });
});
