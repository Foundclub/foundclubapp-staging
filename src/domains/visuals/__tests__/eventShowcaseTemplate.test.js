import {
  EVENT_SHOWCASE_FALLBACK_TEMPLATE,
  getEventShowcaseShareIntro,
  getEventShowcaseTemplate,
  isEventShowcaseOffered,
} from '../eventShowcaseTemplate';
import { SHOWCASE_TEMPLATES } from '../useEventShowcase';

// `useEventShowcase` importe la couche plateforme de rendu (react-native-blob-util),
// que jest ne transforme pas. Ce test ne parle QUE de catalogues : on la neutralise.
jest.mock('@/platform/visualRender', () => ({
  downloadAndShareRender: jest.fn(),
  fetchRenderBase64: jest.fn(),
}));

// X01 (2026-08-19) — CHAQUE TYPE D'ÉVÉNEMENT MÈNE À SON AFFICHE.
//
// 🧨 CE QUE CE FICHIER VERROUILLE, ET POURQUOI IL N'EXISTAIT PAS : jusqu'au
// 2026-08-19, `getEventShowcaseTemplate` rendait la MÊME valeur pour les 7 types
// (`affiche-detection`), et aucun test ne le disait. Un club qui partageait
// l'affiche de son match envoyait donc l'invitation d'une détection — le texte
// avait été corrigé par D94, le DESSIN non.
//
// ⛔ Le témoin de non-régression est le second : la détection est le SEUL type
// qui marchait déjà. Elle ne doit jamais bouger.

describe('getEventShowcaseTemplate — 🎯 le type choisit le gabarit', () => {
  // LE TÉMOIN PRINCIPAL DU LOT, en trois assertions.
  it('un MATCH rend G1, un TOURNOI rend G2, un STAGE et un type INCONNU rendent G3', () => {
    expect(getEventShowcaseTemplate('Match')).toBe('affiche-match');
    expect(getEventShowcaseTemplate('Tournoi')).toBe('affiche-tournoi');
    expect(getEventShowcaseTemplate('Stage')).toBe('affiche-evenement');
    expect(getEventShowcaseTemplate('Kermesse du club')).toBe('affiche-evenement');
  });

  // 🔒 NON-RÉGRESSION : le seul gabarit qui marchait avant ce lot.
  it('une DÉTECTION rend toujours son gabarit d origine, inchangé', () => {
    expect(getEventShowcaseTemplate('Détection / Séance d’essai')).toBe('affiche-detection');
    expect(getEventShowcaseTemplate('DETECTION')).toBe('affiche-detection');
  });

  it('« Autre », un type absent ou vide rendent le gabarit neutre', () => {
    expect(getEventShowcaseTemplate('Autre')).toBe('affiche-evenement');
    expect(getEventShowcaseTemplate()).toBe('affiche-evenement');
    expect(getEventShowcaseTemplate('')).toBe('affiche-evenement');
  });

  // ⛔ Le gabarit se choisit sur le TYPE, jamais sur le titre saisi.
  it('un titre d événement qui contient « match » ne change pas le gabarit du type', () => {
    expect(getEventShowcaseTemplate('Tournoi')).toBe('affiche-tournoi');
  });

  it('le repli du module reste une clé connue du catalogue de l écran', () => {
    expect(SHOWCASE_TEMPLATES[EVENT_SHOWCASE_FALLBACK_TEMPLATE]).toBeDefined();
  });

  // 🚨 Un gabarit rendu par la carte des types mais absent du catalogue de l'écran
  // ferait retomber `useVisualShowcase` sur la détection SANS RIEN DIRE.
  it('les 4 gabarits d événement sont tous connus du catalogue de l écran', () => {
    ['Match', 'Tournoi', 'Stage', 'Autre', 'Détection'].forEach((typeName) => {
      const key = getEventShowcaseTemplate(typeName);
      expect(SHOWCASE_TEMPLATES[key]).toBeDefined();
      expect(SHOWCASE_TEMPLATES[key].subjectType).toBe('event');
    });
  });
});

describe('isEventShowcaseOffered — 🚪 l entraînement n a pas d affiche (D99)', () => {
  it('ferme la porte à l entraînement et la laisse ouverte aux autres', () => {
    expect(isEventShowcaseOffered('Entraînement')).toBe(false);
    expect(isEventShowcaseOffered('Match')).toBe(true);
    expect(isEventShowcaseOffered('Tournoi')).toBe(true);
    expect(isEventShowcaseOffered()).toBe(true);
  });
});

describe('getEventShowcaseShareIntro — 🗣️ le message dit la même chose que l affiche', () => {
  it('chaque type garde sa phrase (non-régression D94/C2)', () => {
    expect(getEventShowcaseShareIntro('Match').default).toBe('Viens nous encourager pour ce match !');
    expect(getEventShowcaseShareIntro('Tournoi').default).toBe('Viens vivre notre tournoi !');
    expect(getEventShowcaseShareIntro('Stage').default).toBe('Découvre notre stage !');
    expect(getEventShowcaseShareIntro('Autre').default).toBe('Voici notre prochain événement !');
  });
});
