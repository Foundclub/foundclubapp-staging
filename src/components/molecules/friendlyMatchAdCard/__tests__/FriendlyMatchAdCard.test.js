import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchAdCard from '../FriendlyMatchAdCard';

// Filet D07 (E6) : cette carte n'avait AUCUN test alors qu'elle affiche les
// trois etats de `hostingPreference` — la donnee que tout le lot D07 tourne
// autour. Le lot la redessine sur l'anatomie de la carte evenement.
//
// Le domaine (`friendlyMatchFlow`) n'est PAS mocke : c'est lui qui deduit le
// tag lieu de la donnee, et c'est exactement ce qu'on veut verifier. Un mock
// ferait passer un test qui ne prouve rien.
//
// Deux etages : ce qui ne doit pas bouger, puis ce que D07 change.

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// LOT D41 ② — la copy de la carte est descendue dans `fr.js`. Le mock resout
// dans le VRAI catalogue et remplace les {{variables}} comme i18next : sans
// l'interpolation, « Voir les {{total}} proposition{{plural}} » s'afficherait tel
// quel et les temoins de pluriel de D07 decriraient un faux defaut.
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (
        /** @type {string} */ cle,
        /** @type {any} */ repli,
        /** @type {any} */ variables,
      ) => {
        const trouve = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let gabarit = cle;
        if (typeof trouve === 'string') gabarit = trouve;
        else if (typeof repli === 'string') gabarit = repli;
        if (!variables) return gabarit;
        return gabarit.replace(
          /{{(\w+)}}/g,
          (/** @type {any} */ _entier, /** @type {string} */ nom) => String(variables[nom] ?? ''),
        );
      },
    }),
  };
});

// react-native-reanimated est publie en ESM pur et n'est PAS dans
// transformIgnorePatterns : sans ce mock, importer la carte suffit a faire
// tomber la suite.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

// Le VRAI theme : un Proxy rendrait les echecs illisibles, et un objet invente
// masquerait un jeton absent.
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
      Images: {
        arrowLeft: 'icone-fleche-gauche',
        arrowRight: 'icone-fleche-droite',
        calendar: 'icone-calendrier',
        clock: 'icone-horloge',
        pin: 'icone-lieu',
        running: 'icone-coureur',
        stadium: 'icone-stade',
        trophy: 'icone-niveau',
      },
      Spaces: espaces,
    }),
  };
});

// Le blason a ses propres dependances (avatar, bouclier, initiales) : on garde
// sa TAILLE verifiable sans monter tout l'arbre.
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function BlasonMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, `temoin-blason:${props.size}`);
  };
});

const polices = require('@/theme/fonts').default(require('@/theme/colors').default());
// Charge ici, et pas dans le `describe` : un require() hors du premier niveau
// est une erreur `global-require`, que le cliquet de lint compte.
const catalogueFr = require('@/theme/strings/translations/fr').default;

/**
 * Une annonce complete, telle que le service la rend.
 * @param {any} [surcharges] Champs a remplacer.
 * @returns {any} L'annonce.
 */
const annonce = (surcharges = {}) => ({
  activity: { name: 'Basketball' },
  candidateDates: [{ date: '2027-08-06', end: '22:00', start: '20:00' }],
  category: { name: 'Sénior +18' },
  city: 'Marseille',
  documentId: 'ad-1',
  format: '5v5',
  hostingPreference: 'HOST',
  isActive: true,
  level: { name: 'Régional' },
  status: 'open',
  team: { club: { name: 'AS Endoume Basket' }, name: 'Seniors B' },
  ...surcharges,
});

/**
 * Rend la carte.
 * @param {any} [props] Props passees a la carte.
 * @returns {any} L'arbre rendu.
 */
const rendre = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      createElement(FriendlyMatchAdCard, { ad: annonce(), canApply: true, ...props }),
    );
  });
  return arbre;
};

/**
 * Tous les textes reellement affiches, dans l'ordre du rendu.
 * @param {any} arbre L'arbre rendu.
 * @returns {string[]} Les textes affiches.
 */
const textesVisibles = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Les noeuds d'affichage qui satisfont le predicat.
 * @param {any} arbre L'arbre rendu.
 * @param {(noeud: any) => boolean} predicat Le filtre.
 * @returns {any[]} Les noeuds retenus.
 */
const noeudsAffiches = (arbre, predicat) => {
  /** @type {any[]} */
  const trouves = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (!noeud || typeof noeud !== 'object') return;
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (predicat(noeud)) trouves.push(noeud);
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return trouves;
};

/**
 * Le style d'un noeud, aplati.
 * @param {any} noeud Un noeud d'affichage.
 * @returns {any} Le style aplati.
 */
const style = (noeud) => StyleSheet.flatten(noeud.props.style) || {};

/**
 * Les textes rendus sous un noeud.
 * @param {any} noeud Un noeud.
 * @returns {string[]} Les textes trouves dessous.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ courant) => {
    if (typeof courant === 'string') {
      sortie.push(courant);
      return;
    }
    if (courant && Array.isArray(courant.children)) courant.children.forEach(parcourir);
  };
  parcourir(noeud);
  return sortie;
};

/**
 * Le noeud d'affichage le plus profond qui porte exactement ce texte.
 * @param {any} arbre L'arbre rendu.
 * @param {string} texte Le texte cherche.
 * @returns {any} Le noeud trouve.
 */
const noeudDuTexte = (arbre, texte) => noeudsAffiches(
  arbre,
  (noeud) => textesSous(noeud).length === 1 && textesSous(noeud)[0] === texte,
).pop();

/**
 * Appuie sur l'element pressable qui affiche ce texte.
 * @param {any} arbre L'arbre rendu.
 * @param {string} texte Le libelle affiche.
 * @returns {void}
 */
const appuyerSurLeTexte = (arbre, texte) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud !== arbre.root
      && typeof noeud.props.onPress === 'function'
      && textesSous(noeud).includes(texte),
  )[0];
  act(() => cible.props.onPress());
};

describe('Carte d annonce amicale — CE QUI NE DOIT PAS BOUGER', () => {
  it('nomme le club, son equipe et son sport', () => {
    const affiches = textesVisibles(rendre()).join(' ');
    expect(affiches).toContain('AS Endoume Basket');
    expect(affiches).toContain('Seniors B');
    expect(affiches).toContain('Basketball');
  });

  // Trap ① du lot : les trois etats viennent de la DONNEE, pas d'un texte. Ce
  // test-ci ne fige AUCUN libelle — il figera l'invariant : trois valeurs de
  // `hostingPreference` produisent trois affichages DIFFERENTS, et l'absence de
  // valeur en produit un quatrieme. Il reste vrai des deux cotes du lot ; les
  // libelles eux-memes changent, et sont verifies plus bas.
  it('affiche un etat de lieu DIFFERENT pour chacune des trois valeurs', () => {
    const etats = ['HOST', 'AWAY', 'BOTH', ''].map((preference) => textesVisibles(
      rendre({ ad: annonce({ hostingPreference: preference }) }),
    ).join('|'));
    expect(new Set(etats).size).toBe(4);
  });

  it('propose un match quand le lecteur peut candidater', () => {
    expect(textesVisibles(rendre())).toContain('Proposer un match');
  });

  it.each([
    [{ status: 'matched' }, {}, 'Adversaire trouvé'],
    [{ isActive: false }, {}, 'Annonce clôturée'],
    [{}, { myApplicationStatus: 'accepted' }, 'Match confirmé'],
    [{}, { myApplicationStatus: 'pending' }, 'Proposition envoyée'],
    [{}, { myApplicationStatus: 'declined' }, 'Proposition refusée'],
    [{}, { isApplying: true }, 'Envoi...'],
    [{}, { canApply: false }, 'Réservé aux entraîneurs et dirigeants'],
  ])('garde l etat de candidature dans le bouton (%#)', (surchargeAd, props, attendu) => {
    const affiches = textesVisibles(rendre({ ad: annonce(surchargeAd), ...props }));
    expect(affiches).toContain(attendu);
  });

  it('ouvre le detail quand on appuie sur la carte', () => {
    const onPress = jest.fn();
    const arbre = rendre({ onPress });
    const fond = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
        && typeof noeud.props?.accessibilityHint === 'string'
        && noeud.props.accessibilityHint.includes('détail'),
    )[0];
    act(() => fond.props.onPress());
    expect(onPress).toHaveBeenCalledWith(annonce());
  });

  it('envoie la candidature depuis le bouton plein', () => {
    const onApply = jest.fn();
    const arbre = rendre({ onApply });
    appuyerSurLeTexte(arbre, 'Proposer un match');
    expect(onApply).toHaveBeenCalledWith(annonce());
  });

  it('montre au proprietaire l etat de son annonce et le nombre de propositions', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({ pendingApplicationsCount: 2 }),
      isOwner: true,
    }));
    expect(affiches).toContain('En ligne');
    expect(affiches.join(' ')).toContain('2 propositions');
  });

  it('accorde le singulier a une seule proposition', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({ pendingApplicationsCount: 1 }),
      isOwner: true,
    })).join(' ');
    expect(affiches).toContain('1 proposition');
    expect(affiches).not.toContain('1 propositions');
  });

  it('ne propose jamais de candidater a sa propre annonce', () => {
    const affiches = textesVisibles(rendre({ isOwner: true }));
    expect(affiches).not.toContain('Proposer un match');
  });
});

describe('Carte d annonce amicale — CE QUE D07 CHANGE', () => {
  // ③ Le nom du club, jamais tronque : deux fois dans le pack, donc deux tests.
  const NOM_LONG = 'Association Sportive et Culturelle de Marseille Endoume Basket';

  // Le libelle COURT des surfaces compactes : sur une carte, le club est nomme
  // trois lignes plus haut, « Il » y serait redondant. Le detail et le recap
  // gardent la phrase longue de getHostingSummary. Le domaine n'est pas mocke :
  // c'est bien la chaine donnee -> affichage qui est verifiee, sur les 3 etats.
  it.each([
    ['HOST', 'Reçoit'],
    ['AWAY', 'Se déplace'],
    ['BOTH', 'Reçoit ou se déplace'],
  ])('ecrit le tag court de hostingPreference=%s', (preference, libelle) => {
    const affiches = textesVisibles(rendre({ ad: annonce({ hostingPreference: preference }) }));
    expect(affiches).toContain(libelle);
  });

  it('dit « À convenir » quand l annonce ne porte aucun etat de lieu', () => {
    const affiches = textesVisibles(rendre({ ad: annonce({ hostingPreference: '' }) }));
    expect(affiches).toContain('À convenir');
  });

  it('n ecrit plus le tag lieu en capitales', () => {
    const arbre = rendre();
    const tag = noeudDuTexte(arbre, 'Reçoit');
    expect(tag).toBeDefined();
    expect(style(tag).textTransform).toBeUndefined();
  });

  it('affiche un nom de club long EN ENTIER', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({ team: { club: { name: NOM_LONG }, name: 'Seniors B' } }),
    }));
    expect(affiches).toContain(NOM_LONG);
  });

  it('ne coupe le nom du club : ni nombre de lignes, ni ellipse, ni capitales', () => {
    const arbre = rendre({
      ad: annonce({ team: { club: { name: NOM_LONG }, name: 'Seniors B' } }),
    });
    const nom = noeudDuTexte(arbre, NOM_LONG);
    expect(nom).toBeDefined();
    expect(nom.props.numberOfLines).toBeUndefined();
    expect(nom.props.ellipsizeMode).toBeUndefined();
    expect(style(nom).textTransform).toBeUndefined();
  });

  // ② Le tag lieu est SOUS le nom, jamais sur la meme ligne : un nom long
  // l'ecrase. L'ordre de lecture est aussi celui du lecteur d'ecran.
  it('place le tag lieu APRES le nom et sa sous-ligne, jamais a cote', () => {
    const affiches = textesVisibles(rendre());
    expect(affiches.indexOf('AS Endoume Basket')).toBeLessThan(affiches.indexOf('Reçoit'));
    expect(affiches.findIndex((texte) => texte.includes('Basketball')))
      .toBeLessThan(affiches.indexOf('Reçoit'));
  });

  // D41 ③ — « Se deplace » porte une FLECHE, plus un coureur (arbitrage Adel du
  // 2026-08-08). La derniere ligne est la moitie qui compte : le coureur doit
  // avoir disparu des DEUX surfaces, pas seulement de l une.
  it('donne au tag lieu son icone, en plus de son libelle', () => {
    const sources = (preference) => noeudsAffiches(
      rendre({ ad: annonce({ hostingPreference: preference }) }),
      (noeud) => typeof noeud.props?.source === 'string',
    ).map((noeud) => noeud.props.source);

    expect(sources('HOST')).toContain('icone-stade');
    expect(sources('AWAY')).toContain('icone-fleche-droite');
    expect(sources('BOTH')).toContain('icone-fleche-droite');
    expect(sources('BOTH')).toContain('icone-fleche-gauche');
    expect(sources('AWAY')).not.toContain('icone-coureur');
  });

  // Une fleche contre deux fleches empilees : c est ce qui empeche « Se
  // deplace » et « Recoit ou se deplace » de se confondre depuis qu ils
  // partagent le meme dessin.
  it('distingue « Se deplace » de « Les deux » par le NOMBRE de fleches', () => {
    const fleches = (preference) => noeudsAffiches(
      rendre({ ad: annonce({ hostingPreference: preference }) }),
      (noeud) => String(noeud.props?.source || '').startsWith('icone-fleche'),
    ).length;

    expect(fleches('AWAY')).toBe(1);
    expect(fleches('BOTH')).toBe(2);
  });

  it('rend le tag en contour, pas en banniere pleine largeur', () => {
    const arbre = rendre();
    const tag = noeudsAffiches(
      arbre,
      (noeud) => textesSous(noeud).includes('Reçoit') && style(noeud).borderWidth === 1.5,
    ).pop();
    expect(tag).toBeDefined();
    expect(style(tag).alignSelf).toBe('flex-start');
  });

  it('reprend le blason de 40 pt de la carte evenement', () => {
    expect(textesVisibles(rendre())).toContain('temoin-blason:40');
  });

  // Deux rangees meta a icones : lieu + niveau, puis date + heure.
  it('range les quatre informations en deux rangees a icones', () => {
    const arbre = rendre();
    const affiches = textesVisibles(arbre).join(' ');
    expect(affiches).toContain('Marseille');
    expect(affiches).toContain('Régional');
    expect(affiches).toContain('20:00-22:00');

    const sources = noeudsAffiches(arbre, (noeud) => typeof noeud.props?.source === 'string')
      .map((noeud) => noeud.props.source);
    expect(sources).toContain('icone-lieu');
    expect(sources).toContain('icone-niveau');
    expect(sources).toContain('icone-calendrier');
    expect(sources).toContain('icone-horloge');
  });

  it('dit « à convenir » plutot que rien quand la date ou l heure manque', () => {
    const affiches = textesVisibles(rendre({ ad: annonce({ candidateDates: [] }) })).join(' ');
    expect(affiches).toContain('Dates à convenir');
    expect(affiches).toContain('Heure à convenir');
  });

  it('signale les dates suivantes sans les etaler', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({
        candidateDates: [
          { date: '2027-08-06', end: '22:00', start: '20:00' },
          { date: '2027-08-09' },
          { date: '2027-08-12' },
        ],
      }),
    })).join(' ');
    expect(affiches).toContain('+2');
  });

  // Boutons en pied 44 pt — cible tactile minimale, arbitrage Adel du 20/07.
  it('donne 44 pt a chaque bouton de pied', () => {
    const arbre = rendre();
    ['Proposer un match', 'Voir'].forEach((libelle) => {
      const bouton = noeudsAffiches(
        arbre,
        (noeud) => textesSous(noeud).includes(libelle) && style(noeud).minHeight === 44,
      ).pop();
      expect(bouton).toBeDefined();
    });
  });

  // Un refus tronque est un refus muet (famille de defauts du lot L10-B) : le
  // bouton grandit, il ne coupe pas. Le libelle le plus long du fichier sert
  // de temoin — c'est celui qui cohabite avec « Voir » dans la meme rangee.
  it('ne tronque pas la raison d un refus, meme a cote de « Voir »', () => {
    const arbre = rendre({ canApply: false });
    const refus = noeudDuTexte(arbre, 'Réservé aux entraîneurs et dirigeants');
    expect(refus).toBeDefined();
    expect(refus.props.numberOfLines).toBeUndefined();
    expect(textesVisibles(arbre)).toContain('Voir');
  });

  it('offre « Voir » a cote de « Proposer un match » sur l annonce d un autre', () => {
    const onPress = jest.fn();
    const arbre = rendre({ onPress });
    expect(textesVisibles(arbre)).toContain('Voir');
    appuyerSurLeTexte(arbre, 'Voir');
    expect(onPress).toHaveBeenCalledWith(annonce());
  });

  it('propose de modifier son annonce quand personne n a encore repondu', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({ pendingApplicationsCount: 0 }),
      isOwner: true,
    }));
    expect(affiches).toContain('Modifier l’annonce');
    expect(affiches.join(' ')).not.toContain('Voir les');
  });

  it('met les propositions recues en avant des qu il y en a', () => {
    const affiches = textesVisibles(rendre({
      ad: annonce({ pendingApplicationsCount: 3 }),
      isOwner: true,
    }));
    expect(affiches).toContain('Voir les 3 propositions');
    expect(affiches).toContain('Modifier');
  });

  // Les deux actions du proprietaire ouvrent son annonce : c'est la que vivent
  // « Reposter avec de nouvelles dates » et « Annuler l'annonce ». Pas de
  // second chemin invente pour un ecran d'edition qui n'existe pas.
  it.each([
    [0, 'Modifier l’annonce'],
    [3, 'Voir les 3 propositions'],
    [3, 'Modifier'],
  ])('ouvre son annonce depuis « %s » (%i proposition(s))', (nombre, libelle) => {
    const onPress = jest.fn();
    const adDuProprietaire = annonce({ pendingApplicationsCount: nombre });
    const arbre = rendre({ ad: adDuProprietaire, isOwner: true, onPress });
    appuyerSurLeTexte(arbre, libelle);
    expect(onPress).toHaveBeenCalledWith(adDuProprietaire);
  });

  it('ecrit le nom du club et la sous-ligne dans des jetons de la rampe', () => {
    const arbre = rendre();
    expect(style(noeudDuTexte(arbre, 'AS Endoume Basket')).fontSize)
      .toBe(polices.p2Black.fontSize);
    expect(style(noeudDuTexte(arbre, 'Seniors B · Basketball · Sénior +18 · 5v5')).fontSize)
      .toBe(polices.small.fontSize);
  });
});

// Le filet du rapatriement D41 ②. Les 38 tests ci-dessus prouvent que le texte
// AFFICHE n'a pas bouge — ils passeraient encore si toutes les clefs manquaient,
// puisque chaque repli porte le meme texte. Celui-ci prouve l'autre moitie : la
// copy EXISTE dans `fr.js`, au caractere pres. `toEqual` sur le sous-arbre
// entier attrape aussi bien une clef oubliee qu'une clef reformulee.
describe('D41 ② — la copy de la carte vit dans fr.js, mot pour mot', () => {
  it('porte les 28 textes de la carte, sans en reformuler un seul', () => {
    expect(catalogueFr.friendlyMatch.adCard).toEqual({
      accessibilityHint: 'Ouvrir le détail de l\'annonce',
      accessibilityLabelPrefix: 'Match amical',
      applications: '{{total}} proposition{{plural}}',
      cta: {
        apply: 'Proposer un match',
        applying: 'Envoi...',
        closed: 'Annonce clôturée',
        confirmed: 'Match confirmé',
        declined: 'Proposition refusée',
        matched: 'Adversaire trouvé',
        pending: 'Proposition envoyée',
        staffOnly: 'Réservé aux entraîneurs et dirigeants',
      },
      distance: 'à {{km}} km',
      edit: 'Modifier',
      editAd: 'Modifier l’annonce',
      fallback: {
        category: 'Catégorie libre',
        club: 'Club inconnu',
        dates: 'Dates à convenir',
        format: 'Format à convenir',
        level: 'Niveau libre',
        place: 'Lieu non précisé',
        sport: 'Football',
        time: 'Heure à convenir',
      },
      seeApplications: 'Voir les {{total}} proposition{{plural}}',
      status: {
        closed: 'Clôturée',
        matched: 'Match trouvé',
        online: 'En ligne',
      },
      timeFrom: 'dès {{start}}',
      view: 'Voir',
    });
  });
});
