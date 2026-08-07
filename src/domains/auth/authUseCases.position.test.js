import { getOnboardingViews, USER_ROLES } from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

import { SPORTS_WITH_POSITIONS } from '@/constants/positions';

// D23 — defaut (2) de la recette du 2026-08-07 : « a l'inscription, choisir
// Rugby puis avancer, l'etape Poste ne s'affiche pas ».
//
// Trois portes de sortie existaient dans `getOnboardingViews` :
//   (a) un poste est deja enregistre
//   (b) aucun sport n'est encore choisi
//   (c) le sport choisi n'a pas de postes
//
// C'est (b) qui se declenchait, et pas pour la raison qu'on croit : au moment
// ou l'utilisateur est SUR l'etape Sport, son profil n'a pas encore de sport.
// L'etape Poste sortait donc du programme — et `PrivateNavigator` ne monte que
// les ecrans du programme. L'ecran Sport calculait bien « la suite = Poste »,
// mais la route n'existait pas dans le navigateur : `resolveAvailableRoute`
// retombait sur l'ecran suivant MONTE, c'est-a-dire « Physique ».
// Le defaut n'avait donc rien de specifique au rugby : il valait pour les 5
// sports a postes.
//
// (a) meritait sa propre question, posee par le prompt : un poste de football
// garde apres passage au rugby n'a aucun sens. Il est desormais redemande.

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// Noms tels que la collection Activity de Strapi les publie (majuscule initiale).
const SPORTS_A_POSTES = ['Football', 'Basketball', 'Handball', 'Volleyball', 'Rugby'];

const joueur = (overrides) => ({
  avatar: null,
  birthdate: '2000-01-01',
  documentId: 'user-d23',
  firstname: 'Ada',
  lastname: 'Test',
  role: { name: USER_ROLES.player },
  ...overrides,
});

const positionStep = (user) => getOnboardingViews(user)
  .views
  .find((view) => view.route === RouteNames.UserPosition);

beforeEach(() => {
  jest.clearAllMocks();
  storage.getBoolean.mockReturnValue(false);
  storage.getString.mockReturnValue(null);
});

describe('Etape Poste — les 5 sports a postes (D23 (2))', () => {
  it('la liste testee est bien celle du code, pas une copie qui derive', () => {
    expect(SPORTS_A_POSTES.map((sport) => sport.toLowerCase()).sort())
      .toEqual([...SPORTS_WITH_POSITIONS].sort());
  });

  it.each(SPORTS_A_POSTES)(
    '%s sans poste enregistre : l`etape Poste est au programme',
    (preferredSport) => {
      expect(positionStep(joueur({ preferredSport }))?.canShow).toBe(true);
    },
  );

  it.each(SPORTS_A_POSTES)(
    '%s : la majuscule initiale de Strapi ne fait pas sauter l`etape',
    (preferredSport) => {
      expect(positionStep(joueur({ preferredSport: preferredSport.toLowerCase() }))?.canShow)
        .toBe(true);
    },
  );

  it('un sport sans postes sort l`etape du programme (porte (c), inchangee)', () => {
    expect(positionStep(joueur({ preferredSport: 'Tennis' }))?.canShow).toBe(false);
  });
});

describe('Etape Poste — tant que le sport n`est pas repondu (D23 (2), la vraie cause)', () => {
  it('sport encore inconnu : l`etape reste au programme, donc MONTEE', () => {
    // C'ETAIT LE DEFAUT. `PrivateNavigator` monte ses ecrans sur `canShow` :
    // a `false`, l'ecran Poste n'existe pas dans le navigateur au moment ou
    // l'ecran Sport veut y aller. On ne peut pas savoir si les postes
    // s'appliquent avant que le sport soit repondu : on garde l'etape.
    expect(positionStep(joueur({ preferredSport: null }))?.canShow).toBe(true);
  });

  it('l`etape Sport et l`etape Poste sont montees ensemble', () => {
    const { views } = getOnboardingViews(joueur({ preferredSport: null }));
    const sportStep = views.find((view) => view.route === RouteNames.UserSport);

    expect(sportStep?.canShow).toBe(true);
    expect(views.find((view) => view.route === RouteNames.UserPosition)?.canShow).toBe(true);
  });

  it('le total du parcours joueur ne bouge pas : toujours 13', () => {
    expect(getOnboardingViews(joueur({ preferredSport: null })).totalViews).toBe(13);
    expect(getOnboardingViews(joueur({ preferredSport: 'Rugby' })).totalViews).toBe(13);
  });
});

describe('Etape Poste — un poste deja enregistre (porte (a))', () => {
  it('un poste coherent avec le sport ne se redemande pas', () => {
    expect(positionStep(joueur({ position: 'Pilier, Talonneur', preferredSport: 'Rugby' }))?.canShow)
      .toBe(false);
  });

  it('un poste de football garde apres passage au rugby SE REDEMANDE', () => {
    // La question posee par la recette : « un poste de football n'a aucun sens
    // en rugby ». Sauter l'etape laisserait le profil incoherent, sans aucun
    // moyen de le corriger dans le tunnel.
    expect(positionStep(joueur({ position: 'Avant-centre', preferredSport: 'Rugby' }))?.canShow)
      .toBe(true);
  });

  it('un poste partiellement etranger au sport suffit a redemander l`etape', () => {
    expect(positionStep(joueur({ position: 'Pilier, Avant-centre', preferredSport: 'Rugby' }))
      ?.canShow).toBe(true);
  });

  it('un poste enregistre sans sport ne bloque pas l`etape', () => {
    expect(positionStep(joueur({ position: 'Attaquant', preferredSport: null }))?.canShow)
      .toBe(true);
  });
});
