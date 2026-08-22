import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withoutDeletedAccountEntries } from '@/domains/user/deletedAccount';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { getTournamentMemberBuckets, normalizeTournamentText } from '../tournamentUtils';

/**
 * ⚠️ Meme motif que `TournamentProgressRail` : un `typedef` nomme plutot
 * qu'une destructuration dans la signature, qui obligerait a typer `root0` en
 * `object` et ferait apparaitre une erreur par propriete.
 * @typedef {object} PeopleProps
 * @property {boolean} [canSeeNames] - Vrai pour qui organise. Faux, l'onglet
 *   reste affiche avec son etat vide : la planche 04 ne retire jamais un
 *   onglet, sinon la page change de forme selon qui la regarde.
 * @property {any[]} [teams] - Les equipes inscrites, telles que le serveur les
 *   sert (`event.tournamentTeams`).
 */

/**
 * 👥 « Personnes » — QUI EST LA, SUR UN TOURNOI (planche 04, cadre 4E).
 *
 * Un tournoi a des equipes, et les equipes ont des joueurs. La page savait
 * compter les EQUIPES et rien d'autre : pour savoir qui allait venir, il
 * fallait ouvrir chaque equipe l'une apres l'autre.
 *
 * 🔒 LA LISTE NOMINATIVE EST DERRIERE UNE GARDE. C'est la reunion des effectifs
 * de toutes les equipes inscrites — souvent des dizaines de personnes, parfois
 * mineures. Un visiteur voit l'onglet et son compte, jamais les noms : un
 * nombre ne designe personne.
 *
 * ⚠️ LES COMPTES SUPPRIMES SONT RETIRES (AA02) : le serveur RENOMME sans
 * effacer, donc une ligne peut porter « Utilisateur Supprimé » sans que rien ne
 * le signale a l'affichage. `withoutDeletedAccountEntries` est la garde de
 * reference de l'application ; elle exige `blocked` EN PLUS du tombstone, pour
 * qu'un joueur vivant ne puisse jamais etre masque par erreur.
 * @param {PeopleProps} props - Qui regarde, et quelles equipes reunir.
 * @returns {any} La liste, son etat vide, ou la garde selon le lecteur.
 */
function TournamentPeopleList(props) {
  const { canSeeNames = false, teams = [] } = props;
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // 🧮 Une equipe = son nom, ses membres VIVANTS et actifs, et ce qui reste en
  // suspens. « Actif » veut dire pending | present | absent : quelqu'un qui a
  // dit non n'est plus de la fete, et une invitation sans reponse n'est pas
  // encore une personne presente.
  const groupes = useMemo(() => (Array.isArray(teams) ? teams : [])
    .map((team) => {
      const buckets = getTournamentMemberBuckets(team?.members || []);
      return {
        actifs: withoutDeletedAccountEntries(buckets.activeMembers),
        documentId: team?.documentId || team?.name,
        enAttente: withoutDeletedAccountEntries([
          ...buckets.invitedMembers,
          ...buckets.requestedMembers,
        ]).length,
        name: team?.name || '',
      };
    })
    .filter((groupe) => groupe.actifs.length > 0 || groupe.enAttente > 0), [teams]);

  const total = groupes.reduce((somme, groupe) => somme + groupe.actifs.length, 0);

  if (!canSeeNames) {
    return (
      <View
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: withAlpha(Colors.primary500, 0.24),
          },
        ]}
        testID="tournament-people-locked"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('eventDetails.tournamentPeople.lockedTitle', 'Réservé à l’organisation')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'eventDetails.tournamentPeople.lockedHint',
            'Tu retrouves ton équipe et ses joueurs depuis le bouton du bas.',
          )}
        </Text>
      </View>
    );
  }

  if (!total) {
    return (
      <Text style={[Fonts.p2, Fonts.neutral200]} testID="tournament-people-empty">
        {t('eventDetails.tournamentPeople.empty', 'Aucune personne inscrite pour l’instant.')}
      </Text>
    );
  }

  return (
    <View style={[Spaces.gap[12]]} testID="tournament-people">
      {groupes.map((groupe) => (
        <View
          key={groupe.documentId}
          style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.padding[16],
            Spaces.gap[8],
            {
              backgroundColor: withAlpha(Colors.primary500, 0.06),
              borderColor: withAlpha(Colors.primary500, 0.2),
            },
          ]}
        >
          <View
            style={[
              Alignments.row,
              Alignments.justifySpaceBetween,
              Alignments.alignCenter,
              Spaces.gap[12],
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{groupe.name}</Text>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>{String(groupe.actifs.length)}</Text>
          </View>

          {groupe.actifs.map((membre) => {
            const statut = normalizeTournamentText(membre?.responseStatus);
            let statutLabel = t('eventDetails.tournamentPeople.pending', 'Sans réponse');
            let statutStyle = Fonts.neutral300;
            if (statut === 'present') {
              statutLabel = t('eventDetails.tournamentPeople.present', 'Présent·e');
              statutStyle = Fonts.primary500;
            } else if (statut === 'absent') {
              statutLabel = t('eventDetails.tournamentPeople.absent', 'Absent·e');
              statutStyle = Fonts.neutral200;
            }

            return (
              <View
                key={membre?.documentId || membre?.user?.documentId}
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  Alignments.alignCenter,
                  Spaces.gap[12],
                ]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>
                  {`${membre?.user?.firstname || ''} ${membre?.user?.lastname || ''}`.trim()}
                </Text>
                <Text style={[Fonts.p4Bold, statutStyle]}>{statutLabel}</Text>
              </View>
            );
          })}

          {groupe.enAttente > 0 ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t(
                'eventDetails.tournamentPeople.awaiting',
                '{{count}} invitation·s ou demande·s en attente',
                { count: groupe.enAttente },
              )}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default TournamentPeopleList;
