import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  estFilDAssistance,
  estReponseDeLAssistance,
  nomCourt,
  titulaireDuFil,
} from '@/domains/messaging/assistance';

import { useFilDeLaVille } from '@/views/collectivite/components/FilDeLaVille';

import { useRepondantsAssistance } from '@/services/chat/assistanceQueries';

/**
 * MSG-SUPPORT (20/10/2026) — CE QUE LA CONVERSATION FAIT DE DIFFÉRENT POUR L'ASSISTANCE.
 *
 * Deux regards sur le même fil :
 *   · le TITULAIRE (tout compte, mineur compris) : « Assistance FoundClub », « L'équipe
 *     FoundClub te répond ici », et chaque réponse signée « Assistance FoundClub » ;
 *   · l'ÉQUIPE (un super-admin, depuis la boîte commune) : le nom du titulaire en titre, ses
 *     réponses et celles des collègues À DROITE (« notre » côté), signées « Assistance FoundClub ·
 *     Sophie A. » — la console voit qui a répondu (`repondants`, route réservée).
 * @param {{ chatData: any, chatId: string, espaceVille?: boolean, messagesPages?: any,
 *   routeChatType?: string | null }} params - Le fil et ses messages.
 * @returns {{ estAssistance: boolean, estDeMonCote: (message: any) => boolean,
 *   estEquipe: boolean, nomDeLExpediteur: (message: any) => string | null,
 *   placeholder: string | null,
 *   sousTitre: string, titre: string, videTexte: string, videTitre: string }} L'habillage.
 */
export const useFilDAssistance = ({
  chatData, chatId, espaceVille = false, messagesPages = null, routeChatType = null,
}) => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const estAssistance = estFilDAssistance(chatData?.type || routeChatType);
  const moi = String(userData?.documentId || '');
  const titulaire = titulaireDuFil(chatData);
  const estEquipe = estAssistance
    && getUserRoleKey(userData?.role?.type || userData?.role?.name) === 'superAdmin'
    && Boolean(titulaire) && String(titulaire?.documentId || '') !== moi;
  const dernierMessageId = String(messagesPages?.pages?.[0]?.data?.[0]?.documentId || '');
  const repondants = useRepondantsAssistance(chatId, dernierMessageId, {
    enabled: estEquipe && Boolean(chatId),
  });

  return useMemo(() => {
    const nom = t('assistance.titre', 'Assistance FoundClub');
    const prenom = String(titulaire?.firstname || '').trim();
    const titreEquipe = `${prenom} ${String(titulaire?.lastname || '').trim()}`.trim()
      || t('assistance.console.compteSupprime', 'Compte supprimé');
    /**
     * Le texte du titulaire : tutoyé, vouvoyé dans l'espace de la Ville.
     * @param {string} cle - La clé tutoyée (la vouvoyée est `<cle>Vous`).
     * @param {string} toi - Le texte tutoyé.
     * @param {string} vous - Le texte vouvoyé.
     * @returns {string} Le texte.
     */
    const pourLeTitulaire = (cle, toi, vous) => (espaceVille ? t(`${cle}Vous`, vous) : t(cle, toi));
    return {
      estAssistance,
      estDeMonCote: (/** @type {any} */ message) => estEquipe && estReponseDeLAssistance(message),
      estEquipe,
      nomDeLExpediteur: (/** @type {any} */ message) => {
        if (!estAssistance || !estReponseDeLAssistance(message)) return null;
        const repondant = repondants.data?.[String(message?.documentId || '')];
        const auteur = estEquipe ? nomCourt(repondant) : '';
        return auteur ? `${nom} · ${auteur}` : nom;
      },
      placeholder: estEquipe
        ? t('assistance.console.placeholder', 'Répondre au nom d’Assistance FoundClub')
        : pourLeTitulaire(
          'assistance.placeholder',
          'Écris ton message à l’équipe',
          'Écrivez votre message à l’équipe',
        ),
      sousTitre: estEquipe
        ? t(
          'assistance.console.sousTitre',
          'Boîte commune · ta réponse est signée Assistance FoundClub',
        )
        : pourLeTitulaire(
          'assistance.sousTitre',
          'L’équipe FoundClub te répond ici',
          'L’équipe FoundClub vous répond ici',
        ),
      titre: estEquipe ? titreEquipe : nom,
      videTexte: pourLeTitulaire(
        'assistance.vide.texte',
        'Seule l’équipe FoundClub lit ici. Une notification t’annonce notre réponse.',
        'Seule l’équipe FoundClub lit ici. Une notification vous annonce notre réponse.',
      ),
      videTitre: pourLeTitulaire(
        'assistance.vide.titre',
        'Une question ? Écris-nous.',
        'Une question ? Écrivez-nous.',
      ),
    };
  }, [espaceVille, estAssistance, estEquipe, repondants.data, t, titulaire]);
};

/**
 * L'habillage d'un fil pour la conversation : celui des fils de la Ville (`useFilDeLaVille`),
 * et, pour une conversation d'assistance, ses titres, sa signature et ses textes par-dessus.
 * Les deux écrans de conversation (téléphone et site) le lisent sous le nom `filDeLaVille`.
 * @param {{ chatData: any, chatId: string, espaceVille?: boolean, messagesError?: unknown,
 *   messagesPages?: any, navigation: any, routeChatType?: string | null }} params - Le fil.
 * @returns {ReturnType<typeof useFilDeLaVille> & Partial<ReturnType<typeof useFilDAssistance>>}
 *   L'habillage.
 */
export const useHabillageDuFil = ({ messagesPages = null, ...params }) => {
  const ville = useFilDeLaVille(params);
  const assistance = useFilDAssistance({ ...params, messagesPages });
  return useMemo(() => (assistance.estAssistance ? {
    ...ville,
    estAssistance: true,
    estDeMonCote: assistance.estDeMonCote,
    nomDeLExpediteur: assistance.nomDeLExpediteur,
    peutEcrire: true,
    placeholder: assistance.placeholder,
    sousTitre: assistance.sousTitre,
    titre: assistance.titre,
    videTexte: assistance.videTexte,
    videTitre: assistance.videTitre,
  } : ville), [assistance, ville]);
};
