import { useCallback, useRef, useState } from 'react';

import { ASSISTANCE_CHAT_TYPE, ASSISTANCE_NOM } from '@/domains/messaging/assistance';

import { RouteNames } from '@/navigation/routeNames';

import { ouvrirMaConversationAssistance } from '@/services/chat/assistanceService';

/**
 * MSG-SUPPORT (20/10/2026) — OUVRIR MA CONVERSATION AVEC L'ÉQUIPE FOUNDCLUB.
 *
 * Depuis la ligne épinglée de Messages ou depuis « Nous contacter » (Profil). Si la conversation
 * existe déjà (elle est dans la liste), on l'ouvre ; sinon le serveur la crée à cette première
 * ouverture, puis on l'ouvre. Ensuite, c'est l'écran de conversation ordinaire : envoi, temps
 * réel et rattrapage après une coupure (MSG-NOTIF) servent tels quels.
 *
 * ⚠️ Sans client de requêtes : Messages et Profil sont montés sans lui dans leurs témoins. La
 * liste se relit par `onCree`, que l'écran fournit (son `refetch`).
 * @param {{ espace?: string | null, fil?: any, navigation: any,
 *   onCree?: ((chatId: string) => void) | null }} options
 *   L'espace d'où l'on vient (« ville »), le fil s'il est connu, la navigation, et quoi faire
 *   quand la conversation vient de naître.
 * @returns {{ enCours: boolean, erreur: boolean, ouvrir: () => Promise<void> }} L'ouverture.
 */
const useOuvrirLAssistance = ({
  espace = null, fil = null, navigation, onCree = null,
}) => {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const enVol = useRef(false);

  const ouvrir = useCallback(async () => {
    if (enVol.current) return;
    setErreur(false);
    let chatId = String(fil?.documentId || '');
    if (!chatId) {
      enVol.current = true;
      setEnCours(true);
      try {
        chatId = String((await ouvrirMaConversationAssistance())?.documentId || '');
        if (chatId) onCree?.(chatId);
      } catch {
        chatId = '';
      } finally {
        enVol.current = false;
        setEnCours(false);
      }
    }
    if (!chatId) {
      setErreur(true);
      return;
    }
    navigation?.navigate?.(RouteNames.Conversation, {
      chatId,
      chatType: ASSISTANCE_CHAT_TYPE,
      title: ASSISTANCE_NOM,
      ...(espace ? { espace } : {}),
    });
  }, [espace, fil?.documentId, navigation, onCree]);

  return { enCours, erreur, ouvrir };
};

export default useOuvrirLAssistance;
