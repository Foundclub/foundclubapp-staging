import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import SearchBar from '@/components/molecules/searchBar/SearchBar';

import { getClubs } from '@/services/club/clubService';
import { getTeams } from '@/services/team/teamService';

const LONGUEUR_MINIMALE = 2;
const NOMBRE_DE_CLUBS = 10;

/**
 * T3-TOURNOI-PRIVE (Adel « 6 A », 02/11) — trouver une équipe d'un autre club :
 * son club, puis l'équipe.
 * Ne passe pas par `EventWizardOpponentInvite` : il écrit dans le brouillon du tunnel,
 * qui survit en `sessionStorage`, et un match créé ensuite aurait emporté l'équipe du tournoi.
 * @param {{
 *   exclureClubId?: string | null,
 *   onChoisir: (equipe: any) => void,
 *   equipesDejaInvitees: Set<string>,
 * }} props - Le choix.
 * @returns {import('react').JSX.Element} La recherche.
 */
export default function TournamentTeamSearch({
  equipesDejaInvitees,
  exclureClubId = null,
  onChoisir,
}) {
  const { t } = useTranslation();
  const { ApplicationStyle, Fonts, Spaces } = useTheme();
  const [saisie, setSaisie] = useState('');
  const [nom, setNom] = useState('');
  const [club, setClub] = useState(/** @type {any} */ (null));

  useEffect(() => {
    const minuterie = setTimeout(() => setNom(saisie.trim()), 250);
    return () => clearTimeout(minuterie);
  }, [saisie]);

  const clubs = useQuery({
    enabled: !club && nom.length >= LONGUEUR_MINIMALE,
    queryFn: () => getClubs({ includeMultisport: false, name: nom, pageSize: NOMBRE_DE_CLUBS }),
    queryKey: ['tournoi-recherche-clubs', nom],
  });
  const equipes = useQuery({
    enabled: Boolean(club?.documentId),
    queryFn: () => getTeams({ clubId: club.documentId, pageSize: 100, summary: true }),
    queryKey: ['tournoi-recherche-equipes', club?.documentId],
  });

  const clubsRecus = clubs.data?.data;
  const equipesRecues = equipes.data?.data;
  const clubsTrouves = (Array.isArray(clubsRecus) ? clubsRecus : [])
    .filter((/** @type {any} */ candidat) => (
      candidat?.documentId && candidat.documentId !== exclureClubId
    ));
  const equipesDuClub = (Array.isArray(equipesRecues) ? equipesRecues : [])
    .filter((/** @type {any} */ equipe) => (
      equipe?.documentId && !equipesDejaInvitees.has(equipe.documentId)
    ));
  const enPanne = clubs.isError || equipes.isError;
  const rienTrouve = club
    ? !equipes.isLoading && !equipes.isError && !equipesDuClub.length
    : nom.length >= LONGUEUR_MINIMALE && !clubs.isLoading && !clubs.isError && !clubsTrouves.length;

  return (
    <View
      style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12]]}
      testID="tournoi-recherche"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('tournamentInvites.otherClubTitle', "Inviter l'équipe d'un autre club")}
      </Text>
      {club ? (
        <>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{club.name}</Text>
          {equipesDuClub.map((/** @type {any} */ equipe) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={equipe.documentId}
              onPress={() => onChoisir(equipe)}
              style={Spaces.paddingVertical[8]}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary100]}>{equipe.name}</Text>
            </TouchableOpacity>
          ))}
          <Button
            onPress={() => setClub(null)}
            size="sm"
            title={t('tournamentInvites.changeClub', 'Changer de club')}
            variant="Secondary"
          />
        </>
      ) : (
        <>
          <SearchBar
            onChangeText={setSaisie}
            placeholder={t('tournamentInvites.searchClub', 'Rechercher un club')}
            value={saisie}
            withCalendar={false}
            withFilter={false}
          />
          {clubsTrouves.map((/** @type {any} */ candidat) => (
            <ClubSearchResultCard
              item={candidat}
              key={candidat.documentId}
              onPress={() => setClub(candidat)}
            />
          ))}
        </>
      )}
      {rienTrouve ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {club
            ? t('tournamentInvites.noTeam', 'Aucune équipe à inviter dans ce club.')
            : t('tournamentInvites.noClub', 'Aucun club trouvé.')}
        </Text>
      ) : null}
      {enPanne ? (
        <Text style={[Fonts.p3, Fonts.error500]}>
          {t(
            'tournamentInvites.searchError',
            'La recherche a échoué. Réessaie dans un instant.',
          )}
        </Text>
      ) : null}
    </View>
  );
}
