import dayjs from 'dayjs';
import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

/**
 * U06 — TEMOINS 2 et 3 : la carte de compo envoyee dans le tchat.
 *
 * 🗣️ Adel, 18/08 : « la petite carte cliquable qui s'envoie dans le chat manque
 * de contexte et des elements sont coupes. Il faut au moins afficher le nom, la
 * date, l'heure et l'adresse. »
 *
 * 🧨 Mesure : `eventName` et l'heure de `eventDate` ARRIVENT dans la charge
 * envoyee par le serveur (`event-composition.ts:publishLineupShareToTeamChat`)
 * et sont jetes par ce composant — la carte n'affichait que « Composition
 * d'equipes publiee », une date sans heure, et le nom de l'equipe.
 * L'adresse, elle, n'etait pas envoyee du tout : le serveur la pose desormais
 * DEJA DEBALLEE (`extractHumanAddressLabel`), la carte ne fait que l'afficher.
 *
 * ⛔ Un lieu absent est DIT, jamais invente.
 */

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View> };
});

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
      Spaces,
    }),
  };
});

const COMPO = {
  eventAddress: 'Stade Georges Ricard, 13710 Fuveau',
  eventDate: '2026-08-24T18:30:00.000Z',
  eventId: 'evt-1',
  eventName: 'US Fuveau - AS Gardanne',
  placements: [],
  publishedVersion: 2,
  schemaVersion: 3,
  teamName: 'U15 A',
  teams: [{ id: 't1', name: 'U15 A', placements: [] }],
  type: 'lineup_share',
};

const textes = (noeud, acc = []) => {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return acc;
  if (typeof noeud === 'string' || typeof noeud === 'number') {
    acc.push(String(noeud));
    return acc;
  }
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => textes(enfant, acc));
    return acc;
  }
  textes(noeud.children, acc);
  return acc;
};

const rendre = (composition) => {
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} />);
  });
  return textes(arbre.toJSON()).join(' | ');
};

describe('U06 — la carte de compo porte enfin son contexte', () => {
  it('temoin 2 — le nom du match, la date, l heure et le lieu sont a l ecran', () => {
    const rendu = rendre(COMPO);
    // Date et heure LOCALES du telephone : la machine de test n'est pas a Paris,
    // on compare donc a ce que dayjs rend pour cet instant-la, pas a une chaine
    // ecrite en dur qui dependrait du fuseau de la machine.
    const instant = dayjs(COMPO.eventDate);

    expect(rendu).toContain('US Fuveau - AS Gardanne');
    expect(rendu).toContain(instant.format('DD/MM/YYYY'));
    expect(rendu).toContain(instant.format('HH:mm'));
    expect(rendu).toContain('Stade Georges Ricard, 13710 Fuveau');
  });

  it('temoin 3 — un lieu absent est DIT, jamais invente', () => {
    const rendu = rendre({ ...COMPO, eventAddress: null });

    expect(rendu).toContain('Lieu non précisé');
    expect(rendu).not.toContain('undefined');
    expect(rendu).not.toContain('null');
  });

  it('une adresse qui n est pas une chaine est traitee comme absente', () => {
    // Le deballage se fait UNE fois, cote serveur (`extractHumanAddressLabel`).
    // Ici on garde seulement le garde-fou : jamais d'objet imprime tel quel.
    const rendu = rendre({ ...COMPO, eventAddress: { address: '12 rue des Lilas' } });

    expect(rendu).not.toContain('object Object');
    expect(rendu).toContain('Lieu non précisé');
  });

  it('sans nom de match, la carte garde son intitule et ne montre pas de trou', () => {
    const rendu = rendre({ ...COMPO, eventName: null });

    expect(rendu).toContain("Composition d'équipes publiée");
    expect(rendu).not.toContain('undefined');
  });

  it('le nom de l equipe et la version restent lisibles', () => {
    const rendu = rendre(COMPO);

    expect(rendu).toContain('U15 A');
    expect(rendu).toContain('v2');
  });
});
