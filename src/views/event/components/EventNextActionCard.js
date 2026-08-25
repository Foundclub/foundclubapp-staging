import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * N5 (D1) — LA PORTE D ENTREE DE L APPEL, maquette 02 · 2A.
 *
 * 🚪 CE QU ELLE REPARE : L5-A a livre un ecran d appel complet
 * (`EventAttendanceCall`) que RIEN n atteignait depuis la page d un
 * evenement. Une fonctionnalite qu aucun bouton ne touche n existe pas pour
 * celui qui l utilise — c est la deuxieme des trois familles d inacheve
 * (§2 quinquies). Cette carte est ce bouton.
 *
 * ⛔ ELLE EST PUREMENT PRESENTIELLE, et c est deliberé : aucune requete,
 * aucune horloge, aucun `Date.now()`. Elle recoit un `mode` deja calcule et
 * rend un dessin. La raison est une regle du lot : l heure qui decide vient du
 * SERVEUR (`serverNow` + le temps ecoule depuis sa reception), jamais du
 * telephone. Un composant qui lirait l horloge locale ouvrirait la porte a
 * quelqu un que le serveur refusera ensuite ligne par ligne.
 *
 * 🕐 LE MODE VIENT DE `resolveCallMode` (L5-A, `attendanceCallModel.js`) :
 * `before` = la fenetre n est pas ouverte · `open` = on peut pointer ·
 * `closed` = elle est passee. Cette carte ne REDEFINIT pas la fenetre, elle
 * l affiche — il n y a qu une seule definition de la fenetre dans l app.
 */

/**
 * La carte « prochaine action » de l Aperçu.
 * @param {object} props - Les proprietes du composant.
 * @param {number | null} [props.expectedCount] - Combien de personnes sont attendues,
 *   ou `null` quand on ne le sait pas encore (la ligne disparait alors : on
 *   n annonce pas « 0 attendu » a la place de « je ne sais pas »).
 * @param {'before' | 'closed' | 'open'} [props.mode] - L etat de la fenetre d appel.
 * @param {() => void} [props.onPress] - Ouvrir l ecran d appel. Appele au seul etat `open`.
 * @param {string} [props.opensAtLabel] - L heure d ouverture « 17:30 », dans le fuseau DU CLUB.
 * @returns {import('react').ReactElement} - La carte.
 */
function EventNextActionCard({
  expectedCount = null,
  mode = 'before',
  onPress,
  opensAtLabel = '',
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const estOuvert = mode === 'open';
  const estTermine = mode === 'closed';

  const libelleDuBouton = () => {
    if (estOuvert) return t('eventDetails.nextAction.action', 'Faire l’appel');
    if (estTermine) return t('eventDetails.nextAction.done', 'Appel terminé');

    // 🪤 Sans heure lisible, « Ouvre à  » se terminerait par un blanc. On dit
    // alors ce qu on sait vraiment : que ce n est pas encore ouvert.
    if (!opensAtLabel) return t('eventDetails.nextAction.opensSoon', 'Pas encore ouvert');

    const gabarit = t('eventDetails.nextAction.opensAt', 'Ouvre à {{time}}');

    return gabarit.replace('{{time}}', opensAtLabel);
  };

  const ligneDesAttendus = () => {
    if (expectedCount === null || expectedCount === undefined) return '';
    const cle = expectedCount > 1 ? 'expectedOther' : 'expectedOne';
    const repli = expectedCount > 1 ? '{{count}} attendus' : '{{count}} attendu';

    return t(`eventDetails.nextAction.${cle}`, repli).replace('{{count}}', String(expectedCount));
  };

  const attendus = ligneDesAttendus();

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[16],
        { borderColor: estTermine ? withAlpha(Colors.neutral300, 0.45) : Colors.primary500 },
      ]}
      testID="event-next-action"
    >
      <View style={[Spaces.gap[4]]}>
        <Text
          style={[Fonts.h4Bold, estTermine ? Fonts.neutral300 : Fonts.neutral00]}
          testID="event-next-action-title"
        >
          {t('eventDetails.nextAction.title', 'Faire l’appel')}
        </Text>
        {attendus ? (
          <Text style={[Fonts.p2, Fonts.neutral200]} testID="event-next-action-expected">
            {attendus}
          </Text>
        ) : null}
      </View>

      {/* 🪤 LE `testID` VIT SUR CE `View`, PAS SUR LE `Button` : l atome
          `Button` ne declare NI ne transmet `testID`. Le poser dessus ne
          l aurait mis nulle part dans la vraie app (constat de N4). */}
      <View testID="event-next-action-button">
        <Button
          disabled={!estOuvert}
          onPress={estOuvert ? onPress : undefined}
          title={libelleDuBouton()}
          variant={estOuvert ? 'Primary' : 'Secondary'}
        />
      </View>

      {/* ⏱️ LA PHRASE DIT LA REGLE DE LA FENETRE. Elle vit tant que la fenetre
          est devant ou en cours ; une fois l appel termine, elle n a plus rien
          a annoncer et disparait (D1).
          🔓 S4 (vague S, 25/08) : elle ne cite plus « 30 minutes avant », qui
          n existe plus — l appel s ouvre des la CREATION de l evenement.
          ⚠️ Elle cite encore « 2 h », qui est la valeur de REPLI du modele. Le
          serveur peut etre regle autrement (`EVENT_ATTENDANCE_WINDOW_AFTER_MINUTES`) :
          la phrase serait alors approximative. Elle reste une chaine de
          `fr.js`, donc corrigeable sans toucher au code — voie de sortie : la
          construire depuis la fenetre rendue par le serveur. */}
      {estTermine ? null : (
        <Text style={[Fonts.p4, Fonts.neutral200]} testID="event-next-action-window">
          {t(
            'eventDetails.nextAction.window',
            'L’appel est ouvert dès la création de l’événement, '
              + 'et se ferme 2 h après la fin.',
          )}
        </Text>
      )}
    </View>
  );
}

export default EventNextActionCard;
