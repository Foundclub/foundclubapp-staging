import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { estDeCompetition, familleDuSport } from '@/domains/activity/familleDuSport';
import { computeAge, extractCity } from '@/domains/playerCard/cardModel';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * INSCRIPTION-CODE-4 (20/11/2026, planche V2 B1-B5 validée « ok ») — LES CINQ « BIENVENUE ».
 * Un titre « Bienvenue, {{prénom}} », la phrase du cas (ce qui est parti au club), la carte du
 * joueur (B1-B3 seulement : coach et parent n'ont pas de carte), « Ce que tu peux faire
 * maintenant », puis UNE sortie. Le dirigeant et le super-admin n'ont pas de cas (écran
 * d'aujourd'hui, décision du chef n° 1).
 * Ce que disaient les 4 phrases d'avant est DÉPLACÉ, pas retiré : « Recherche des clubs et des
 * événements », « Inscris-toi à des entraînements et détections », « Rejoins un club » (joueur)
 * et « Cherche un club », « Déclare ton enfant », « Demande à rejoindre un club » (parent)
 * deviennent les lignes d'action ; « Reste informé·e … notifications » reste en petite ligne en
 * bas (décision du chef n° 2).
 */

/** Les replis des textes (fr.js les porte aussi : une clé absente ne s'affiche jamais nue). */
/** @type {Record<string, string>} */
const REPLIS = {
  allerAccueil: 'Aller à mon accueil',
  'carte.age': 'Âge',
  'carte.ans': '{{age}} ans',
  'carte.aucun': 'Aucun',
  'carte.club': 'Club',
  'carte.enAttente': 'En attente',
  'carte.niveau': 'Niveau',
  'carte.ville': 'Ville',
  'coach.entrainement': 'Créer ton premier entraînement',
  'coach.inviter': 'Inviter tes joueurs par un lien',
  'coach.offreGratuite': 'Offre gratuite',
  'coach.offresApres': 'Les offres payantes viennent après, seulement si tu en as besoin.',
  'coach.phrase': 'Ton compte de coach est prêt. Le club a reçu ta demande pour les {{equipe}}.',
  'coach.phraseSansEquipe': 'Ton compte de coach est prêt.',
  'coach.uneEquipe': '1 équipe',
  'coach.voirOffres': 'Voir les offres',
  'joueurAvecClub.photo': 'Compléter ta carte : il manque ta photo',
  'joueurAvecClub.phrase': 'Ton compte est prêt. {{club}} a reçu ta demande.',
  'joueurAvecClub.voir': 'Voir les matchs et les entraînements près de chez toi',
  notifications: 'Reste informé·e des nouveautés grâce aux notifications.',
  'parent.declarer': 'Déclarer ton enfant',
  'parent.declarerUnAutre': 'Déclarer un autre enfant',
  'parent.phrase': 'Ton compte de parent est prêt. {{enfant}} est déclaré·e : tu réponds à '
    + 'ses convocations à sa place.',
  'parent.phrasePlusieurs': 'Ton compte de parent est prêt. Tes {{nombre}} enfants sont déclaré·es '
    + ': tu réponds à leurs convocations à leur place.',
  'parent.phraseSansEnfant': 'Ton compte de parent est prêt. Déclare ton enfant : '
    + 'tu répondras à ses '
    + 'convocations à sa place.',
  'parent.sortie': 'Trouver son club',
  'parent.trouverLeClubDe': 'Trouver le club de {{activite}} de {{enfant}}',
  'parent.trouverLeClubDeEnfant': 'Trouver le club de {{enfant}}',
  'parent.trouverUnClub': 'Trouver un club pour ton enfant',
  peuxFaire: 'Ce que tu peux faire maintenant',
  phraseMembre: 'Ton compte est prêt. Tu fais partie de {{club}}.',
  'pratiquant.ecrire': 'Écrire au club',
  'pratiquant.phrase': 'Ton compte est prêt. Ton club a reçu ta demande : tu verras ses '
    + '{{rendezVous}} dès qu’il t’aura accepté.',
  'pratiquant.voir': 'Voir les sorties ouvertes près de chez toi',
  'pratiquant.voirAutre': 'Voir les activités ouvertes près de chez toi',
  'pratiquant.voirCulture': 'Voir les cours ouverts près de chez toi',
  'rendezVous.autre': 'activités',
  'rendezVous.culture': 'cours',
  'rendezVous.nature': 'sorties',
  'sansClub.clubs': 'Voir les clubs près de chez toi',
  'sansClub.clubsDeActivite': 'Voir les clubs de {{activite}} près de chez toi',
  'sansClub.clubsDeActiviteVille': 'Voir les clubs de {{activite}} près de {{ville}}',
  'sansClub.essais': 'Voir les séances d’essai et les détections ouvertes',
  'sansClub.essaisCulture': 'Voir les cours d’essai ouverts',
  'sansClub.essaisNature': 'Voir les séances découverte ouvertes',
  'sansClub.phrase': 'Ton compte est prêt. Tu n’as pas encore de club : on t’aide à en trouver un.',
  'sansClub.sortie': 'Trouver un club',
  titre: 'Bienvenue, {{prenom}}',
  titreSansPrenom: 'Bienvenue',
};

/**
 * Le mot de l'activité dans une phrase : « football », mais « VTT ».
 * @param {string} activite Le nom de l'activité.
 * @returns {string} Le mot à placer dans la phrase.
 */
const dansLaPhrase = (activite) => (activite === activite.toUpperCase()
  ? activite
  : activite.charAt(0).toLowerCase() + activite.slice(1));

/**
 * Le « Bienvenue » d'un cas (B1 à B5).
 * @param {object} props
 * @param {{ cas: string, club: any, enAttente: boolean, equipe: string | null }} props.cas
 * @param {any} props.userData Le compte.
 * @param {any[]} props.enfants Les enfants déclarés (parent).
 * @param {boolean} props.lignesDuCoachSortent Faux quand le tour guidé du coach est
 *   obligatoire :
 *   ses lignes se lisent sans quitter l'écran (le tour reste la seule sortie, 10/07/2026).
 * @param {string | null} props.offreCadeau La phrase du cadeau (« 110- A », « 201 A »), sinon rien.
 * @param {() => void} props.onAccueil « Aller à mon accueil » (tour du joueur ou du coach).
 * @param {(route: string, params?: object) => void} props.onAller Sortie vers un écran précis.
 * @param {(() => void) | null} props.onInviter Le lien d'invitation, ou rien sans équipe acceptée.
 * @param {() => void} props.onVoirOffres Ouvre le bloc des offres d'aujourd'hui (coach).
 * @returns {import('react').ReactElement} L'écran.
 */
function BienvenueParCas({
  cas, enfants, lignesDuCoachSortent, offreCadeau, onAccueil, onAller, onInviter, onVoirOffres,
  userData,
}) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const tr = (/** @type {string} */ cle, vars = {}) => t(
    `welcome.cas.${cle}`,
    { defaultValue: REPLIS[cle], interpolation: { escapeValue: false }, ...vars },
  );

  const prenom = String(userData?.firstname || '').trim();
  const activite = String(userData?.preferredSport || '').trim();
  const famille = familleDuSport(activite);
  const ville = extractCity(userData?.address) || '';
  const nomDuClub = String(cas.club?.name || '').trim();
  const premierEnfant = String(enfants?.[0]?.firstname || '').trim();
  // La carte « sans terrain ni numéro » (B3) vaut aussi pour un pratiquant SANS club (B2).
  const carteSansTerrain = cas.cas === 'pratiquant'
    || (cas.cas === 'sansClub' && !estDeCompetition(activite));

  // Le rendez-vous du club selon la famille : « sorties » (nature), « cours » (culture).
  let rendezVous = tr('rendezVous.autre');
  let voirRendezVous = tr('pratiquant.voirAutre');
  if (famille === 'nature') {
    rendezVous = tr('rendezVous.nature');
    voirRendezVous = tr('pratiquant.voir');
  }
  if (famille === 'culture') {
    rendezVous = tr('rendezVous.culture');
    voirRendezVous = tr('pratiquant.voirCulture');
  }

  /** @type {{ cle: string, icone: any, texte: string, onPress?: (() => void) | null }[]} */
  let lignes = [];
  let phrase = '';
  let sortie = { onPress: onAccueil, titre: tr('allerAccueil') };
  const versRecherche = () => onAller('SearchClubs');
  const versEvenements = () => onAller('SearchEvents');

  if (cas.cas === 'joueurAvecClub' || cas.cas === 'pratiquant') {
    const cle = cas.cas;
    phrase = cas.enAttente
      ? tr(`${cle}.phrase`, { club: nomDuClub, rendezVous })
      : tr('phraseMembre', { club: nomDuClub });
    lignes = cle === 'pratiquant'
      ? [
        {
          cle: 'evenements',
          icone: Images.calendar,
          onPress: versEvenements,
          texte: voirRendezVous,
        },
        // ponytail: « Écrire au club » ouvre la PAGE du club (son bouton de contact y est) ;
        // aucune messagerie directe vers un club n'existe dans l'app aujourd'hui.
        {
          cle: 'ecrire',
          icone: Images.envelope,
          onPress: cas.club?.documentId
            ? () => onAller('ClubStack', {
              params: { clubId: cas.club.documentId }, screen: 'Club',
            })
            : null,
          texte: tr('pratiquant.ecrire'),
        },
      ]
      : [
        {
          cle: 'evenements',
          icone: Images.calendar,
          onPress: versEvenements,
          texte: tr('joueurAvecClub.voir'),
        },
      ];
    if (cle === 'joueurAvecClub' && !(userData?.avatar?.url || userData?.avatarUrl)) {
      lignes.push({
        cle: 'carte',
        icone: Images.edit,
        onPress: () => onAller('ProfileStack', { screen: 'PlayerCard' }),
        texte: tr('joueurAvecClub.photo'),
      });
    }
  } else if (cas.cas === 'sansClub') {
    phrase = tr('sansClub.phrase');
    let voirClubs = tr('sansClub.clubs');
    if (activite && ville) {
      voirClubs = tr('sansClub.clubsDeActiviteVille', {
        activite: dansLaPhrase(activite), ville,
      });
    } else if (activite) {
      voirClubs = tr('sansClub.clubsDeActivite', {
        activite: dansLaPhrase(activite),
      });
    }
    lignes = [
      {
        cle: 'clubs', icone: Images.search, onPress: versRecherche, texte: voirClubs,
      },
      {
        cle: 'essais',
        icone: Images.calendar,
        onPress: versEvenements,
        // Hors compétition (planche B3) : ni « détection » ni « séances d'essai » de club sportif.
        texte: (famille === 'culture' && tr('sansClub.essaisCulture'))
          || (famille === 'nature' && tr('sansClub.essaisNature'))
          || tr('sansClub.essais'),
      },
    ];
    sortie = { onPress: versRecherche, titre: tr('sansClub.sortie') };
  } else if (cas.cas === 'coach') {
    phrase = cas.equipe
      ? tr('coach.phrase', { equipe: cas.equipe })
      : tr('coach.phraseSansEquipe');
    lignes = [{
      cle: 'entrainement',
      icone: Images.calendar,
      onPress: lignesDuCoachSortent
        ? () => onAller('EventStack', { screen: 'EventWizardType' })
        : null,
      texte: tr('coach.entrainement'),
    }];
    // Décision du chef n° 4 : la ligne d'invitation attend une équipe acceptée.
    if (onInviter) {
      lignes.push({
        cle: 'inviter', icone: Images.users, onPress: onInviter, texte: tr('coach.inviter'),
      });
    }
  } else if (cas.cas === 'parent') {
    if (enfants?.length > 1) {
      phrase = tr('parent.phrasePlusieurs', { nombre: enfants.length });
    } else if (premierEnfant) {
      phrase = tr('parent.phrase', { enfant: premierEnfant });
    } else {
      phrase = tr('parent.phraseSansEnfant');
    }
    let trouver = tr('parent.trouverUnClub');
    if (premierEnfant && activite) {
      trouver = tr('parent.trouverLeClubDe', {
        activite: dansLaPhrase(activite), enfant: premierEnfant,
      });
    } else if (premierEnfant) {
      trouver = tr('parent.trouverLeClubDeEnfant', { enfant: premierEnfant });
    }
    lignes = [
      {
        cle: 'club', icone: Images.search, onPress: versRecherche, texte: trouver,
      },
      {
        cle: 'declarer',
        icone: Images.plus,
        onPress: () => onAller('ProfileStack', { screen: 'ChildEdit' }),
        texte: premierEnfant
          ? tr('parent.declarerUnAutre')
          : tr('parent.declarer'),
      },
    ];
    sortie = { onPress: versRecherche, titre: tr('parent.sortie') };
  }

  const avecCarte = ['joueurAvecClub', 'pratiquant', 'sansClub'].includes(cas.cas);
  const avecNotifications = cas.cas !== 'coach';

  const bord = withAlpha(Colors.primary500, 0.24);
  const fond = withAlpha(Colors.neutral00, 0.04);

  const renderCarte = () => {
    const age = computeAge(userData?.birthdate);
    const nom = [prenom, userData?.lastname].map((x) => String(x || '').trim()).filter(Boolean);
    const initiales = nom.map((x) => x.charAt(0).toUpperCase()).join('');
    const numero = String(userData?.jerseyNumber ?? '').trim();
    let valeurClub = tr('carte.aucun');
    if (cas.enAttente) valeurClub = tr('carte.enAttente');
    else if (nomDuClub) valeurClub = nomDuClub;
    const niveau = String(userData?.bestLevel?.name || userData?.bestLevel || '').trim() || '—';
    // B3 : la carte « sans terrain ni numéro » (planche) : NIVEAU, VILLE, CLUB.
    const cases = carteSansTerrain
      ? [[tr('carte.niveau'), niveau], [tr('carte.ville'), ville || '—'],
        [tr('carte.club'), valeurClub]]
      : [[tr('carte.age'), age === null ? '—' : tr('carte.ans', { age })],
        [tr('carte.niveau'), niveau], [tr('carte.club'), valeurClub]];
    const sousTitre = [activite, carteSansTerrain ? '' : userData?.position]
      .map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
    return (
      <View
        style={{
          backgroundColor: fond, borderColor: bord, borderRadius: 16, borderWidth: 1, padding: 16,
        }}
        testID="bienvenue-carte"
      >
        <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 12 }]}>
          <View
            style={[Alignments.alignCenter, Alignments.justifyCenter, {
              backgroundColor: Colors.primary200, borderRadius: 24, height: 48, width: 48,
            }]}
          >
            <Text style={[Fonts.p1Black, { color: Colors.primary900 }]}>{initiales}</Text>
          </View>
          <View style={[Alignments.fill]}>
            <Text numberOfLines={1} style={[Fonts.h3Bold, Fonts.neutral00]}>
              {nom.join(' ').toUpperCase()}
            </Text>
            {sousTitre ? (
              <Text
                numberOfLines={1}
                style={[Fonts.p4Bold, Fonts.primary500, { letterSpacing: 1 }]}
              >
                {sousTitre.toUpperCase()}
              </Text>
            ) : null}
          </View>
          {!carteSansTerrain && numero ? (
            <Text style={[Fonts.h1Bold, { color: withAlpha(Colors.primary500, 0.35) }]}>
              {numero}
            </Text>
          ) : null}
        </View>
        <View style={[Alignments.row, { columnGap: 8, marginTop: 14 }]}>
          {cases.map(([libelle, valeur]) => (
            <View key={libelle} style={[Alignments.fill]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 1 }]}>
                {String(libelle).toUpperCase()}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{valeur}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderLigne = (ligne) => {
    const contenu = (
      <View style={[Alignments.row, Alignments.alignCenter, { columnGap: 12, paddingVertical: 8 }]}>
        <Image
          source={ligne.icone}
          style={{ height: 20, width: 20 }}
          tintColor={Colors.primary500}
        />
        <Text style={[Fonts.p1, Fonts.neutral00, Alignments.fill]}>{ligne.texte}</Text>
      </View>
    );
    return ligne.onPress ? (
      <TouchableOpacity
        accessibilityRole="button"
        key={ligne.cle}
        onPress={ligne.onPress}
        testID={`bienvenue-ligne-${ligne.cle}`}
      >
        {contenu}
      </TouchableOpacity>
    ) : (
      <View key={ligne.cle} testID={`bienvenue-ligne-${ligne.cle}`}>{contenu}</View>
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={[Spaces.gap[16]]} style={[Alignments.fill]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
            {prenom
              ? tr('titre', { prenom })
              : tr('titreSansPrenom')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{phrase}</Text>
        </View>
        {avecCarte ? renderCarte() : null}
        <View
          style={{
            backgroundColor: fond, borderColor: bord, borderRadius: 16, borderWidth: 1, padding: 16,
          }}
        >
          <Text style={[Fonts.p1Black, Fonts.neutral00, { marginBottom: 4 }]}>
            {tr('peuxFaire')}
          </Text>
          {lignes.map(renderLigne)}
        </View>
        {cas.cas === 'coach' ? (
          <View
            style={{
              borderColor: bord,
              borderRadius: 16,
              borderStyle: 'dashed',
              borderWidth: 1,
              padding: 16,
            }}
            testID="bienvenue-offre"
          >
            {offreCadeau ? (
              <Text style={[Fonts.p2, Fonts.neutral100]}>{offreCadeau}</Text>
            ) : (
              <>
                <View
                  style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}
                >
                  <Text style={[Fonts.p1Black, Fonts.neutral00]}>
                    {tr('coach.offreGratuite')}
                  </Text>
                  <View
                    style={{
                      backgroundColor: withAlpha(Colors.primary500, 0.16),
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                      {tr('coach.uneEquipe')}
                    </Text>
                  </View>
                </View>
                <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 6 }]}>
                  {tr('coach.offresApres')}
                </Text>
              </>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onVoirOffres}
              style={{ marginTop: 12 }}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                {tr('coach.voirOffres')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
      <View style={[Spaces.gap[12], { paddingTop: 12 }]}>
        {avecNotifications ? (
          <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>
            {tr('notifications')}
          </Text>
        ) : null}
        <Button onPress={sortie.onPress} title={sortie.titre} variant="Primary" />
      </View>
    </>
  );
}

export default BienvenueParCas;
