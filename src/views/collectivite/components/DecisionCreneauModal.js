import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  useApproveFacilityOverrideRequest,
  useRefuseFacilityOverrideRequest,
} from '@/services/facility/facilityQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/** @typedef {{ kind: 'approve' | 'refuse', request: any }} Decision */

/**
 * 🏛️ LA FENÊTRE « ACCEPTER / REFUSER » D'UNE DEMANDE DE CRÉNEAU, côté mairie.
 *
 * COLL-ACCUEIL (01/10) : sortie TELLE QUELLE de « Demandes de la Ville »
 * (CollectiviteRequests, lot 1c), pour que l'accueil de la Ville tranche la demande qu'il
 * montre en tête avec la MÊME fenêtre, les mêmes routes (lot 3a) et les mêmes textes. Le
 * message est facultatif pour accepter, obligatoire pour refuser (c'est le motif que le
 * club lira). Le serveur juge et prévient le demandeur, et l'occupant s'il y en avait un.
 * @param {{ decision: Decision | null, onClose: () => void }} props - La décision en cours
 *   (null : fenêtre fermée) et sa fermeture.
 * @returns {import('react').ReactElement} La fenêtre.
 */
function DecisionCreneauModal({ decision, onClose }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const approve = /** @type {any} */ (useApproveFacilityOverrideRequest());
  const refuse = /** @type {any} */ (useRefuseFacilityOverrideRequest());
  const enCours = Boolean(approve.isPending || refuse.isPending);

  // Chaque ouverture repart d'une fenêtre vide.
  useEffect(() => {
    setMessage('');
    setErreur('');
  }, [decision]);

  const fermer = () => {
    if (enCours) return;
    setErreur('');
    onClose();
  };
  const confirmer = async () => {
    if (!decision) return;
    const decisionReason = message.trim();
    if (decision.kind === 'refuse' && !decisionReason) {
      setErreur(t(
        'collectivite.requests.modal.reasonRequired',
        'Écrivez le motif : le club le lira.',
      ));
      return;
    }
    const mutation = decision.kind === 'approve' ? approve : refuse;
    try {
      await mutation.mutateAsync({ decisionReason, requestId: decision.request?.documentId });
      onClose();
    } catch (error) {
      setErreur(getErrorMessage(/** @type {any} */ (error)));
    }
  };

  const estRefus = decision?.kind === 'refuse';
  const fenetreStyle = {
    borderColor: `${Colors.primary500}66`,
    maxWidth: 520,
    padding: 20,
    width: /** @type {const} */ ('100%'),
  };
  const champStyle = {
    borderColor: `${Colors.primary500}44`,
    minHeight: 110,
    textAlignVertical: /** @type {const} */ ('top'),
  };

  return (
    <Modal animationType="fade" onRequestClose={fermer} transparent visible={Boolean(decision)}>
      <View
        style={[
          Alignments.fill,
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.padding[24],
          { backgroundColor: `${Colors.neutral900}B3` },
        ]}
      >
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.gap[16],
            fenetreStyle,
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {estRefus
              ? t('collectivite.requests.modal.refuseTitle', 'Refuser la demande')
              : t('collectivite.requests.modal.approveTitle', 'Accepter la demande')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {estRefus
              ? t(
                'collectivite.requests.modal.refuseHint',
                'Le club reçoit votre motif ; son entraînement est annulé.',
              )
              : t(
                'collectivite.requests.modal.approveHint',
                // eslint-disable-next-line max-len
                'Le club reçoit votre réponse et votre message. S’il y avait un occupant, il est prévenu.',
              )}
          </Text>
          <TextInput
            multiline
            onChangeText={setMessage}
            placeholder={estRefus
              ? t(
                'collectivite.requests.modal.refusePlaceholder',
                'Le motif du refus (obligatoire)',
              )
              : t(
                'collectivite.requests.modal.approvePlaceholder',
                'Un mot pour le club (facultatif)',
              )}
            placeholderTextColor={Colors.neutral400}
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Fonts.p2,
              Fonts.neutral00,
              Spaces.padding[16],
              champStyle,
            ]}
            testID="collectivite-request-message"
            value={message}
          />
          {erreur ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreur}</Text> : null}
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                disabled={enCours}
                onPress={fermer}
                title={t('collectivite.requests.modal.cancel', 'Annuler')}
                variant="Secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                disabled={enCours}
                onPress={confirmer}
                title={estRefus
                  ? t('collectivite.requests.actions.refuse', 'Refuser')
                  : t('collectivite.requests.actions.approve', 'Accepter')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default DecisionCreneauModal;
