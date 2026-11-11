import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { messageDeRefusResa } from '@/domains/complexe/complexeReservation';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { RouteNames } from '@/navigation/routeNames';

import { useEcrireAuReserveur } from '@/services/complexe/complexeQueries';

/**
 * ✉️ « ÉCRIRE AU CLIENT » — MESSAGERIE-COMPLEXE (10/11/2026, ligne Gérant 47 / M1137), sur la
 * fiche d'une réservation (E-G05) et sur la fiche client (E-G15).
 *
 * Le fil complexe ↔ client (UN par complexe et par client, décision du chef) NAÎT AU PREMIER
 * MESSAGE, comme « Écrire aux dirigeants » de la Ville (COLL-FIX-DEMANDES) : l'appui le RETROUVE
 * (sans rien créer) ; s'il existe, il s'ouvre dans l'espace du complexe ; sinon le bouton devient,
 * sur place, la saisie du premier message, et c'est l'envoi qui le crée puis l'ouvre. Avant, un
 * simple appui posait une conversation vide.
 *
 * La fiche d'une réservation pose `EcrireAuClient` (la saisie prend la place du bouton) ; la fiche
 * client garde son bouton dans l'en-tête (`BoutonEcrire`) et pose la saisie dessous
 * (`SaisiePremierMessage`), le même geste (`useEcrireAuClient`) les reliant.
 */

/**
 * Le geste « Écrire au client » : retrouver le fil, ou ouvrir la saisie du premier message, puis
 * créer le fil à l'envoi ; un refus se dit (`erreur`).
 * @param {object} params - Le geste.
 * @param {string} params.complexeId - documentId du complexe.
 * @param {{ navigate: Function }} params.navigation - La navigation de l'écran.
 * @param {string} params.reservationId - La réservation qui rattache le fil (documentId).
 * @returns {{ annuler: () => void, enCours: boolean, envoyer: () => Promise<void>, erreur: string,
 *   ouvrir: () => Promise<void>, premierMessage: string | null,
 *   setPremierMessage: (texte: string) => void }} L'état et les gestes.
 */
export const useEcrireAuClient = ({ complexeId, navigation, reservationId }) => {
  const { t } = useTranslation();
  const ecrire = useEcrireAuReserveur();
  const [erreur, setErreur] = useState('');
  // null : le bouton ; un texte : le premier message, en cours d'écriture.
  const [premierMessage, setPremierMessage] = useState(/** @type {string | null} */ (null));
  const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');

  const agir = async (/** @type {string} */ message) => {
    setErreur('');
    try {
      const reponse = await ecrire.mutateAsync({
        complexeId, reservationId, ...(message ? { message } : {}),
      });
      const chatId = reponse?.data?.chat;
      if (chatId) {
        setPremierMessage(null);
        // RESA-FIN-APP-3 : `espace: 'complexe'` — sur le site, la conversation garde la barre du
        // gérant (comme le canal), au lieu des onglets du joueur.
        navigation.navigate(RouteNames.Conversation, { chatId, espace: 'complexe' });
      } else if (!message) {
        setPremierMessage('');
      }
    } catch (probleme) {
      setErreur(messageDeRefusResa(t, probleme, repli));
    }
  };

  return {
    annuler: () => {
      setErreur('');
      setPremierMessage(null);
    },
    enCours: Boolean(ecrire.isPending),
    envoyer: () => agir(String(premierMessage || '').trim()),
    erreur,
    ouvrir: () => agir(''),
    premierMessage,
    setPremierMessage,
  };
};

/**
 * La ligne d'erreur, puis (quand le fil n'existe pas encore) la saisie du premier message.
 * @param {{ ecriture: ReturnType<typeof useEcrireAuClient>, testID: string }} props - L'état du
 *   geste (`useEcrireAuClient`) et le repère.
 * @returns {import('react').ReactElement | null} La saisie, l'erreur, ou rien.
 */
export function SaisiePremierMessage({ ecriture, testID }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const {
    annuler, enCours, envoyer, erreur, premierMessage, setPremierMessage,
  } = ecriture;
  const ligneErreur = erreur ? (
    <Text
      accessibilityRole="alert"
      style={[Fonts.p2Bold, Fonts.error300]}
      testID={`${testID}-erreur`}
    >
      {erreur}
    </Text>
  ) : null;
  if (premierMessage === null) return ligneErreur;
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }} testID={`${testID}-saisie`}>
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        {t('complexeReservations.fiche.premierMessageTitre', 'Ton premier message à ton client')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'complexeReservations.fiche.premierMessageAide',
          'La conversation s’ouvre quand tu envoies ce message.',
        )}
      </Text>
      <Input
        multiline
        onChangeText={setPremierMessage}
        testID={`${testID}-premier-message`}
        value={premierMessage}
      />
      <View testID={`${testID}-envoyer`}>
        <Button
          disabled={!premierMessage.trim()}
          icon="send"
          isLoading={enCours}
          onPress={envoyer}
          title={t('complexeReservations.fiche.premierMessageEnvoyer', 'Envoyer')}
          variant="Primary"
        />
      </View>
      <View testID={`${testID}-annuler`}>
        <Button
          disabled={enCours}
          isOption
          onPress={annuler}
          size="sm"
          title={t('complexeReservations.fiche.premierMessageAnnuler', 'Annuler')}
          variant="SecondaryLight"
        />
      </View>
      {ligneErreur}
    </View>
  );
}

/**
 * Le bouton seul, puis la saisie à sa place (fiche d'une réservation).
 * @param {{ complexeId: string, navigation: { navigate: Function }, reservationId: string,
 *   size?: string, testID: string, title: string }} props - Le complexe, la réservation qui
 *   rattache le fil, la navigation de l'écran, la taille, le repère et le libellé du bouton.
 * @returns {import('react').ReactElement} Le bouton, ou la saisie du premier message.
 */
function EcrireAuClient({
  complexeId, navigation, reservationId, size = undefined, testID, title,
}) {
  const ecriture = useEcrireAuClient({ complexeId, navigation, reservationId });
  return (
    <>
      {ecriture.premierMessage === null ? (
        <BoutonEcrire ecriture={ecriture} size={size} testID={testID} title={title} />
      ) : null}
      <SaisiePremierMessage ecriture={ecriture} testID={testID} />
    </>
  );
}

/**
 * Le bouton « Écrire au client » (ou « Écrire » sur la fiche client).
 * @param {{ ecriture: ReturnType<typeof useEcrireAuClient>, size?: string, testID: string,
 *   title: string }} props - L'état du geste, la taille, le repère et le libellé.
 * @returns {import('react').ReactElement} Le bouton.
 */
export function BoutonEcrire({
  ecriture, size = undefined, testID, title,
}) {
  return (
    <View testID={testID}>
      <Button
        isLoading={ecriture.enCours}
        onPress={ecriture.ouvrir}
        size={size}
        title={title}
        variant="Secondary"
      />
    </View>
  );
}

export default EcrireAuClient;
