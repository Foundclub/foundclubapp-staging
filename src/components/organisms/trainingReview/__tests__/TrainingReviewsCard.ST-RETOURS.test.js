import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainingReviewsCard, {
  MyTrainingReviewNote,
  peutRelireSaNote,
  repartirLesNotes,
} from '../TrainingReviewsCard';

// Le premier rendu charge l ecran entier : sous charge (les portes admin en parallele), il
// depasse les 5 s par defaut. Meme reglage que 93 temoins du depot.
jest.setTimeout(30000);

// ST-RETOURS (02/10) — PLANCHE 21 DU DESIGN VALIDE : « AVIS DES JOUEURS » SUR UNE SEANCE.
//
//   etat 1 — aucun avis : quand et combien de temps les joueurs peuvent noter ;
//   etat 2 — un seul avis : il s affiche (seuil 1, decision du 10/09), plus de « Il en faut 2 » ;
//   etat 3 — beaucoup d avis : la moyenne en grand, la repartition (une moyenne de 7 peut cacher
//            deux joueurs a 2), « 9 avis sur 14 présents », les notes sans mot regroupees ;
//   etat 4 — le joueur : jamais les avis des autres ; une ligne lui confirme SA note.
// L anonymat est dit partout.

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ part) => (
      noeud && typeof noeud === 'object' ? noeud[part] : undefined
    ),
    traductions,
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ a) => {
        const options = (a && typeof a === 'object') ? a : {};
        let valeur = typeof options.count === 'number'
          ? lire(`${cle}_${options.count === 1 ? 'one' : 'other'}`)
          : undefined;
        if (typeof valeur !== 'string') valeur = lire(cle);
        if (typeof valeur !== 'string') valeur = cle;
        return valeur.replace(/{{\s*(\w+)\s*}}/g, (_m, nom) => (
          options[nom] === undefined ? '' : String(options[nom])
        ));
      },
    }),
  };
});
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const fige = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => fige };
});

/**
 * Le texte d un noeud et de ses enfants, mis bout a bout.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/**
 * Rend un element et rend son arbre.
 * @param {any} element
 * @returns {any}
 */
const rendre = (element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  return arbre;
};

/**
 * Tout le texte visible, puis demonte.
 * @param {any} element
 * @returns {string}
 */
const texte = (element) => {
  const arbre = rendre(element);
  const sortie = arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children)).join(' | ');
  act(() => arbre.unmount());
  return sortie;
};

const avis = (rating, comment = null) => ({
  comment,
  rating,
  submittedAt: '2026-10-01T18:00:00.000Z',
});

describe('ST-RETOURS · planche 21 — la carte de l entraineur', () => {
  it('etat 1 — aucun avis : quand, combien de temps, et l anonymat', () => {
    const t = texte(<TrainingReviewsCard donnees={{ average: null, count: 0, presentCount: 2 }} />);

    expect(t).toContain('Avis des joueurs');
    expect(t).toContain('Aucun avis pour l’instant. Tes joueurs présents reçoivent l’invitation');
    expect(t).toContain('peuvent noter pendant 7 jours.');
    expect(t).toContain('Anonymes : tu vois les notes, jamais qui les a mises.');
  });

  it('etat 2 — un seul avis s affiche, « 1 avis sur 2 présents », sans « Il en faut 2 »', () => {
    const t = texte(<TrainingReviewsCard
      donnees={{
        average: 8,
        count: 1,
        presentCount: 2,
        reviews: [avis(8, 'Super séance, l’atelier de chutes était top.')],
        thresholdReached: true,
      }}
    />);

    expect(t).toContain('8');
    expect(t).toContain('1 avis sur 2 présents');
    expect(t).toContain('« Super séance, l’atelier de chutes était top. »');
    expect(t).not.toContain('Il en faut');
    expect(t).toContain('Anonymes : tu vois les notes, jamais qui les a mises.');
  });

  it('etat 3 — la moyenne en grand, la repartition, le taux de reponse, les notes sans mot', () => {
    const neuf = [
      avis(9, 'Super séance, l’atelier de passes était top.'), avis(10),
      avis(8), avis(7), avis(8), avis(7),
      avis(6), avis(5),
      avis(4, 'Trop d’attente entre les exercices.'),
    ];
    const arbre = rendre(<TrainingReviewsCard
      donnees={{
        average: 7.6, count: 9, presentCount: 14, reviews: neuf, thresholdReached: true,
      }}
    />);
    const t = arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children)).join(' | ');

    expect(t).toContain('7,6');
    expect(t).toContain('note moyenne sur 10');
    expect(t).toContain('9 avis sur 14 présents');
    expect(t).toContain('9/10 | Super séance, l’atelier de passes était top.');
    expect(t).toContain('4/10 | Trop d’attente entre les exercices.');
    expect(t).toContain('+ 7 notes sans commentaire');

    const repartition = arbre.root.findAll((n) => (
      n.props.testID === 'training-reviews-distribution' && typeof n.type === 'string'
    ))[0];
    expect(repartition.props.accessibilityLabel)
      .toBe('Répartition : 9 à 10, 2 avis ; 7 à 8, 4 avis ; 5 à 6, 2 avis ; 1 à 4, 1 avis');
    act(() => arbre.unmount());
  });

  it('la repartition par tranches : 9-10, 7-8, 5-6, 1-4', () => {
    expect(repartirLesNotes([avis(10), avis(9), avis(8), avis(5), avis(1), avis(4)])
      .map((tranche) => tranche.count)).toEqual([2, 1, 1, 2]);
  });

  it('un nombre de presents inconnu : seulement le nombre d avis', () => {
    const t = texte(<TrainingReviewsCard
      donnees={{
        average: 6, count: 2, reviews: [avis(6), avis(6)], thresholdReached: true,
      }}
    />);
    expect(t).toContain('2 avis');
    expect(t).not.toContain('présents');
  });
});

describe('ST-RETOURS · planche 21 etat 4 — le joueur', () => {
  it('il a note : « Tu as noté cette séance : 8/10 », et l anonymat avec le prenom', () => {
    const t = texte(<MyTrainingReviewNote review={avis(8, 'MOT')} trainerFirstname="Karim" />);

    expect(t).toContain('Tu as noté cette séance : 8/10');
    expect(t).toContain('Anonyme : Karim ne sait pas qui l’a mise.');
    expect(t).not.toContain('MOT');
  });

  it('pas encore note : rien', () => {
    const arbre = rendre(<MyTrainingReviewNote review={null} trainerFirstname="Karim" />);
    expect(arbre.toJSON()).toBeNull();
    act(() => arbre.unmount());
  });

  it('la porte : un MEMBRE qui n encadre pas, sur un entrainement termine', () => {
    expect(peutRelireSaNote({
      canEdit: false, isFinished: true, isTeamMember: true, isTraining: true,
    })).toBe(true);
    expect(peutRelireSaNote({
      canEdit: true, isFinished: true, isTeamMember: true, isTraining: true,
    })).toBe(false);
    expect(peutRelireSaNote({
      canEdit: false, isFinished: false, isTeamMember: true, isTraining: true,
    })).toBe(false);
    expect(peutRelireSaNote({
      canEdit: false, isFinished: true, isTeamMember: false, isTraining: true,
    })).toBe(false);
    expect(peutRelireSaNote(undefined)).toBe(false);
  });
});
