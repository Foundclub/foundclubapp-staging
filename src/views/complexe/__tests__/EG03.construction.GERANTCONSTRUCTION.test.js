/* eslint-disable max-len -- témoin de GERANT-CONSTRUCTION : libellés de cas et attentes longs (récolte T10, lint au plafond) */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriseDuJour from '@/views/complexe/components/FriseDuJour';
import GrillePlanning from '@/views/complexe/components/GrillePlanning';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// 🏗️ GERANT-CONSTRUCTION (11/11/2026, D50) — LE PLANNING ET LA FRISE MONTRENT LA RÉSERVATION « EN
// CONSTRUCTION » : la case reste libre côté serveur (un autre groupe peut la prendre) et porte
// `construction` ; elle est HACHURÉE (le hachuré la distingue sans compter sur la couleur, maquette
// gerant-accueil.png), nommée « Sarah K. · En construction », la toucher ouvre la fiche, et l'appui
// long garde « Bloquer à partir d'ici » (la case est libre). La légende de la frise la nomme.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const CONSTRUCTION = {
  documentId: 'r-c1', label: 'Sarah K.', presents: 7, quorum: 10,
};
const creneau = (/** @type {Record<string, any>} */ autres) => ({
  closure: null,
  date: '2026-10-14',
  endsAt: '2026-10-14T20:00:00.000Z',
  from: '21:00',
  reservation: null,
  startsAt: '2026-10-14T19:00:00.000Z',
  state: 'libre',
  terrainId: 't1',
  terrainNom: 'Terrain 1',
  to: '22:00',
  ...autres,
});

describe('GERANT-CONSTRUCTION — la grille du planning', () => {
  it('la case en construction : hachurée, nommée, touchable vers la fiche, appui long gardé', () => {
    const onToucher = jest.fn();
    const onAppuiLong = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(GrillePlanning, {
        colonnes: [{
          cle: 't1',
          creneaux: [creneau({ construction: CONSTRUCTION }), creneau({ from: '22:00', startsAt: '2026-10-14T20:00:00.000Z', to: '23:00' })],
          titre: 'Terrain 1',
        }],
        estActif: () => true,
        onAppuiLong,
        onToucher,
      }));
    });
    const caseConstruite = parRepere(arbre, 'creneau-t1-2026-10-14-21:00');
    expect(lisibles(arbre)).toContain('Sarah K. · En construction');
    expect(caseConstruite.findAll((/** @type {any} */ n) => n.props.testID === 'hachures-creneau')).not.toHaveLength(0);
    expect(parRepere(arbre, 'creneau-t1-2026-10-14-22:00')
      .findAll((/** @type {any} */ n) => n.props.testID === 'hachures-creneau')).toHaveLength(0);
    act(() => { caseConstruite.props.onPress(); });
    expect(onToucher).toHaveBeenCalledWith(expect.objectContaining({ construction: CONSTRUCTION }));
    expect(typeof caseConstruite.props.onLongPress).toBe('function');
  });
});

describe('GERANT-CONSTRUCTION — la frise de l’accueil', () => {
  it('la case hachurée et « En construction » dans la légende', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(FriseDuJour, {
        lignes: [{
          cle: 't1',
          creneaux: [{
            etat: 'construction', from: '21:00', libelle: 'Sarah K. · En construction', reservationId: 'r-c1', to: '22:00',
          }],
          nom: 'Terrain 1',
        }],
        maintenant: 18 * 60,
        onToucher: () => {},
      }));
    });
    expect(parRepere(arbre, 'frise-creneau-t1-21:00')
      .findAll((/** @type {any} */ n) => n.props.testID === 'hachures-creneau')).not.toHaveLength(0);
    act(() => { pressable(arbre, 'Légende').props.onPress(); });
    expect(lisibles(arbre)).toContain('En construction');
  });
});
