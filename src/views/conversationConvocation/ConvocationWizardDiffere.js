/**
 * MESSAGERIE-1C — L'ASSISTANT, CHARGE SEULEMENT QUAND ON L'OUVRE.
 *
 * 📏 Mesure du 07/10 : importer l'assistant en tete du fil tirait `SubscriptionPaywallSheet`, donc
 * `subscriptionService` et le stockage natif, dans le graphe de `Conversation.js` — 11 suites de
 * temoins du fil sont tombees d'un coup (« AsyncStorage is null »), et chaque ouverture de fil
 * aurait charge un mur payant que presque personne n'ouvre. Le fil ne monte donc que cette porte ;
 * le `require` part au premier rendu, c'est-a-dire au premier appui sur « Convocation ».
 * (Meme motif que `deferredInviteRecovery.js` et `subscriptionRevenueCat.js`.)
 * @param {object} props Les props de `ConvocationWizard`, transmises telles quelles.
 * @param {string} props.chatId
 * @param {any} [props.eventSummary]
 * @param {string} [props.initialEventId]
 * @param {'create' | 'edit'} [props.mode]
 * @param {(result?: { published: boolean }) => void} props.onClose
 * @param {number} [props.startStep]
 * @param {string} props.teamId
 * @param {string} [props.teamName]
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function ConvocationWizardDiffere({
  chatId,
  eventSummary = null,
  initialEventId = '',
  mode = 'create',
  onClose,
  startStep = 2,
  teamId,
  teamName = '',
  visible,
}) {
  // eslint-disable-next-line global-require
  const ConvocationWizard = require('./ConvocationWizard').default;
  return (
    <ConvocationWizard
      chatId={chatId}
      eventSummary={eventSummary}
      initialEventId={initialEventId}
      mode={mode}
      onClose={onClose}
      startStep={startStep}
      teamId={teamId}
      teamName={teamName}
      visible={visible}
    />
  );
}

export default ConvocationWizardDiffere;
