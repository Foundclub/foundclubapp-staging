import fs from 'fs';
import path from 'path';

// REPRISE-CHEMINS (02/11, contre-recette Dirigeant) : après « Déconnexion », deux appels partaient
// encore SANS compte et revenaient en 403 (/api/app/bootstrap, /api/firebase-auth/me). Cause :
// `logoutMutation` vidait le cache AVANT de retirer la session ; les requêtes encore montées,
// toujours « autorisées » par un jeton présent dans le magasin, se recréaient et repartaient sans
// en-tête. La session sort d'abord (les requêtes s'éteignent), le cache est vidé ensuite.
// `useAuth.js` fait plus de 1 000 lignes et dépend de tout le magasin : le témoin lit l'ordre dans
// le code de `logoutMutation`, comme les témoins de l'accueil lisent `HomeHub.js`.
describe('REPRISE-CHEMINS — la déconnexion ne relance aucun appel sans compte', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'useAuth.js'), 'utf8');
  const debut = source.indexOf('const logoutMutation = useMutation({');
  const bloc = source.slice(debut, source.indexOf('\n  });\n', debut));
  const succes = bloc.slice(bloc.indexOf('onSuccess'));

  it('🔴 la session sort AVANT que le cache soit vidé', () => {
    const sortie = succes.indexOf("appDispatch({ type: 'LOGOUT_CURRENT_SESSION' })");
    const vidage = succes.indexOf('queryClient.clear()');
    expect(sortie).toBeGreaterThan(-1);
    expect(vidage).toBeGreaterThan(-1);
    expect(sortie).toBeLessThan(vidage);
  });
});
