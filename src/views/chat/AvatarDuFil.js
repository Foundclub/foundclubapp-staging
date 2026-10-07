import { View } from 'react-native';

import { resolveFriendlyMatchOpponent } from '@/domains/messaging/messagingUseCases';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';
import { IconeDuCanal } from '@/views/collectivite/components/FilDeLaVille';

/**
 * MSG1A — L'AVATAR D'UNE CONVERSATION, UNE SEULE REGLE POUR LA LISTE ET L'EN-TETE DU FIL.
 *
 * Repris de `Messaging.js` (`renderConversationAvatar`), le meme `switch` par type de fil,
 * avec un seul changement voulu par le pack (§3.13, §3.16) : un GROUPE porte son ecusson
 * aux initiales de son nom (il n'a pas de photo cote serveur), plus la photo du premier
 * autre membre — qui faisait passer un groupe pour un tete-a-tete.
 *
 * Tailles du pack : 52 dans la liste ; dans l'en-tete, 38 pour un fil a plusieurs, 36 pour
 * une personne. L'ecusson se dessine a 90 % de la place (SPECS.md §1).
 * @param {object} props
 * @param {any} props.chat - Le fil (`type`, `club`, `team`, `participants`...).
 * @param {boolean} [props.espaceVille] - Vu depuis l'espace de la Ville.
 * @param {string} [props.meId] - Mon identifiant.
 * @param {any[]} [props.myTeams] - Mes equipes (adversaire d'un match amical).
 * @param {number} [props.size] - La place de l'avatar.
 * @returns {import('react').ReactElement} L'avatar.
 */
function AvatarDuFil({
  chat, espaceVille = false, meId = '', myTeams = [], size = 52,
}) {
  const { Colors } = useTheme();
  const ecusson = Math.round(size * 0.9);
  /** @type {import('react-native').ViewStyle} */
  const place = {
    alignItems: 'center', height: size, justifyContent: 'center', width: size,
  };

  let contenu;
  switch (chat?.type) {
    case 'club':
      contenu = <ClubLogoMark club={chat?.club} isNeutral size={ecusson} />;
      break;
    // COLL-C4A2 — la conversation privée porte l'écusson d'en face (le club côté Ville, la
    // Ville côté club) ; le canal des dirigeants, sa tuile.
    case 'collectivite_club':
      contenu = espaceVille
        ? <ClubLogoMark club={chat?.collectiviteClub} isNeutral size={ecusson} />
        : <EcussonVille nom={String(chat?.collectivite?.name || '')} taille={ecusson} />;
      break;
    case 'collectivite_dirigeants':
      contenu = <IconeDuCanal taille={ecusson} />;
      break;
    case 'friendly_match': {
      // AC05 constat 3 — le camp d'en face, en initiales ; sans adversaire sûr, le repli neutre.
      const opponent = resolveFriendlyMatchOpponent({ chat, myTeams });
      contenu = opponent
        ? <ClubLogoMark logoUrl={opponent.logoUrl} name={opponent.name} size={ecusson} />
        : <ProfileAvatar enablePreview={false} size={size} />;
      break;
    }
    case 'group':
      contenu = <ClubLogoMark name={String(chat?.groupName || '').trim() || 'Groupe'} size={ecusson} />;
      break;
    case 'league_match':
      contenu = (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: Colors.neutral900,
            borderColor: Colors.gold500,
            borderRadius: size / 2,
            borderWidth: 2,
            height: size,
            justifyContent: 'center',
            width: size,
          }}
        >
          <SvgIcon color={Colors.gold500} height={size * 0.45} name="trophy" width={size * 0.45} />
        </View>
      );
      break;
    case 'multisport':
      contenu = <ClubLogoMark club={chat?.multisportClub} isNeutral size={ecusson} />;
      break;
    case 'team':
      contenu = (
        <ClubLogoMark
          club={chat?.team}
          name={chat?.team?.club?.name || chat?.team?.name}
          size={ecusson}
        />
      );
      break;
    case 'whisper': {
      const participant = chat?.participants?.find((p) => p?.documentId !== meId)
        || chat?.participants?.[0];
      contenu = (
        <ProfileAvatar
          enablePreview={false}
          imageStyle={{ borderRadius: size }}
          imageUrl={participant?.avatar?.url}
          name={[participant?.firstname, participant?.lastname].filter(Boolean).join(' ')}
          size={size}
        />
      );
      break;
    }
    default:
      // Type inconnu : aucun nom fiable a montrer, donc le repli neutre de ProfileAvatar.
      contenu = <ProfileAvatar enablePreview={false} size={size} />;
  }

  return <View style={place} testID={`avatar-du-fil-${chat?.type || 'inconnu'}`}>{contenu}</View>;
}

export default AvatarDuFil;
