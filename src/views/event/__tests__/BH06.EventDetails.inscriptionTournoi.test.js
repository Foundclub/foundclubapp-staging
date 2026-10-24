import fs from 'fs';
import path from 'path';

// 🐞 BUGHUNT P7-09 (BH06) — « Inscrire mon équipe » à un tournoi : les lignes restaient
// appuyables pendant l'envoi ; un double appui inscrivait l'équipe deux fois.
// EventDetails fait 10 000 lignes : ce témoin LIT la ligne de la fenêtre (comme ANDROIDBAR-4).

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'EventDetails.js'), 'utf8');

test('P7-09 — chaque ligne d équipe est éteinte et refuse l appui pendant l inscription', () => {
  const appel = SOURCE.indexOf('registerTournamentTeamMutation.mutate({ sourceTeamId');
  expect(appel).toBeGreaterThan(-1);
  const ligne = SOURCE.slice(SOURCE.lastIndexOf('<TouchableOpacity', appel), SOURCE.indexOf('>', appel));
  expect(ligne).toContain('disabled={registerTournamentTeamMutation.isPending}');
  expect(ligne).toMatch(/if \(registerTournamentTeamMutation\.isPending\) return;/);
});
