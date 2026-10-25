// BH02 (BUGHUNT 24/10) — P3-05 : une invitation d'équipe en attente ne s'ouvre pas avant le
// parcours d'inscription (contrôle d'âge, déclaration parentale). Le navigateur privé n'est
// rendu par aucun test : le témoin lit l'effet dans la source, comme RESAL6B2.
const fs = require('fs');
const path = require('path');

it('l\'effet de l\'invitation attend la fin du parcours d\'inscription', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'PrivateNavigator.js'), 'utf8');
  const effet = source.slice(source.indexOf('const pendingInvite = readPendingSquadInviteLink()') - 400, source.indexOf('const pendingInvite = readPendingSquadInviteLink()'));
  expect(effet).toMatch(/villeEnLecture/);
  expect(effet).toMatch(/complexeEnLecture/);
  expect(effet).toMatch(/firstPendingOnboardingRoute/);
  const fin = source.slice(source.indexOf('const pendingInvite = readPendingSquadInviteLink()'));
  expect(fin.slice(0, fin.indexOf('useEffect('))).toMatch(/\[\s*complexeEnLecture,\s*firstPendingOnboardingRoute,\s*userData\?\.documentId,\s*userDataError,\s*userDataLoading,\s*villeEnLecture,?\s*\]/);
});
