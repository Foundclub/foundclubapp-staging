import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  ACTUALITE_ROLES,
  actualiteRoleLabel,
  clubsDuSport,
  sportsDesClubs,
} from '@/domains/collectivite/collectiviteActualites';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import Loader from '@/components/atoms/loader/Loader';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';

import { useCollectiviteClubs } from '@/services/collectivite/collectiviteQueries';

/**
 * 📰 T3-ACTU-CIBLE (03/11/2026, fiche 3 option B) — « Des clubs précis » : les clubs à cocher, le tri
 * par sport et les rôles. Le sport n'est qu'une aide pour cocher : seule la LISTE part au serveur.
 * Un fichier à part : le formulaire ne lit les clubs que si la Ville choisit cette pastille.
 * @param {{
 *   clubIds: string[];
 *   collectiviteId: string | null;
 *   onClubIds: (ids: string[]) => void;
 *   onRoles: (roles: string[]) => void;
 *   roles: string[];
 * }} props - Ce qui est coché, et de quoi le changer.
 * @returns {import('react').ReactElement} Le bloc.
 */
function ActualiteCiblageClubs({
  clubIds,
  collectiviteId,
  onClubIds,
  onRoles,
  roles,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = /** @type {any} */ (useTheme());
  const [sport, setSport] = useState('');
  const clubs = useCollectiviteClubs(collectiviteId);
  const tousLesClubs = Array.isArray(clubs.data) ? clubs.data : [];
  const sports = sportsDesClubs(tousLesClubs);
  const affiches = clubsDuSport(tousLesClubs, sport);
  const idsAffiches = affiches.map((club) => String(club.documentId));
  const toutEstCoche = idsAffiches.length > 0 && idsAffiches.every((id) => clubIds.includes(id));

  const basculerClub = (/** @type {string} */ id) => onClubIds(
    clubIds.includes(id) ? clubIds.filter((autre) => autre !== id) : [...clubIds, id],
  );
  const basculerAffiches = () => onClubIds(toutEstCoche
    ? clubIds.filter((id) => !idsAffiches.includes(id))
    : [...new Set([...clubIds, ...idsAffiches])]);
  // L'ordre de la liste, quel que soit l'ordre des clics.
  const basculerRole = (/** @type {string} */ role) => onRoles(ACTUALITE_ROLES.filter(
    (autre) => (autre === role ? !roles.includes(autre) : roles.includes(autre)),
  ));

  let liste;
  if (clubs.isLoading) {
    liste = <Loader />;
  } else if (clubs.isError) {
    liste = (
      <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error300]}>
        {t('collectiviteActualites.form.clubsIllisibles', 'Les clubs n’ont pas pu être lus.')}
      </Text>
    );
  } else if (tousLesClubs.length === 0) {
    liste = (
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t('collectiviteActualites.form.aucunClub', 'Aucun club n’est rattaché à votre collectivité.')}
      </Text>
    );
  } else {
    liste = (
      <View style={{ gap: 8 }}>
        <Button
          isOption
          onPress={basculerAffiches}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          testID="actualite-form-tout-cocher"
          title={toutEstCoche
            ? t('collectiviteActualites.form.toutDecocher', 'Tout décocher ({{nombre}})', { nombre: affiches.length })
            : t('collectiviteActualites.form.toutCocher', 'Tout cocher ({{nombre}})', { nombre: affiches.length })}
          variant="SecondaryLight"
        />
        {/* Une colonne au téléphone, deux sur ordinateur, sans le demander à l'écran. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {affiches.map((club) => {
            const id = String(club.documentId);
            const coche = clubIds.includes(id);
            return (
              <TouchableOpacity
                accessibilityLabel={String(club.name || '')}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: coche }}
                key={id}
                onPress={() => basculerClub(id)}
                style={{
                  alignItems: 'center',
                  backgroundColor: coche
                    ? withAlpha(Colors.primary500, 0.12)
                    : withAlpha(Colors.neutral00, 0.04),
                  borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18),
                  borderRadius: 12,
                  borderWidth: 1,
                  flexBasis: 260,
                  flexDirection: 'row',
                  flexGrow: 1,
                  gap: 12,
                  minHeight: 44,
                  padding: 12,
                }}
                testID={`actualite-form-club-${id}`}
              >
                {/* La case est un dessin ici : c'est la ligne entière qu'on touche et qu'on entend. */}
                <View
                  accessibilityElementsHidden
                  aria-hidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                >
                  <Checkbox disabled={false} onValueChange={() => {}} value={coche} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{club.name}</Text>
                  {Array.isArray(club.sports) && club.sports.length > 0 ? (
                    <Text style={[Fonts.p4, Fonts.neutral300]}>{club.sports.join(' · ')}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }} testID="actualite-form-clubs">
      {sports.length > 0 ? (
        <ChoiceChipGroup
          onSelect={setSport}
          options={[
            { label: t('collectiviteActualites.form.tousLesSports', 'Tous les sports'), value: '' },
            ...sports.map((nom) => ({ label: nom, value: nom })),
          ]}
          selectedValue={sport}
          title={t('collectiviteActualites.form.trierParSport', 'Trier par sport')}
        />
      ) : null}
      {liste}
      <ChoiceChipGroup
        onSelect={basculerRole}
        options={ACTUALITE_ROLES.map((role) => ({ label: actualiteRoleLabel(t, role), value: role }))}
        selectedValues={roles}
        title={t('collectiviteActualites.form.quiDansCesClubs', 'Qui, dans ces clubs ?')}
      />
    </View>
  );
}

export default ActualiteCiblageClubs;
