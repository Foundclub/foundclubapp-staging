import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { buildRemindMessage } from '@/domains/event/remindReport';

import { formatDateTimeWithDayPrefix } from '@/utils/date';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * N4 (D5) — LA FEUILLE QUI CHOISIT QUI ON RELANCE (cadres 1G, 1H, 1I).
 *
 * 🧨 CE QU ELLE REPARE : le bouton « Relancer » partait sans rien demander, sur
 * TOUT l evenement. Sur un amical, un tournoi ou un stage il y a plusieurs
 * equipes — le coach ne pouvait ni en viser une, ni savoir laquelle avait deja
 * ete relancee. Et le serveur n accepte qu UNE equipe par appel : le geste
 * « relancer tout le monde » n existait donc meme pas.
 *
 * TROIS CADRES, UN SEUL COMPOSANT :
 *   · 1G — une ligne par equipe, avec son nombre de sans-reponse, l equipe du
 *     bouton presse deja cochee ;
 *   · 1I — le motif anti-spam AVANT l envoi : si la derniere reponse du serveur
 *     porte une prochaine relance dans le futur, la feuille le dit ;
 *   · 1H — le compte rendu APRES l envoi, avec les chiffres DU SERVEUR.
 *
 * ⛔ ELLE N APPELLE AUCUN SERVICE. Elle est pilotee de l exterieur — meme choix
 * que `EventExportSheet` : c est ce qui permet de la brancher en trois lignes
 * et de la tester seule.
 *
 * ⚠️ `snapPoints` N EST PAS DECORATIF : la feuille porte un EN-TETE et un PIED.
 * C est cette association qui exige une hauteur fixe (`BottomModal.js:297`,
 * `enableDynamicSizing={!snapPoints}`) — sans elle la zone defilante est
 * plafonnee a 70 % et le pied part hors de l ecran (piege paye au lot D19).
 */

/** Cible tactile minimale du projet. */
const MIN_TOUCH_TARGET = 44;

// 78 % est la valeur deja employee par `FiltersSheet` : sur l iPhone SE, le
// plus petit ecran vise, cela fait 520 pt — de quoi tenir 4 equipes et le pied
// sans defilement, et defiler proprement au-dela.
const SNAP_POINTS = ['78%'];

/**
 * Combien de personnes sans reponse dans les equipes cochees.
 * @param {any[]} sections - Les equipes proposees.
 * @param {string[]} cochees - Les clefs cochees.
 * @returns {number} - Le total, indicatif.
 */
const compterLesSansReponse = (sections, cochees) => sections
  .filter((section) => cochees.includes(section.key))
  .reduce((total, section) => total + (section.notAnswered?.length || 0), 0);

/**
 * La feuille de relance par equipe.
 * @param {object} props - Les proprietes du composant.
 * @param {string} [props.equipePreCochee] - L equipe du bouton presse.
 * @param {any} [props.erreur] - L erreur de la mutation, s il y en a une.
 * @param {boolean} [props.isReminding] - Une relance est-elle en cours.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {number} [props.nowMs] - L horloge SERVEUR, pour juger l anti-spam.
 * @param {() => void} props.onClose - Fermer la feuille.
 * @param {(teamIds: string[]) => void} props.onRelancer - Lancer la relance.
 * @param {any} [props.rapport] - Le compte rendu du serveur (data de la mutation).
 * @param {any[]} [props.sections] - Les equipes, avec leurs sans-reponse.
 * @returns {import('react').ReactElement | null} - La feuille.
 */
function RemindTeamsSheet({
  equipePreCochee = '',
  erreur = null,
  isReminding = false,
  isVisible,
  nowMs = 0,
  onClose,
  onRelancer,
  rapport = null,
  sections = [],
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  /** @type {[string[], (v: string[]) => void]} */
  const [cochees, setCochees] = useState([]);
  // 🔒 CE DRAPEAU EST LE COEUR DE 1H. `rapport` est le cache de la mutation :
  // il SURVIT a la fermeture de la feuille. Sans lui, rouvrir la feuille
  // afficherait d emblee le compte rendu d une relance d hier — et l on ne
  // pourrait plus rien relancer du tout.
  const [aEnvoye, setAEnvoye] = useState(false);

  // Les equipes qui n ont personne a relancer n ont rien a faire dans la liste.
  const equipesRelancables = sections.filter(
    (section) => (section?.notAnswered?.length || 0) > 0,
  );

  useEffect(() => {
    if (!isVisible) return;
    setAEnvoye(false);
    // L equipe du bouton presse arrive cochee : c est ce que le coach visait.
    // Si ce bouton etait celui d une liste sans equipe, rien n est coche.
    const visee = equipesRelancables.find((section) => section.key === equipePreCochee);
    setCochees(visee ? [visee.key] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, equipePreCochee]);

  if (!isVisible) return null;

  const basculer = (/** @type {string} */ cle) => {
    setCochees(cochees.includes(cle)
      ? cochees.filter((valeur) => valeur !== cle)
      : [...cochees, cle]);
  };

  const nombreIndicatif = compterLesSansReponse(equipesRelancables, cochees);

  // 1I — LE MOTIF ANTI-SPAM, AVANT L APPUI. Meme lecture qu `EventParticipants`
  // (AE02) : `nextReminderAt` n existe NULLE PART tant qu aucune relance n est
  // partie — il ne vit que dans la REPONSE du serveur, donc dans le cache de
  // la mutation. Une date DEPASSEE n a plus rien a dire.
  const instantCourant = nowMs || Date.now();
  const prochaineRelanceMs = Date.parse(rapport?.nextReminderAt || '');
  const prochaineRelance = Number.isFinite(prochaineRelanceMs)
    && prochaineRelanceMs > instantCourant
    ? formatDateTimeWithDayPrefix(rapport.nextReminderAt)
    : '';

  const nomDeLEquipe = (/** @type {string} */ cle) => {
    const section = sections.find((item) => item.key === cle);

    return section?.teamName || t('eventDetails.remindSheet.unnamedTeam', 'Équipe');
  };

  // -------------------------------------------------------------------------
  // 1H — LE COMPTE RENDU. Les chiffres viennent du SERVEUR, jamais de l app.
  // -------------------------------------------------------------------------
  const rendreLeCompteRendu = () => {
    if (erreur) {
      return (
        <View style={[Spaces.gap[12]]} testID="remind-sheet-report">
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.remindSheet.failedTitle', 'La relance n’a pas pu partir')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'eventDetails.remindSheet.failedBody',
              'Personne n’a été prévenu : réessaie dans un instant.',
            )}
          </Text>
        </View>
      );
    }

    const message = buildRemindMessage(rapport);
    const parEquipe = Array.isArray(rapport?.parEquipe) ? rapport.parEquipe : [];

    return (
      <View style={[Spaces.gap[12]]} testID="remind-sheet-report">
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{message.title}</Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{message.description}</Text>

        {/* La ventilation : une ligne par equipe APPELEE, y compris celle qui
            n a relance personne. La faire disparaitre en ferait un oubli. */}
        {parEquipe.length > 1 ? (
          <View style={[Spaces.gap[8]]}>
            {parEquipe.map((/** @type {any} */ ligne) => (
              <View
                key={ligne.teamId}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.gap[12],
                  Spaces.padding[12],
                  {
                    backgroundColor: Colors.primary700,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.neutral00, Alignments.grow1]}>
                  {ligne.teamName || nomDeLEquipe(ligne.teamId)}
                </Text>
                <Text style={[Fonts.p3, ligne.echec ? Fonts.error300 : Fonts.neutral200]}>
                  {ligne.echec
                    ? t('eventDetails.remindSheet.teamFailed', 'échec')
                    : t('eventDetails.remindSheet.teamReminded', '{{count}} relancé·e·s')
                      .replace('{{count}}', String(ligne.remindedCount))}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // 1G — LE CHOIX DES EQUIPES.
  // -------------------------------------------------------------------------
  const rendreLeChoix = () => (
    <View style={[Spaces.gap[16]]} testID="remind-sheet-teams">
      {prochaineRelance ? (
        <View
          style={[
            Spaces.padding[12],
            Spaces.gap[4],
            {
              backgroundColor: Colors.primary700,
              borderColor: Colors.gold500,
              borderRadius: 12,
              borderWidth: 1,
            },
          ]}
          testID="remind-sheet-antispam"
        >
          <Text style={[Fonts.p3Bold, Fonts.gold500]}>
            {t(
              'eventDetails.participantsSummary.nextReminder',
              'Prochaine relance possible le {{date}}',
            ).replace('{{date}}', prochaineRelance)}
          </Text>
          <Text style={[Fonts.p4, Fonts.neutral200]}>
            {t(
              'eventDetails.remindSheet.antiSpamHint',
              'Une personne relancée il y a moins de 48 h ne recevra rien de plus.',
            )}
          </Text>
        </View>
      ) : null}

      {equipesRelancables.length ? (
        equipesRelancables.map((section) => (
          <View
            key={section.key}
            style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}
            testID={`remind-sheet-team-${section.key}`}
          >
            <Checkbox
              onValueChange={() => basculer(section.key)}
              value={cochees.includes(section.key)}
            />
            <View style={[Alignments.grow1]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {section.teamName || nomDeLEquipe(section.key)}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {t('eventDetails.remindSheet.teamCount', '{{count}} sans réponse')
                  .replace('{{count}}', String(section.notAnswered?.length || 0))}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'eventDetails.remindSheet.nobody',
            'Tout le monde a répondu : il n’y a personne à relancer.',
          )}
        </Text>
      )}
    </View>
  );

  const pied = aEnvoye ? (
    <Button
      onPress={onClose}
      style={{ minHeight: MIN_TOUCH_TARGET }}
      title={t('eventDetails.remindSheet.close', 'Fermer')}
    />
  ) : (
    <View style={[Spaces.gap[8]]}>
      <Button
        disabled={!cochees.length || isReminding}
        isLoading={isReminding}
        onPress={() => {
          setAEnvoye(true);
          onRelancer(cochees);
        }}
        style={{ minHeight: MIN_TOUCH_TARGET }}
        testID="remind-sheet-confirm"
        title={t('eventDetails.remindSheet.confirm', 'Relancer {{count}} personne·s')
          .replace('{{count}}', String(nombreIndicatif))}
      />
      {/* 🔢 LE CHIFFRE DU PIED EST INDICATIF, ET LA FEUILLE LE DIT. C est le
          compte de l APP ; le serveur ecarte ensuite les personnes deja
          relancees, et c est SON chiffre que le compte rendu affiche. */}
      <Text style={[Fonts.p4, Fonts.neutral300]}>
        {t(
          'eventDetails.remindSheet.indicative',
          'Chiffre indicatif : le serveur écarte les personnes déjà relancées.',
        )}
      </Text>
    </View>
  );

  return (
    <BottomModal
      close={onClose}
      footerComponent={pied}
      headerComponent={(
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('eventDetails.remindSheet.title', 'Relancer les sans-réponse')}
        </Text>
      )}
      isVisible
      snapPoints={SNAP_POINTS}
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[16]]} testID="remind-sheet">
        {aEnvoye ? rendreLeCompteRendu() : rendreLeChoix()}
      </View>
    </BottomModal>
  );
}

export default RemindTeamsSheet;
