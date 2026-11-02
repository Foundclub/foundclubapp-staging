import { Alert, Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import useGardeDeSortie from '@/hooks/useGardeDeSortie';

// REPRISE-RESA (01/11/2026, point 81) — LA GARDE « QUITTER SANS ENREGISTRER ? ».
// 1. Ce qu'elle faisait déjà (témoin caractérisant, E6) : un Retour sur une saisie modifiée
//    (`beforeRemove`) demande ; « Quitter » rejoue la sortie ; rien quand la saisie est intacte.
// 2. Le site : ses liens (le menu) et la fermeture de l'onglet ne passent pas par
//    `beforeRemove` ; la garde les écoute sur la page, tant que la saisie est modifiée.

const SITE = 'https://staging.foundclub.app';

const TEXTES = {
  message: 'Tes changements ne sont pas enregistrés.',
  quitter: 'Quitter',
  rester: 'Rester',
  titre: 'Quitter sans enregistrer ?',
};

/**
 * Une fausse navigation : retient ses écouteurs et ses envois.
 * @returns {any} La navigation.
 */
const fausseNavigation = () => {
  /** @type {Record<string, Function>} */
  const ecouteurs = {};
  return {
    addListener: jest.fn((nom, rappel) => {
      ecouteurs[nom] = rappel;
      return () => {
        delete ecouteurs[nom];
      };
    }),
    dispatch: jest.fn(),
    ecouteurs,
  };
};

/**
 * Monte un écran qui pose la garde.
 * @param {any} navigation - La navigation.
 * @param {boolean} actif - La saisie est modifiée.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (navigation, actif) => {
  /**
   * L'écran du témoin.
   * @param {{ modifie: boolean }} props - La saisie est modifiée.
   * @returns {null} Rien.
   */
  function Ecran({ modifie }) {
    useGardeDeSortie(navigation, { actif: modifie, textes: TEXTES });
    return null;
  }
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Ecran modifie={actif} />);
  });
  return arbre;
};

/**
 * Une fausse page du site : `document` (clics, capturés) et `window` (départ, adresse).
 * @returns {any} La page.
 */
const faussePage = () => {
  /** @type {Record<string, Function>} */
  const surDocument = {};
  /** @type {Record<string, Function>} */
  const surFenetre = {};
  return {
    document: {
      addEventListener: jest.fn((nom, rappel, capture) => {
        if (capture === true) surDocument[nom] = rappel;
      }),
      removeEventListener: jest.fn((nom) => {
        delete surDocument[nom];
      }),
    },
    surDocument,
    surFenetre,
    window: {
      addEventListener: jest.fn((nom, rappel) => {
        surFenetre[nom] = rappel;
      }),
      location: {
        href: `${SITE}/mon-complexe/terrain/t-1/creneaux`,
        origin: SITE,
      },
      removeEventListener: jest.fn((nom) => {
        delete surFenetre[nom];
      }),
    },
  };
};

/**
 * Un clic sur un lien de la page.
 * @param {string} href - L'adresse du lien.
 * @returns {any} L'événement.
 */
const clicSurUnLien = (href) => {
  const lien = {
    click: jest.fn(), getAttribute: () => null, href, target: '',
  };
  return {
    altKey: false,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    lien,
    metaKey: false,
    preventDefault: jest.fn(),
    shiftKey: false,
    stopPropagation: jest.fn(),
    target: {
      closest: (/** @type {string} */ selecteur) => (selecteur === 'a[href]' ? lien : null),
    },
  };
};

describe('useGardeDeSortie — le téléphone (témoin caractérisant)', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saisie modifiée : un Retour demande, « Quitter » rejoue la sortie', async () => {
    const navigation = fausseNavigation();
    await monter(navigation, true);
    const action = { type: 'GO_BACK' };
    const evenement = { data: { action }, preventDefault: jest.fn() };
    navigation.ecouteurs.beforeRemove(evenement);
    expect(evenement.preventDefault).toHaveBeenCalled();
    const [titre, , boutons] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Quitter sans enregistrer ?');
    expect(boutons.map((/** @type {any} */ b) => b.text)).toEqual(['Rester', 'Quitter']);
    boutons[1].onPress();
    expect(navigation.dispatch).toHaveBeenCalledWith(action);
  });

  it('saisie intacte : le Retour passe sans question', async () => {
    const navigation = fausseNavigation();
    await monter(navigation, false);
    const evenement = { data: { action: {} }, preventDefault: jest.fn() };
    navigation.ecouteurs.beforeRemove(evenement);
    expect(evenement.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('useGardeDeSortie — le site (REPRISE-RESA 81)', () => {
  const plateforme = Platform.OS;
  /** @type {any} */
  let page;
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    Platform.OS = 'web';
    page = faussePage();
    global.document = page.document;
    global.window.addEventListener = page.window.addEventListener;
    global.window.removeEventListener = page.window.removeEventListener;
    global.window.location = page.window.location;
  });
  afterEach(() => {
    Platform.OS = plateforme;
    delete global.document;
    jest.restoreAllMocks();
  });

  it('un lien du site (le menu) : retenu, la question ; « Quitter » rejoue le clic', async () => {
    await monter(fausseNavigation(), true);
    const clic = clicSurUnLien(`${SITE}/mon-complexe/reservations`);
    page.surDocument.click(clic);
    expect(clic.preventDefault).toHaveBeenCalled();
    expect(clic.stopPropagation).toHaveBeenCalled();
    const [titre, , boutons] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Quitter sans enregistrer ?');
    boutons[1].onPress();
    expect(clic.lien.click).toHaveBeenCalled();
    // Le clic rejoué passe sans redemander.
    const rejoue = clicSurUnLien(`${SITE}/mon-complexe/reservations`);
    page.surDocument.click(rejoue);
    expect(rejoue.preventDefault).not.toHaveBeenCalled();
  });

  it('« Rester » : rien ne part, la saisie reste', async () => {
    await monter(fausseNavigation(), true);
    const clic = clicSurUnLien(`${SITE}/mon-complexe/reservations`);
    page.surDocument.click(clic);
    const [, , boutons] = Alert.alert.mock.calls[0];
    expect(boutons[0].onPress).toBeUndefined();
    expect(clic.lien.click).not.toHaveBeenCalled();
  });

  it('un lien vers un autre site, ou vers la même adresse : pas de question', async () => {
    await monter(fausseNavigation(), true);
    const dehors = clicSurUnLien('https://www.helloasso.com/');
    page.surDocument.click(dehors);
    const ici = clicSurUnLien(`${SITE}/mon-complexe/terrain/t-1/creneaux`);
    page.surDocument.click(ici);
    expect(dehors.preventDefault).not.toHaveBeenCalled();
    expect(ici.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('fermer ou recharger l’onglet : le navigateur demande (beforeunload)', async () => {
    await monter(fausseNavigation(), true);
    const depart = { preventDefault: jest.fn() };
    page.surFenetre.beforeunload(depart);
    expect(depart.preventDefault).toHaveBeenCalled();
  });

  it('saisie intacte, ou panneau sans navigation : la page n’est pas écoutée', async () => {
    await monter(fausseNavigation(), false);
    await monter(null, true);
    expect(page.surDocument.click).toBeUndefined();
    expect(page.surFenetre.beforeunload).toBeUndefined();
  });
});
