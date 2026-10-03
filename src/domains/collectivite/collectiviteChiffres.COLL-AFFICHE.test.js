import {
  dimancheDe,
  installationParDefaut,
  lundiDecale,
  lundiDeMaintenant,
  nomDuFichierAffiche,
} from './collectiviteChiffres';

// 🏛️ COLL-AFFICHE (03/10) — les fonctions PURES de « Une affiche pour l'installation »
// (planche 30 B) : la semaine (lundi -> dimanche), l'installation proposée d'abord, le nom du
// PDF (le même que celui du serveur, admin `nomFichierAffiche`).

describe('COLL-AFFICHE — la semaine de l’affiche', () => {
  it('le lundi de la semaine d’un jour, décalé de n semaines, même à cheval sur l’année', () => {
    expect(lundiDecale('2026-10-04')).toBe('2026-09-28');
    expect(lundiDecale('2026-09-28')).toBe('2026-09-28');
    expect(lundiDecale('2026-09-28', -1)).toBe('2026-09-21');
    expect(lundiDecale('2026-12-31', 1)).toBe('2027-01-04');
    // Le passage à l'heure d'hiver (25 octobre 2026) ne décale rien : calcul en jours civils.
    expect(lundiDecale('2026-10-26', -1)).toBe('2026-10-19');
  });

  it('un jour illisible ne donne aucune semaine (jamais une semaine inventée)', () => {
    expect(lundiDecale('2026-02-30')).toBeNull();
    expect(lundiDecale('demain')).toBeNull();
    expect(lundiDecale(undefined)).toBeNull();
  });

  it('le dimanche qui ferme la semaine, et le lundi d’aujourd’hui', () => {
    expect(dimancheDe('2026-12-28')).toBe('2027-01-03');
    expect(lundiDeMaintenant(new Date(2026, 9, 3, 12, 0))).toBe('2026-09-28');
  });
});

describe('COLL-AFFICHE — l’installation proposée et le nom du PDF', () => {
  it('la plus utilisée ; à égalité, la première du serveur ; aucune sans liste', () => {
    const dojo = { documentId: 'dojo', minutes: 120, name: 'Dojo municipal' };
    const gymnase = { documentId: 'gymnase', minutes: 630, name: 'Gymnase des Tilleuls' };
    expect(installationParDefaut([dojo, gymnase])).toBe(gymnase);
    expect(installationParDefaut([{ ...dojo, minutes: 0 }, { ...gymnase, minutes: 0 }]).documentId)
      .toBe('dojo');
    expect(installationParDefaut([])).toBeNull();
    expect(installationParDefaut(undefined)).toBeNull();
  });

  it('le nom du PDF, sans accent ni espace, comme le serveur', () => {
    expect(nomDuFichierAffiche('Gymnase des Tilleuls', '2026-09-28'))
      .toBe('affiche-gymnase-des-tilleuls-2026-09-28.pdf');
    expect(nomDuFichierAffiche('Salle Émile-Zola', '2026-09-28'))
      .toBe('affiche-salle-emile-zola-2026-09-28.pdf');
    expect(nomDuFichierAffiche('', '2026-09-28')).toBe('affiche-installation-2026-09-28.pdf');
  });
});
