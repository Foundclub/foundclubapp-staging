import renderer, { act } from 'react-test-renderer';

import TrainingReviewsCard, {
  peutVoirLesAvisDEntrainement,
} from '../TrainingReviewsCard';

// LOT AVIS (E6) — TEMOIN CARACTERISANT : LE BLOC « AVIS DES JOUEURS ».
//
// Deux regles vivent ici, et aucune des deux ne se voit a la relecture :
//
//   1. LA PORTE. Ce bloc n existe que sur un ENTRAINEMENT TERMINE, et seulement
//      pour qui encadre. Les trois conditions sont une seule fonction, pour
//      qu on puisse la lire sans ouvrir les 8 000 lignes d EventDetails.
//
//   2. LE SEUIL. Sous deux avis, le serveur ne rend PAS la liste. L ecran doit
//      alors dire pourquoi il ne montre rien — et surtout ne pas inventer une
//      moyenne, qui vaudrait exactement l avis unique.
//
// ⚠️ Ce temoin ne mesure AUCUNE mise en page : `react-test-renderer` n en calcule
// pas. Il lit ce qui est ECRIT a l ecran. Le rendu se verifie sur l emulateur.
//
// ⚠️ Les assertions portent sur la CLEF choisie et sur les valeurs interpolees,
// jamais sur la copie francaise : la copie vit dans fr.js et peut changer sans
// que le comportement bouge. Ce qui doit rester vrai, c est QUELLE clef sort.

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: makeRamp(),
    }),
  };
});

// `t` rend la CLE **suivie de ses valeurs interpolees**, et c est indispensable :
// un double qui rend la seule clef laisse passer une note ou un compte qui
// n atteint jamais l ecran. Le projet a deja paye ce defaut (14 doubles de `t()`
// mentaient dans les temoins, 08/09). Il rend aussi le SUFFIXE de pluriel choisi
// (`_one` / `_other`), parce que `cle_plural` est morte depuis i18next 21 et
// qu une clef mal suffixee sort en clair a l ecran.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ options) => {
      if (!options || typeof options !== 'object') return cle;
      const suffixe = typeof options.count === 'number'
        ? `_${options.count === 1 ? 'one' : 'other'}`
        : '';
      const valeurs = Object.entries(options)
        .filter(([nom]) => nom !== 'defaultValue')
        .map(([nom, valeur]) => `${nom}=${String(valeur)}`)
        .join(' ');
      return valeurs ? `${cle}${suffixe} ${valeurs}` : `${cle}${suffixe}`;
    },
  }),
}));

/**
 * Rend la carte et rend tout le texte affiche, mis bout a bout.
 * @param {any} donnees - La reponse de la route, telle que l ecran la recoit.
 * @returns {string} - Le texte visible, concatene.
 */
const texteAffiche = (donnees) => {
  let arbre = null;
  act(() => {
    arbre = renderer.create(<TrainingReviewsCard donnees={donnees} />);
  });
  const rendu = arbre.root.findAllByType('Text', { deep: true });
  const morceaux = [];
  const collecter = (enfants) => {
    (Array.isArray(enfants) ? enfants : [enfants]).forEach((enfant) => {
      if (typeof enfant === 'string' || typeof enfant === 'number') morceaux.push(String(enfant));
      else if (enfant && enfant.props) collecter(enfant.props.children);
    });
  };
  rendu.forEach((noeud) => collecter(noeud.props.children));
  act(() => arbre.unmount());
  return morceaux.join(' | ');
};

// ---------------------------------------------------------------------------
// 1 — LA PORTE
// ---------------------------------------------------------------------------

describe('peutVoirLesAvisDEntrainement', () => {
  test('AVIS-APP/1 — les TROIS conditions sont necessaires', () => {
    expect(peutVoirLesAvisDEntrainement({
      canEdit: true, isFinished: true, isTraining: true,
    })).toBe(true);

    expect(peutVoirLesAvisDEntrainement({
      canEdit: true, isFinished: true, isTraining: false,
    })).toBe(false);
    expect(peutVoirLesAvisDEntrainement({
      canEdit: true, isFinished: false, isTraining: true,
    })).toBe(false);
    expect(peutVoirLesAvisDEntrainement({
      canEdit: false, isFinished: true, isTraining: true,
    })).toBe(false);
  });

  test('AVIS-APP/2 — l absence d information vaut NON, jamais OUI', () => {
    expect(peutVoirLesAvisDEntrainement({})).toBe(false);
    expect(peutVoirLesAvisDEntrainement(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 — LE SEUIL, A L ECRAN
// ---------------------------------------------------------------------------

describe('TrainingReviewsCard', () => {
  test('AVIS-APP/3 — sans avis, le message « vide » sort et aucune note ne s affiche', () => {
    const texte = texteAffiche({ average: null, count: 0, thresholdReached: false });

    expect(texte).toContain('eventDetails.trainingReview.empty');
    expect(texte).not.toContain('eventDetails.trainingReview.outOfTen');
    expect(texte).not.toContain('eventDetails.trainingReview.average');
  });

  test('AVIS-APP/4 — avec UN avis, la carte attend et ne montre NI note NI moyenne', () => {
    const texte = texteAffiche({
      average: null,
      count: 1,
      minimumReviews: 2,
      thresholdReached: false,
    });

    // La forme SINGULIERE, et les deux nombres qui atteignent vraiment l ecran.
    expect(texte).toContain('eventDetails.trainingReview.waiting_one');
    expect(texte).toContain('count=1');
    expect(texte).toContain('minimum=2');
    // Le serveur ne rend PAS `reviews` sous le seuil : la carte ne doit donc
    // afficher aucune note, ni la moyenne (qui vaudrait l avis unique). Si un
    // jour elle en affiche une, c est que quelqu un aura rebranche la liste —
    // et l anonymat tombera avec.
    expect(texte).not.toContain('eventDetails.trainingReview.outOfTen');
    expect(texte).not.toContain('eventDetails.trainingReview.average');
  });

  test('AVIS-APP/5 — des DEUX avis, la moyenne et les commentaires apparaissent', () => {
    const texte = texteAffiche({
      average: 7.5,
      count: 2,
      minimumReviews: 2,
      reviews: [
        { comment: 'Trop court', rating: 7, submittedAt: '2026-03-10T20:30:00.000Z' },
        { comment: null, rating: 8, submittedAt: '2026-03-10T20:35:00.000Z' },
      ],
      thresholdReached: true,
    });

    expect(texte).toContain('eventDetails.trainingReview.average');
    expect(texte).toContain('7.5');
    expect(texte).toContain('Trop court');
    expect(texte).toContain('rating=7');
    expect(texte).toContain('rating=8');
  });

  test('AVIS-APP/6 — un avis sans commentaire ne fabrique pas de ligne vide', () => {
    const texte = texteAffiche({
      average: 8,
      count: 2,
      minimumReviews: 2,
      reviews: [
        { comment: null, rating: 8, submittedAt: '2026-03-10T20:30:00.000Z' },
        { comment: '   ', rating: 8, submittedAt: '2026-03-10T20:35:00.000Z' },
      ],
      thresholdReached: true,
    });

    expect(texte).toContain('rating=8');
    // Le repli explicite, jamais un trou : deux avis sans commentaire donnent
    // deux fois « note laissee sans commentaire », pas deux lignes vides.
    expect(texte.split('eventDetails.trainingReview.noComment').length - 1).toBe(2);
    expect(texte).not.toContain('| undefined');
    expect(texte).not.toContain('| null');
  });

  test('AVIS-APP/9 — au pluriel, la forme « _other » sort (cle_plural est morte)', () => {
    const texte = texteAffiche({
      average: null,
      count: 0,
      minimumReviews: 3,
      thresholdReached: false,
    });

    // count 0 : c est le message « vide » qui sort, pas l attente.
    expect(texte).toContain('eventDetails.trainingReview.empty');

    const attente = texteAffiche({
      average: null,
      count: 2,
      minimumReviews: 3,
      thresholdReached: false,
    });
    expect(attente).toContain('eventDetails.trainingReview.waiting_other');
    expect(attente).toContain('count=2');
  });
});
