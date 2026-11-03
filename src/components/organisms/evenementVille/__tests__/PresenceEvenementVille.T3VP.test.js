import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PresenceEvenementVille from '../PresenceEvenementVille';

// T3-VILLE-PRESENCE (03/11/2026, fiche 9 option A d'Adel) — « Présent » ou « Absent » sur la fiche d'un
// événement de la Ville, chacun pour soi. Le serveur juge (témoin admin T3VP-1) ; ce témoin fige l'écran :
//   - le lecteur répond, sa réponse se redit, il change d'avis ;
//   - annulé, terminé, moins de 13 ans : plus aucun bouton ;
//   - la Ville lit les totaux et les encadrants nommés, le dirigeant la liste de son club ;
//   - un joueur ne lit jamais les réponses des autres ; un serveur sans `presence` : rien ne s'affiche.

const mockRepondre = jest.fn();
const mockGetReponses = jest.fn();

jest.mock('@/services/collectivite/collectiviteEvenementService', () => ({
  getReponsesEvenement: (/** @type {any} */ id) => mockGetReponses(id),
  repondreEvenement: (/** @type {any} */ params) => mockRepondre(params),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
// PC chargé : le premier rendu charge tout le thème.
jest.setTimeout(30000);

// react-query publie ses résultats au tour suivant de la boucle.
const laisserPasser = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 0); });
});

const fiche = (/** @type {any} */ presence) => ({ documentId: 'evt-1', name: 'Tournois', presence });

const monter = async (/** @type {any} */ props) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PresenceEvenementVille {...props} />
      </QueryClientProvider>,
    );
  });
  await laisserPasser();
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props.testID === (titre === 'Présent' ? 'presence-present' : 'presence-absent')
    && n.props.onPress)[0];
const aBouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => Boolean(bouton(arbre, titre));

beforeEach(() => {
  mockRepondre.mockReset();
  mockGetReponses.mockReset();
});

describe('la personne qui lit la fiche', () => {
  it('répond « Présent » : la réponse part, pour cet événement', async () => {
    mockRepondre.mockResolvedValue({ data: { etat: 'ouverte', maReponse: 'present' } });
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'ouverte', maReponse: null, voitLesReponses: false }),
    });
    expect(textes(arbre)).toContain('Tu viens ?');
    await act(async () => { await bouton(arbre, 'Présent').props.onPress(); });
    await laisserPasser();
    expect(mockRepondre).toHaveBeenCalledWith({ answer: 'present', evenementId: 'evt-1' });
  });

  it('voit sa réponse et peut changer d’avis', async () => {
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'ouverte', maReponse: 'absent', voitLesReponses: false }),
    });
    expect(textes(arbre)).toContain('Ta réponse : absent. Tu peux changer d’avis.');
    expect(bouton(arbre, 'Absent').props.accessibilityState).toEqual({ selected: true });
    expect(bouton(arbre, 'Présent').props.accessibilityState).toEqual({ selected: false });
  });

  it('un refus du serveur se dit à l’écran', async () => {
    mockRepondre.mockRejectedValue(new Error('refus'));
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'ouverte', maReponse: null, voitLesReponses: false }),
    });
    await act(async () => { await bouton(arbre, 'Absent').props.onPress(); });
    await laisserPasser();
    expect(textes(arbre)).toContain('Ta réponse n’est pas partie. Réessaie.');
  });

  it.each([
    ['annulee', 'present', 'Ta réponse : présent.'],
    ['terminee', 'absent', 'Ta réponse : absent.'],
  ])('%s : plus de bouton, la réponse donnée reste lisible', async (etat, maReponse, phrase) => {
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat, maReponse, voitLesReponses: false }),
    });
    expect(aBouton(arbre, 'Présent')).toBe(false);
    expect(textes(arbre)).toContain(phrase);
  });

  it('moins de 13 ans : pas de bouton, une phrase', async () => {
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'parent', maReponse: null, voitLesReponses: false }),
    });
    expect(aBouton(arbre, 'Présent')).toBe(false);
    expect(textes(arbre)).toContain('Tu as moins de 13 ans : c’est à ton parent de répondre.');
  });

  it('ne lit jamais les réponses des autres', async () => {
    await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'ouverte', maReponse: null, voitLesReponses: false }),
    });
    expect(mockGetReponses).not.toHaveBeenCalled();
  });

  it('un serveur sans `presence` (pas encore à jour) : rien ne s’affiche', async () => {
    const arbre = await monter({ deLaVille: false, evenement: fiche(undefined) });
    expect(arbre.toJSON()).toBeNull();
    expect(mockGetReponses).not.toHaveBeenCalled();
  });
});

describe('qui lit les réponses', () => {
  it('la Ville : les totaux, les encadrants nommés, un total pour les autres', async () => {
    mockGetReponses.mockResolvedValue({
      data: {
        autres: { absent: 2, present: 9 },
        encadrants: [{
          club: 'AS Ville A', fonction: 'entraineur', nom: 'Hugo Coach', reponse: 'absent',
        }],
        totaux: { absent: 3, present: 9 },
        vue: 'ville',
      },
    });
    const arbre = await monter({ deLaVille: true, evenement: fiche(undefined) });
    expect(mockGetReponses).toHaveBeenCalledWith('evt-1');
    const ecran = textes(arbre);
    expect(ecran).toContain('9 présents · 3 absents');
    expect(ecran).toContain('Hugo Coach');
    expect(ecran).toContain('Entraîneur · AS Ville A · Absent');
    expect(ecran).toContain('Joueurs et parents : 9 présents · 2 absents');
    expect(aBouton(arbre, 'Présent')).toBe(false);
  });

  it('la Ville, sans aucune réponse : une phrase', async () => {
    mockGetReponses.mockResolvedValue({
      data: {
        autres: { absent: 0, present: 0 },
        encadrants: [],
        totaux: { absent: 0, present: 0 },
        vue: 'ville',
      },
    });
    const arbre = await monter({ deLaVille: true, evenement: fiche(undefined) });
    expect(textes(arbre)).toContain('Personne n’a encore répondu.');
  });

  it('le dirigeant : répond pour lui, et lit la liste de son club', async () => {
    mockGetReponses.mockResolvedValue({
      data: {
        club: 'AS Ville A',
        reponses: [
          { fonction: 'entraineur', nom: 'Hugo Coach', reponse: 'absent' },
          { fonction: 'membre', nom: 'Nina Joueuse', reponse: 'present' },
        ],
        totaux: { absent: 1, present: 1 },
        vue: 'club',
      },
    });
    const arbre = await monter({
      deLaVille: false,
      evenement: fiche({ etat: 'ouverte', maReponse: null, voitLesReponses: true }),
    });
    const ecran = textes(arbre);
    expect(aBouton(arbre, 'Présent')).toBe(true);
    expect(ecran).toContain('Les réponses de AS Ville A');
    expect(ecran).toContain('1 présent · 1 absent');
    expect(ecran).toContain('Nina Joueuse');
    expect(ecran).toContain('Présent');
  });

  it('une lecture en panne : rien, jamais un chiffre faux', async () => {
    mockGetReponses.mockRejectedValue(new Error('panne'));
    const arbre = await monter({ deLaVille: true, evenement: fiche(undefined) });
    expect(arbre.toJSON()).toBeNull();
  });
});
