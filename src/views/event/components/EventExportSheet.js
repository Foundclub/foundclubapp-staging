// @ts-nocheck
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * Les 8 colonnes que le serveur fabrique, dans l'ordre exact du classeur
 * (`admin/src/api/event/services/event-export.ts`, bloc `worksheet.columns`).
 *
 * `isContact: true` marque les deux qui sont des coordonnees personnelles :
 * ce sont EXACTEMENT celles que `withoutContacts` retire du fichier, en-tete
 * comprise. Le temoin serveur AD05/T3 verrouille cette correspondance.
 */
const EXPORT_COLUMNS = [
  { isContact: false, key: 'lastname' },
  { isContact: false, key: 'firstname' },
  { isContact: true, key: 'email' },
  { isContact: true, key: 'phone' },
  { isContact: false, key: 'team' },
  { isContact: false, key: 'status' },
  { isContact: false, key: 'scope' },
  { isContact: false, key: 'position' },
];

// Cible tactile minimale du projet. Le lien qu'on remplace faisait 21 px de
// haut : un doigt le ratait, et quand il ne le ratait pas un fichier partait
// avec le carnet d'adresses de l'equipe.
const MIN_TOUCH_TARGET = 44;

/**
 * La feuille qui dit ce que l'export emporte, AVANT de le sortir.
 *
 * Elle est pilotee de l'exterieur et n'appelle AUCUN service elle-meme : c'est
 * ce qui permet de la brancher depuis `EventDetails.js` (AD01) ou
 * `EventParticipants.js` (AD06) en trois lignes, sans rien casser.
 * @param {object} props - Les proprietes du composant.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {() => void} props.onClose - Fermer sans rien exporter.
 * @param {(options: { withoutContacts: boolean }) => void} props.onConfirm - Lancer l'export.
 * @param {number} [props.participantCount] - Combien de personnes partiront dans le fichier.
 * @returns {import('react').ReactElement | null} - La feuille.
 */
function EventExportSheet({
  isVisible,
  onClose,
  onConfirm,
  participantCount,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [withoutContacts, setWithoutContacts] = useState(false);

  // Chaque ouverture repart du choix le plus proche de l'existant : l'export
  // complet. Garder la case cochee d'une fois sur l'autre ferait sortir un
  // fichier ampute a quelqu'un qui ne l'a pas demande cette fois-ci.
  useEffect(() => {
    if (isVisible) setWithoutContacts(false);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <BottomModal
      close={onClose}
      isVisible
      snapPoints={['75%']}
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.h3, Fonts.neutral00]}>
            {t('eventDetails.export.title')}
          </Text>
          {Number.isFinite(participantCount) ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('eventDetails.export.count', { count: participantCount })}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            Spaces.padding[12],
            Spaces.gap[8],
            Alignments.row,
            Alignments.alignCenter,
            {
              backgroundColor: Colors.warning100,
              borderRadius: 12,
            },
          ]}
        >
          <Text style={[Fonts.p2, Fonts.warning900]}>🔒</Text>
          <Text style={[Fonts.p3Bold, Fonts.warning900, Alignments.grow1]}>
            {t('eventDetails.export.personalDataWarning')}
          </Text>
        </View>

        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('eventDetails.export.columnsTitle')}
          </Text>
          {EXPORT_COLUMNS.map((column) => {
            const isRemoved = column.isContact && withoutContacts;
            return (
              <Text
                key={column.key}
                style={[
                  Fonts.p3,
                  column.isContact ? Fonts.error300 : Fonts.neutral200,
                  isRemoved && {
                    color: Colors.neutral400,
                    textDecorationLine: 'line-through',
                  },
                ]}
              >
                {t(`eventDetails.export.columns.${column.key}`)}
              </Text>
            );
          })}
        </View>

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <Checkbox
            onValueChange={setWithoutContacts}
            value={withoutContacts}
          />
          <Text style={[Fonts.p3, Fonts.neutral100, Alignments.grow1]}>
            {t('eventDetails.export.removeContacts')}
          </Text>
        </View>

        <View style={Spaces.gap[8]}>
          <Button
            accessibilityLabel={t('eventDetails.export.confirm')}
            onPress={() => onConfirm({ withoutContacts })}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            title={t('eventDetails.export.confirm')}
          />
          <Button
            accessibilityLabel={t('eventDetails.export.cancel')}
            onPress={onClose}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            title={t('eventDetails.export.cancel')}
            variant="Ghost"
          />
        </View>
      </View>
    </BottomModal>
  );
}

export { EXPORT_COLUMNS };
export default EventExportSheet;
