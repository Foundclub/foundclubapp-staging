/**
 * C10BIS · P12-11 — creer une equipe de ligue, puis ses creneaux.
 *
 * Si un creneau echouait, « Creer » relance tout : l'equipe etait recreee (un doublon a
 * chaque essai). `progres` garde, d'un essai a l'autre, l'equipe deja creee et les creneaux
 * deja crees ; un nouvel essai ne relance que ce qui manque.
 * ponytail: un creneau se reconnait a sa place dans la liste ; si la liste change entre deux
 * essais, la place peut mentir. Sortie : une cle stable par creneau.
 * @param {{
 *   creerCreneau: (creneau: any, teamId: string) => Promise<any>,
 *   creerEquipe: () => Promise<any>,
 *   creneaux: any[],
 *   progres: { creneauxFaits: Set<number>, teamId: string | null },
 * }} params - Les deux ecritures, les creneaux voulus, et ce qui est deja fait.
 * @returns {Promise<string>} L'identifiant de l'equipe.
 */
export const creerEquipeEtCreneaux = async ({
  creerCreneau, creerEquipe, creneaux, progres,
}) => {
  if (!progres.teamId) {
    const equipe = await creerEquipe();
    const teamId = equipe?.documentId || equipe?.id;
    if (!teamId) throw new Error('Failed to create league team');
    // eslint-disable-next-line no-param-reassign
    progres.teamId = teamId;
  }

  const teamId = String(progres.teamId);
  const resultats = await Promise.allSettled((creneaux || []).map((creneau, index) => (
    progres.creneauxFaits.has(index)
      ? Promise.resolve()
      : creerCreneau(creneau, teamId).then(() => { progres.creneauxFaits.add(index); })
  )));
  const echec = resultats.find((resultat) => resultat.status === 'rejected');
  if (echec && echec.status === 'rejected') throw echec.reason;
  return teamId;
};
