import { resolveMatchTagSegments } from '../matchPageModel';

// 🎨 FINITIONS15 point 9e (tournée T14, S03f) — LA RÈGLE DE LA PASTILLE D'UN MATCH, partagée par le
// téléphone (EventDetails.js) et le site (EventDetails.web.js). Le parent lisait « MATCH » seul :
// sans accès à l'appel, il n'a jamais l'horloge du serveur. Quand elle MANQUE, un score connu dit
// la fin ; quand elle est là, elle seule décide (règle AC10).

const t = (/** @type {string} */ _cle, /** @type {string} */ repli) => repli;

describe('FINITIONS15 point 9e — la pastille d un match', () => {
  test('sans horloge du serveur, un score connu : « TERMINÉ · VICTOIRE »', () => {
    expect(resolveMatchTagSegments({
      isFinished: false, segmentDuLieu: 'À DOMICILE', t, verdict: 'win',
    })).toEqual(['TERMINÉ', 'VICTOIRE']);
  });

  test('l horloge du serveur dit « pas fini » : elle décide, le lieu reste', () => {
    expect(resolveMatchTagSegments({
      horlogeConnue: true, isFinished: false, segmentDuLieu: 'À DOMICILE', t, verdict: 'win',
    })).toEqual(['À DOMICILE', '']);
  });

  test('fini à l horloge du serveur, sans score : « TERMINÉ » seul', () => {
    expect(resolveMatchTagSegments({ horlogeConnue: true, isFinished: true, t }))
      .toEqual(['TERMINÉ', '']);
  });

  test('ni horloge ni score : le lieu, rien d autre', () => {
    expect(resolveMatchTagSegments({ isFinished: false, segmentDuLieu: 'À L’EXTÉRIEUR', t }))
      .toEqual(['À L’EXTÉRIEUR', '']);
  });
});
