import {
  getOnboardingViews,
  resolveAffiliationOriginRoute,
  resolveNextOnboardingRoute,
  resolveOnboardingExitRoute,
  USER_ROLES,
} from '@/domains/auth/authUseCases';
import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

// D33 — recette d'Adel du 2026-08-07, ses mots : « Cette etape ne sert a rien,
// car juste avant j'ai deja fait la demande pour rejoindre une equipe. Il faut
// que des qu'on trouve son club, on cherche son equipe et on fait la demande ;
// a partir du moment ou on fait la demande, il faut changer d'ecran pour
// valider l'inscription. » Capture : « Trouve ton equipe », etape 13/13.
//
// LA CAUSE, mesuree : `TeamDetails` demandait la suite du tunnel depuis
// `UserAffiliationGuide` — l'etape CLUB (12) — alors que le joueur venait de
// l'etape EQUIPE (13). La suite de 12 etant 13, l'envoi de la demande le
// reposait sur « Trouve ton equipe ». C'etait juste AVANT D16, quand un seul
// ecran portait les deux phases ; D16 a fait de l'equipe une etape comptee a
// part, et cette constante en dur est restee sur l'ancienne carte.
//
// CE QUE MESURE CE FICHIER — le trajet ENTIER, avec les vraies fonctions de
// production, sans monter un seul ecran :
//   club (12) -> equipe (13) -> demande envoyee -> SAS `Welcome`.
// `resolveNextOnboardingRoute` est le coeur de `useAuth.getNextOnboardingRoute`,
// extrait ici tel quel (meme sortie, meme ordre) pour la meme raison que D23
// avait extrait `resolveOnboardingExitRoute` : la decision vivait dans un hook,
// donc hors de portee d'un test.

jest.mock('../../store/appContext', () => ({
  storage: {
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

/** Profil de joueur complet : il ne reste que les deux etapes d'affiliation. */
const joueurPresqueFini = () => ({
  address: 'Marseille',
  avatar: 'avatar.png',
  bestLevel: 'Departemental',
  birthdate: '2000-01-01',
  category: 'Senior',
  documentId: 'user-d33',
  firstname: 'Ada',
  height: 180,
  lastname: 'Test',
  position: 'Avant-centre',
  preferredSport: 'football',
  role: { name: USER_ROLES.player },
  section: { documentId: 'section-doc', name: 'Masculine' },
  sportsHistory: 'Rien',
  weight: 70,
});

/**
 * Le trajet reel : ce que `useAuth.getNextOnboardingRoute` rend pour une etape.
 * Meme enchainement que la production — d'abord l'etape suivante du parcours,
 * sinon le sas d'arrivee.
 * @param {string} currentRoute - L'etape d'ou l'on part.
 * @param {{ canShow: boolean, index: number, route: string }[]} views - Le parcours.
 * @param {string} [userDocumentId] - L'identifiant du profil.
 * @returns {string | undefined} - L'etape suivante, ou le sas, ou rien.
 */
const etapeSuivante = (currentRoute, views, userDocumentId = 'user-d33') => (
  resolveNextOnboardingRoute({ currentRoute, views })
  ?? resolveOnboardingExitRoute({ hasSeenWelcome: false, userDocumentId, views })
);

beforeEach(() => {
  jest.clearAllMocks();
  /** @type {any} */ (storage.getBoolean).mockReturnValue(false);
});

describe('D33 — trouver son club enchaine sur son equipe, et la demande termine l\'inscription', () => {
  it('trouver son club enchaine IMMEDIATEMENT sur « Trouve ton equipe »', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    expect(etapeSuivante(RouteNames.UserAffiliationGuide, views))
      .toBe(RouteNames.UserTeamAffiliation);
  });

  // LE TEMOIN D'ARRET DU LOT. Il tombe des qu'on repose l'etape equipe.
  it('depuis l\'etape equipe, la suite est le SAS — jamais « Trouve ton equipe »', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    const apresLaDemande = etapeSuivante(RouteNames.UserTeamAffiliation, views);

    expect(apresLaDemande).toBe(RouteNames.Welcome);
    expect(apresLaDemande).not.toBe(RouteNames.UserTeamAffiliation);
  });

  // C'EST LE DEFAUT LUI-MEME, ecrit comme une mesure : partir de l'etape CLUB
  // apres une demande d'EQUIPE ramene sur l'ecran qu'on vient de quitter.
  // Ce test ne dit pas « le code est bon », il dit « voila pourquoi la
  // constante en dur de TeamDetails etait fausse ».
  it('partir de l\'etape club apres une demande d\'equipe RAMENE sur l\'etape equipe', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    expect(etapeSuivante(RouteNames.UserAffiliationGuide, views))
      .toBe(RouteNames.UserTeamAffiliation);
  });

  it('le trajet complet du joueur : club -> equipe -> sas, sans repasser deux fois', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    /** @type {string[]} */
    const trajet = [];
    let etape = RouteNames.UserAffiliationGuide;
    // Borne haute volontaire : si le tunnel bouclait, le test s'arreterait ici
    // au lieu de figer Jest — et le `toEqual` ci-dessous le dirait.
    // On s'arrete au SAS : `Welcome` n'appartient pas au parcours numerote, lui
    // redemander une suite recommencerait le tunnel a sa premiere etape.
    for (let pas = 0; pas < 5 && etape && etape !== RouteNames.Welcome; pas += 1) {
      trajet.push(etape);
      etape = /** @type {any} */ (etapeSuivante(etape, views));
    }
    trajet.push(etape);

    expect(trajet).toEqual([
      RouteNames.UserAffiliationGuide,
      RouteNames.UserTeamAffiliation,
      RouteNames.Welcome,
    ]);
  });
});

describe('D33 — l\'etape d\'ou l\'on vient est LUE, elle n\'est plus supposee', () => {
  it('l\'etape equipe est conservee telle quelle', () => {
    expect(resolveAffiliationOriginRoute({ onboardingOriginRoute: RouteNames.UserTeamAffiliation }))
      .toBe(RouteNames.UserTeamAffiliation);
  });

  it('l\'etape club est conservee telle quelle', () => {
    expect(resolveAffiliationOriginRoute({
      onboardingOriginRoute: RouteNames.UserAffiliationGuide,
    })).toBe(RouteNames.UserAffiliationGuide);
  });

  // Ces trois cas gardent EXACTEMENT le comportement d'avant D33 : les ecrans
  // qui ne passent rien (`ClubDetails`, `ClubWizardRecap`) continuent de partir
  // de l'etape club, qui est bien la leur.
  it('sans parametre, on repart de l\'etape club — le comportement d\'avant D33', () => {
    expect(resolveAffiliationOriginRoute(undefined)).toBe(RouteNames.UserAffiliationGuide);
    expect(resolveAffiliationOriginRoute({})).toBe(RouteNames.UserAffiliationGuide);
  });

  // FRONTIERE DE CONFIANCE : ce parametre vient de la navigation. Sans ce
  // garde-fou, une valeur inconnue donnerait `currentIndex = 0` a la recherche
  // d'etape suivante, qui rendrait alors la PREMIERE etape du parcours : le
  // tunnel entier recommencerait au lieu de se terminer.
  it('une etape inconnue ne fait PAS recommencer le tunnel', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    expect(resolveAffiliationOriginRoute({ onboardingOriginRoute: 'EcranQuiNExistePas' }))
      .toBe(RouteNames.UserAffiliationGuide);
    // La demonstration du danger evite : sans le repli, une etape inconnue
    // renvoyait la PREMIERE etape encore affichable du parcours — le tunnel
    // repartait de son debut. On la calcule ici plutot que de la citer, pour
    // que ce test ne mente pas si le parcours change.
    const premiereEtape = views.find((view) => view.canShow)?.route;
    expect(resolveNextOnboardingRoute({ currentRoute: 'EcranQuiNExistePas', views }))
      .toBe(premiereEtape);
  });
});

// D33 / decision 2 — « Que se passe-t-il si l'utilisateur trouve son club mais
// PAS son equipe ? » Adel : « Il ne doit jamais rester coince. »
// Les deux sorties de l'etape equipe (« Passer », et l'envoi du formulaire
// « ce club n'a pas encore d'equipe ») appellent la MEME decision, avec
// l'etape equipe pour origine. Elles menent donc au sas, jamais nulle part.
describe('D33 — club trouve, equipe absente : aucune impasse', () => {
  it('le joueur qui ne trouve pas son equipe sort quand meme vers le sas', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    expect(etapeSuivante(RouteNames.UserTeamAffiliation, views)).toBe(RouteNames.Welcome);
  });

  // Cas limite reel : le joueur a DEJA une equipe. L'etape equipe existe alors
  // au parcours mais `canShow` est faux — elle n'est pas montee. Sortir depuis
  // l'etape club doit mener au sas, sans jamais viser un ecran absent.
  it('joueur deja affilie a une equipe : l\'etape equipe n\'est pas montee, la sortie reste le sas', () => {
    const { views } = getOnboardingViews({
      ...joueurPresqueFini(),
      myTeams: [{ documentId: 'team-1' }],
    });

    const etapeEquipe = views.find((view) => view.route === RouteNames.UserTeamAffiliation);
    expect(etapeEquipe?.canShow).toBe(false);
    expect(etapeSuivante(RouteNames.UserAffiliationGuide, views)).toBe(RouteNames.Welcome);
  });

  // Sans documentId, `resolveOnboardingExitRoute` rend `undefined` : les ecrans
  // terminent alors le tunnel (`markOnboardingComplete` + retour a l'accueil).
  // C'est une SORTIE, pas un blocage — on le fige pour que ca le reste.
  it('meme sans profil identifie, l\'etape equipe ne renvoie jamais sur elle-meme', () => {
    const { views } = getOnboardingViews(joueurPresqueFini());

    expect(etapeSuivante(RouteNames.UserTeamAffiliation, views, undefined))
      .not.toBe(RouteNames.UserTeamAffiliation);
  });
});

// D33 / decision 5 — « Le dirigeant et l'entraineur sont-ils concernes ? »
// Non, et ce n'est pas une opinion : l'etape equipe n'existe pas chez eux, et
// leur sortie d'affiliation part bien de l'etape club, qui est la leur.
describe('D33 — les parcours staff ne bougent pas', () => {
  it('l\'entraineur enchaine du club vers « Equipes entrainees »', () => {
    const { views } = getOnboardingViews({
      address: 'Lyon',
      avatar: 'a.png',
      birthdate: '1990-01-01',
      documentId: 'coach-d33',
      firstname: 'Coach',
      lastname: 'Test',
      role: { name: USER_ROLES.coach },
    });

    expect(etapeSuivante(RouteNames.UserAffiliationGuide, views, 'coach-d33'))
      .toBe(RouteNames.UserTrainedTeams);
  });

  it('le dirigeant sort du club vers le sas', () => {
    const { views } = getOnboardingViews({
      address: 'Lille',
      avatar: 'a.png',
      documentId: 'president-d33',
      firstname: 'Diri',
      lastname: 'Geant',
      role: { name: USER_ROLES.president },
    });

    expect(etapeSuivante(RouteNames.UserAffiliationGuide, views, 'president-d33'))
      .toBe(RouteNames.Welcome);
  });
});

// D33 / decision 4 — LES TOTAUX NE BOUGENT PAS. Ce lot ne retire aucune etape :
// il corrige un ENCHAINEMENT. Le prompt annoncait un changement de totaux ; la
// mesure le contredit, et ce test fige les chiffres pour qu'un lot suivant ne
// les fasse pas glisser en silence.
describe('D33 — les 5 totaux restent 13 · 5 · 4 · 3 · 13', () => {
  it.each([
    [USER_ROLES.player, 13],
    [USER_ROLES.coach, 5],
    [USER_ROLES.president, 4],
    [USER_ROLES.superAdmin, 3],
    [USER_ROLES.new, 13],
  ])('role %s : %i etapes', (roleName, total) => {
    expect(getOnboardingViews({ role: { name: roleName } }).totalViews).toBe(total);
  });
});
