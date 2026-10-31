import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter, readCarriedWebParams } from '../webNavigationAdapter';
import { buildWebPath } from '../webRoutes';

// ==========================================================================
// COMPO-WEB (29/09) — SUR LE SITE, LES OBJETS DU PARCOURS DE COMPOSITION
// VOYAGENT D'UN ECRAN A L'AUTRE.
//
// Le site transporte les parametres d'un ecran PAR L'ADRESSE, qui ne porte que
// du texte : `buildQueryString` jette tout objet. Les joueurs coches, le terrain
// en cours et le joueur hors app tout juste saisi disparaissaient donc entre
// deux ecrans du parcours — la selection arrivait vide au terrain.
//
// Ce que ce fichier tient :
//   1. vers un ecran du parcours de composition, les parametres COMPLETS sont
//      gardes EN MEMOIRE (jamais dans le navigateur), sous une cle portee par
//      l'entree d'historique ; l'adresse, elle, ne change pas ;
//   2. vers tout autre ecran, RIEN ne change (148 ecrans du site hors lot) ;
//   3. `setParams` sur un ecran du parcours reecrit l'adresse SANS y verser
//      « [object Object] », et garde ses objets ;
//   4. `popTo` existe (il manquait : l'appeler faisait planter la page) ;
//   5. la memoire est bornee.
// ==========================================================================

const JOUEURS = [{ documentId: 'j1', firstname: 'Prenom1', lastname: 'Nom1' }];

const fabriquer = (/** @type {any} */ options = {}) => {
  const push = jest.fn();
  const replace = jest.fn();
  const setSearchParams = jest.fn();
  const adapter = createWebNavigationAdapter({
    currentPath: '/match/call-up/select?eventId=e1',
    currentRouteName: RouteNames.MatchCallUpSelection,
    goBack: jest.fn(),
    params: {},
    push,
    replace,
    setSearchParams,
    ...options,
  });
  return {
    adapter, push, replace, setSearchParams,
  };
};

describe('COMPO-WEB — les objets du parcours de composition voyagent en memoire', () => {
  test('1. vers le terrain, les joueurs coches sont gardes ; l adresse ne change pas', () => {
    const { adapter, push } = fabriquer();
    const params = {
      eventId: 'e1', readOnly: false, selectedPlayers: JOUEURS, teamId: 't1',
    };

    adapter.navigate(RouteNames.MatchCompositionBoard, params);

    expect(push).toHaveBeenCalledTimes(1);
    const [chemin, etat] = push.mock.calls[0];
    expect(chemin).toBe('/match/composition/board?eventId=e1&readOnly=false&teamId=t1');
    expect(etat).toEqual({ carry: expect.any(String) });
    expect(readCarriedWebParams(etat.carry)).toEqual(params);
    expect(readCarriedWebParams(etat.carry).selectedPlayers).toBe(JOUEURS);
  });

  test('2. vers un ecran HORS du parcours, rien ne change', () => {
    const { adapter, push } = fabriquer();

    adapter.navigate(RouteNames.EventDetails, { eventId: 'e1', objet: { a: 1 } });

    const fiche = buildWebPath(RouteNames.EventDetails, { eventId: 'e1' });
    expect(push).toHaveBeenCalledWith(fiche, undefined);
  });

  test('3. sans objet a transporter, aucune cle', () => {
    const { adapter, push } = fabriquer();

    adapter.navigate(RouteNames.MatchConvocationPublished, { eventId: 'e1', teamId: 't1' });

    const reponses = '/match/convocation/published?eventId=e1&teamId=t1';
    expect(push).toHaveBeenCalledWith(reponses, undefined);
  });

  test('4. navigation imbriquee (`screen` / `params`) : la cible reelle decide', () => {
    const { adapter, push } = fabriquer();

    adapter.navigate('EventStack', {
      params: { eventId: 'e1', selectedPlayers: JOUEURS },
      screen: RouteNames.MatchCompositionBoard,
    });

    const [chemin, etat] = push.mock.calls[0];
    expect(chemin).toBe('/match/composition/board?eventId=e1');
    expect(readCarriedWebParams(etat.carry).selectedPlayers).toBe(JOUEURS);
  });

  test('5. `replace` transporte aussi', () => {
    const { adapter, replace } = fabriquer();

    adapter.replace(RouteNames.MatchCallUpSelection, { eventId: 'e1', selectedPlayers: JOUEURS });

    const [chemin, etat] = replace.mock.calls[0];
    expect(chemin).toBe('/match/call-up/select?eventId=e1');
    expect(readCarriedWebParams(etat.carry).selectedPlayers).toBe(JOUEURS);
  });

  test('6. `setParams` sur un ecran du parcours : adresse propre, objets gardes', () => {
    const existingComposition = { teams: [] };
    const { adapter, replace, setSearchParams } = fabriquer({
      params: { eventId: 'e1', existingComposition, pendingManualPlayer: { documentId: 'm1' } },
    });

    adapter.setParams({ pendingManualPlayer: undefined });

    expect(setSearchParams).not.toHaveBeenCalled();
    const [chemin, etat] = replace.mock.calls[0];
    expect(chemin).toBe('/match/call-up/select?eventId=e1');
    expect(chemin).not.toContain('object');
    const gardes = readCarriedWebParams(etat.carry);
    expect(gardes.existingComposition).toBe(existingComposition);
    expect(gardes.pendingManualPlayer).toBeUndefined();
  });

  test('7. `setParams` HORS du parcours : comportement d avant, inchange', () => {
    const { adapter, replace, setSearchParams } = fabriquer({
      currentRouteName: RouteNames.TeamList,
      params: { filtre: 'a' },
    });

    adapter.setParams({ filtre: 'b' });

    expect(replace).not.toHaveBeenCalled();
    expect(setSearchParams).toHaveBeenCalledWith({ filtre: 'b' });
  });

  test('8. `popTo` existe : il remplace l entree courante par la cible', () => {
    const { adapter, push, replace } = fabriquer();

    adapter.popTo(RouteNames.EventDetails, { eventId: 'e1' });

    expect(push).not.toHaveBeenCalled();
    const fiche = buildWebPath(RouteNames.EventDetails, { eventId: 'e1' });
    expect(replace).toHaveBeenCalledWith(fiche, undefined);
  });

  test('9. la memoire est bornee : les plus anciennes cles s oublient', () => {
    const { adapter, push } = fabriquer();

    for (let index = 0; index < 60; index += 1) {
      adapter.navigate(RouteNames.MatchCompositionBoard, {
        eventId: `e${index}`, selectedPlayers: JOUEURS,
      });
    }

    const premiere = push.mock.calls[0][1].carry;
    const derniere = push.mock.calls[59][1].carry;
    expect(readCarriedWebParams(premiere)).toBeNull();
    expect(readCarriedWebParams(derniere)).toEqual({ eventId: 'e59', selectedPlayers: JOUEURS });
  });

  test('10. une cle inconnue ou absente ne rend rien', () => {
    expect(readCarriedWebParams(undefined)).toBeNull();
    expect(readCarriedWebParams('inconnue')).toBeNull();
  });
});

// CORR-EVENEMENTS point 122 (recette du site, 30/10) — la carte d'une convocation en liste ouvre
// le plateau en lecture seule avec ses joueurs EN OBJETS : l'adresse les jetait, le plateau
// disait « 0/0 placés » avec un banc vide. Décision A : afficher les convoqués.
describe('CORR-EVENEMENTS 122 — le plateau en lecture seule garde ses convoqués', () => {
  test('🐞 vers TacticalBoardV2 (imbriqué), les joueurs voyagent en mémoire', () => {
    const { adapter, push } = fabriquer();
    const params = { eventId: 'e1', players: JOUEURS, readOnly: true };

    adapter.navigate(RouteNames.EventStack, { params, screen: RouteNames.TacticalBoardV2 });

    const [, etat] = push.mock.calls[0];
    expect(etat).toEqual({ carry: expect.any(String) });
    expect(readCarriedWebParams(etat.carry).players).toBe(JOUEURS);
  });
});
