import { createElement, Profiler } from 'react';
import renderer, { act } from 'react-test-renderer';

// EVEDIT-5 — LA BOUCLE DE RENDU INFINIE DE L'EDITEUR D'AUDIENCES.
//
// 🚨 OBSERVE SUR L'EMULATEUR LE 01/09 (logcat, 57 occurrences en 2 min 48) :
// « Warning: Maximum update depth exceeded » dans `EventTeamAudiencesEditor`,
// des la premiere seconde de l'ecran « Modifier l'evenement » et sans fin.
// Cette boucle sature le fil JS : la reponse serveur arrive en 2 s, le
// formulaire ne se remplit que 80 s plus tard, et les appuis sont avales.
//
// LA CHAINE : `EventEdit` (comme `EventEdit.web`) monte l'editeur SANS la prop
// `allowedAudienceKinds`. Le parametre par defaut — un litteral de tableau —
// est donc RECREE A CHAQUE RENDU ; le `useMemo` `normalizedAllowedKinds` qui en
// depend rend un tableau neuf a chaque fois ; l'effet des equipes externes, qui
// le cite dans ses dependances, se relance apres CHAQUE rendu et pose
// `setExternalTeams([])` avec une identite neuve ⇒ nouveau rendu ⇒ boucle.
//
// 🪤 POURQUOI QUATRE LOTS VERTS N'ONT RIEN VU : tous les temoins d'`EventEdit`
// remplacent ce composant par une doublure de texte. Ici on monte LE VRAI,
// avec les props EXACTES de la production (sans `allowedAudienceKinds`).
//
// ⚠️ React ne JETTE pas sur une boucle d'effets passifs : il avertit et
// continue. Un `act()` nu tournerait donc sans fin et PENDRAIT la suite —
// exactement le defaut qui a aveugle la CI d'avril a juillet. La sonde
// `Profiler` compte les commits et CASSE la boucle a 60 : le temoin echoue
// proprement au lieu de pendre.

/* eslint-disable global-require */
jest.mock('@/services/club/clubService', () => ({
  getClubs: jest.fn(() => Promise.resolve({ data: [] })),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

// La feuille reste fermee dans ce temoin ; la doublure evite seulement de
// charger la chaine @gorhom/blur/safe-area au moment de l'import.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);

// Publie en TypeScript non transforme (gesture-handler) : sans doublure, la
// SUITE ENTIERE meurt a l'import — motif repris d'EventEditEvedit4GesteReel.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble() {
    return react.createElement(rn.View, { testID: 'doublure-onglets' });
  };
});

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces: espaces,
    }),
  };
});
/* eslint-enable global-require */

const EventTeamAudiencesEditor = require('../components/EventTeamAudiencesEditor').default;

const PLAFOND_COMMITS = 60;

describe('EVEDIT-5 — l editeur d audiences ne boucle pas', () => {
  it('monte comme en production (sans allowedAudienceKinds) et se stabilise', () => {
    let commits = 0;
    /** @type {import('react-test-renderer').ReactTestRenderer | undefined} */
    let arbre;

    const monter = () => {
      act(() => {
        arbre = renderer.create(createElement(
          Profiler,
          {
            id: 'sonde-evedit5',
            onRender: () => {
              commits += 1;
              if (commits > PLAFOND_COMMITS) {
                throw new Error(
                  `BOUCLE DE RENDU : plus de ${PLAFOND_COMMITS} commits au montage — `
                  + 'l editeur d audiences se re-rend sans fin (Maximum update depth).',
                );
              }
            },
          },
          // Les props EXACTES d'EventEdit.js — surtout SANS `allowedAudienceKinds`.
          createElement(EventTeamAudiencesEditor, {
            availableTeams: [
              {
                documentId: 'equipe-a', name: 'Seniors A', players: [], trainers: [],
              },
              {
                documentId: 'equipe-b', name: 'Seniors B', players: [], trainers: [],
              },
            ],
            clubId: 'club-test',
            currentTeamId: 'equipe-a',
            editable: true,
            onChange: () => {},
            value: [],
          }),
        ));
      });
    };

    expect(monter).not.toThrow();
    // Marge large : montage + un aller-retour d'effets. La boucle observee
    // depasse le plafond des la premiere seconde.
    expect(commits).toBeLessThanOrEqual(10);

    act(() => { arbre?.unmount(); });
  });
});
