import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { getEventEditSupport } from '@/domains/event/eventUseCases';
import { phraseForFacilityType } from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { RouteNames } from '@/navigation/routeNames';

import { getFacilityTypeNoun } from '@/utils/facilityTypes';

/**
 * CRFERM (13/10) — COL-010, décision d'Adel « D8 B » (planche P8v4-fermee) : LA MARQUE « FERMÉ »
 * SUR LA CARTE d'une séance de la liste. Le serveur la pose (`facilityClosure` de GET /events :
 * jours, heures, motif, type de l'installation ; jamais le mot de la Ville) ; un serveur d'avant ne
 * la pose pas, et rien ne s'affiche.
 *
 * Tous les membres voient la marque. Joueurs et parents : une phrase, sans geste (« Gymnase fermé
 * ce jour-là »). Qui peut modifier la séance (dirigeant, entraîneur) : un bouton « Gymnase fermé ·
 * à déplacer › », qui ouvre l'écran de modification (en attendant « Déplacer la séance », lot S3 +
 * A8). Le ton est l'orange du bandeau de la fiche ; la couleur de l'installation ne change pas.
 * @param {{ canEdit?: boolean, event: any, onOpen?: () => void }} props - `onOpen` : ouvrir la
 *   fiche (une séance que l'écran de modification ne sait pas changer, un stage par exemple).
 * @returns {import('react').ReactElement | null} La marque, ou rien.
 */
function FacilityClosureCardTag({ canEdit = false, event, onOpen }) {
  const marque = event?.facilityClosure;
  if (!marque || typeof marque !== 'object') return null;
  return <Etiquette canEdit={canEdit} event={event} marque={marque} onOpen={onOpen} />;
}

/**
 * La marque elle-même (montée seulement s'il y a une fermeture : la navigation n'est lue qu'alors).
 * @param {{ canEdit: boolean, event: any, marque: any, onOpen?: () => void }} props
 * @returns {import('react').ReactElement} La marque.
 */
function Etiquette({
  canEdit, event, marque, onOpen,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const lieu = getFacilityTypeNoun(marque.facilityType);
  const valeurs = {
    ...SANS_ECHAPPEMENT,
    lieu: lieu ? `${lieu.nom.charAt(0).toLocaleUpperCase()}${lieu.nom.slice(1)}` : '',
  };
  const accorder = (/** @type {string} */ cle, /** @type {[string, string, string]} */ textes) => (
    phraseForFacilityType(lieu, {
      feminine: t(`collectiviteFermetures.etiquette.${cle}Feminin`, textes[1], valeurs),
      generic: t(`collectiviteFermetures.etiquette.${cle}`, textes[2]),
      masculine: t(`collectiviteFermetures.etiquette.${cle}Masculin`, textes[0], valeurs),
    })
  );
  const blocage = marque.kind === 'block';
  let libelle;
  if (canEdit) {
    libelle = blocage
      ? t('collectiviteFermetures.etiquette.bloqueDeplacer', 'Bloqué par la Ville · à déplacer')
      : accorder('deplacer', [
        '{{lieu}} fermé · à déplacer',
        '{{lieu}} fermée · à déplacer',
        'Installation fermée · à déplacer',
      ]);
  } else if (blocage) {
    libelle = t('collectiviteFermetures.etiquette.bloque', 'Bloqué par la Ville à cette heure');
  } else if (marque.startTime || marque.endTime) {
    // Une fermeture en plage (« heures : plage ») : à cette heure, pas forcément toute la journée.
    libelle = accorder('fermeHeure', [
      '{{lieu}} fermé à cette heure',
      '{{lieu}} fermée à cette heure',
      'Installation fermée à cette heure',
    ]);
  } else {
    libelle = accorder('fermeJour', [
      '{{lieu}} fermé ce jour-là', '{{lieu}} fermée ce jour-là', 'Installation fermée ce jour-là',
    ]);
  }

  const style = {
    alignItems: /** @type {'center'} */ ('center'),
    backgroundColor: withAlpha(Colors.warning500, 0.12),
    borderColor: withAlpha(Colors.warning500, 0.45),
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: /** @type {'row'} */ ('row'),
    gap: 8,
    minHeight: canEdit ? 44 : 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  };
  const texte = (
    <Text style={[Fonts.p3Bold, { color: Colors.warning400, flex: 1 }]}>{libelle}</Text>
  );
  const horloge = (
    <SvgIcon color={Colors.warning500} height={15} name="clock-two-thirty" width={15} />
  );

  if (!canEdit) {
    return (
      <View accessibilityRole="text" style={style} testID="carte-fermeture">
        {horloge}
        {texte}
      </View>
    );
  }
  const ouvrir = () => {
    const eventId = event?.documentId;
    // Un stage ou un tournoi ne se modifie pas par cet écran (`getEventEditSupport`) : la fiche
    // dit pourquoi, et porte le bandeau de la fermeture.
    if (!eventId || !getEventEditSupport(event).isSupported) {
      onOpen?.();
      return;
    }
    if (Platform.OS === 'web') navigation?.navigate?.(RouteNames.EventEdit, { eventId });
    else {
      navigation?.navigate?.(RouteNames.EventStack, {
        params: { eventId }, screen: RouteNames.EventEdit,
      });
    }
  };
  return (
    <TouchableOpacity
      accessibilityHint={t(
        'collectiviteFermetures.etiquette.deplacerAide',
        'Ouvre la modification de la séance.',
      )}
      accessibilityLabel={libelle}
      accessibilityRole="button"
      onPress={ouvrir}
      style={style}
      testID="carte-fermeture"
    >
      {horloge}
      {texte}
      <SvgIcon color={Colors.warning500} height={12} name="arrow-right" width={12} />
    </TouchableOpacity>
  );
}

export default FacilityClosureCardTag;
