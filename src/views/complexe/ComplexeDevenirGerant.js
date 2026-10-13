import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  CHOIX_AGE_MINIMUM,
  CHOIX_ANNULATION,
  distanceLisible,
  ficheComplete,
  messageDeRefus,
  payloadDeCreation,
  REGLES_PAR_DEFAUT,
  telephoneAPreRemplir,
} from '@/domains/complexe/complexeGerant';
import { libelleSport, sportsPopulaires } from '@/domains/complexe/complexeTerrain';
import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput
  from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ChoixDuSport, { basculerSport } from '@/components/organisms/choixDuSport/ChoixDuSport';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import BadgeComplexe from '@/views/complexe/components/BadgeComplexe';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useCreerMonComplexe } from '@/services/complexe/complexeQueries';

import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';

const ETAPES = 3;
const SIRET_RE = /^\d{14}$/;

/**
 * E-G01 — « JE GÈRE UN COMPLEXE » : DEVENIR GÉRANT — RESA-L5A1 (13/10/2026), planche EG01.
 *
 * AT-01 (« bascule ok ») : un SEUL compte ; l'écran crée le complexe et en rend l'appelant
 * gestionnaire, puis propose les deux modes. AT-02 B : aucune limite d'âge pour gérer (l'étape
 * « Toi » et l'écran « Moins de 18 ans » sont retirés de la planche). D6 : visible tout de suite.
 *   1. « Ton complexe » : nom, adresse (avec sa position), téléphone montré aux joueurs — JAMAIS
 *      pré-rempli avec le numéro d'un compte mineur (règle du contrat L1) —, sports, SIRET.
 *   2. « Tes règles » : âge minimum pour réserver (13 à 18, défaut 18), délai d'annulation
 *      (défaut 24 h) ; les autres règles prennent les défauts du serveur.
 *   3. « Récapitulatif » : la carte du complexe, le texte D6, la case obligatoire, « Créer ».
 * Le serveur juge (liste blanche, un complexe par compte) ; un doublon possible (200
 * `{duplicate, suggestions}`) pose « C'est le tien ? » et « Non, continuer » renvoie avec
 * `forceCreate`. Caché par `COMPLEXES_GERANT` (la route n'existe pas tant qu'il est éteint).
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeDevenirGerant() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = useAuth();
  const activites = useGetActivities();
  const creer = useCreerMonComplexe();

  const [etape, setEtape] = useState(1);
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState(/** @type {any} */ (null));
  const [telephone, setTelephone] = useState(() => telephoneAPreRemplir(userData));
  const [telephoneTouche, setTelephoneTouche] = useState(false);
  const [sports, setSports] = useState(/** @type {string[]} */ ([]));
  const [siret, setSiret] = useState('');
  const [ageMinimum, setAgeMinimum] = useState(
    /** @type {number} */ (REGLES_PAR_DEFAUT.ageMinimum),
  );
  const [annulation, setAnnulation] = useState(
    /** @type {number} */ (REGLES_PAR_DEFAUT.annulation),
  );
  const [accepte, setAccepte] = useState(false);
  const [refus, setRefus] = useState('');
  const [doublon, setDoublon] = useState(/** @type {any} */ (null));
  const [cree, setCree] = useState(/** @type {any} */ (null));
  const [feuilleSports, setFeuilleSports] = useState(false);

  // Le compte se lit parfois après le premier rendu : le numéro se propose alors, sauf si le
  // gérant a déjà touché au champ (on n'écrase jamais une saisie).
  const proposition = telephoneAPreRemplir(userData);
  useEffect(() => {
    if (!telephoneTouche && !telephone && proposition) setTelephone(proposition);
  }, [proposition, telephone, telephoneTouche]);

  const liste = Array.isArray(activites.data) ? activites.data : [];
  const populaires = sportsPopulaires(liste);
  const autres = sports
    .filter((id) => !populaires.some((sport) => sport.documentId === id))
    .map((id) => liste.find((activite) => String(activite?.documentId) === id))
    .filter(Boolean)
    .map((activite) => ({
      label: libelleSport(activite),
      value: String(activite?.documentId),
    }));
  const optionsSports = [
    ...populaires.map((sport) => ({ label: sport.label, value: sport.documentId })),
    ...autres,
  ];
  const nomsDesSports = sports
    .map((id) => liste.find((activite) => String(activite?.documentId) === id))
    .filter(Boolean)
    .map((activite) => libelleSport(activite));

  const fiche = {
    accepte, adresse, ageMinimum, annulation, nom, siret, sports, telephone,
  };
  const siretChiffres = siret.replace(/\s+/g, '');
  const siretFaux = Boolean(siretChiffres) && !SIRET_RE.test(siretChiffres);

  const envoyer = async (forcer = false) => {
    setRefus('');
    try {
      const corps = await creer.mutateAsync(payloadDeCreation(fiche, { forcer }));
      if (corps?.data?.duplicate) {
        setDoublon(corps.data.suggestions?.[0] || {});
        return;
      }
      setDoublon(null);
      setCree(corps?.data || { name: nom });
    } catch (erreur) {
      setDoublon(null);
      setRefus(messageDeRefus(
        t,
        erreur,
        t('complexeGerant.creation.echec', 'La création n’a pas abouti. Réessaie.'),
      ));
    }
  };

  const suivant = () => {
    if (etape < ETAPES) setEtape(etape + 1);
    else envoyer(false);
  };
  const retour = () => {
    if (etape > 1) setEtape(etape - 1);
    else navigation.goBack();
  };

  const ouvrirLEspace = () => {
    ecrireModeComplexe(userData?.documentId, true);
    navigation.reset({
      index: 0,
      routes: [{
        name: RouteNames.ComplexeEspace,
        params: { complexeId: cree?.documentId, justeCree: true },
      }],
    });
  };
  const resterJoueur = () => {
    setCree(null);
    navigation.goBack();
  };
  const ecrireAFoundClub = () => {
    setDoublon(null);
    Promise.resolve(Linking.openURL(SUPPORT_CONTACT_MAILTO)).catch(() => {});
  };

  const aide = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3, Fonts.neutral200]}>{texte}</Text>
  );

  const etapeComplexe = (
    <View style={{ gap: 20 }}>
      <Input
        label={t('complexeGerant.creation.nom', 'Nom')}
        onChangeText={setNom}
        placeholder={t('complexeGerant.creation.nomExemple', 'Ex. : Le Five de Montrivage')}
        value={nom}
      />
      <AutocompleteAddressInput
        address={adresse || undefined}
        label={t('complexeGerant.creation.adresse', 'Adresse')}
        permettreLieuSurCarte
        placeholder={t('complexeGerant.creation.adresseExemple', 'Rue, ville…')}
        setAddress={(option) => setAdresse(option || null)}
      />
      <PhoneInput
        label={t('complexeGerant.creation.telephone', 'Téléphone montré aux joueurs')}
        onBlur={() => {}}
        onChange={(/** @type {string} */ valeur) => {
          setTelephoneTouche(true);
          setTelephone(String(valeur || ''));
        }}
        value={telephone}
      />
      <View style={{ gap: 8 }}>
        <ChoiceChipGroup
          onSelect={(valeur) => setSports(basculerSport(sports, String(valeur)))}
          options={optionsSports}
          selectedValues={sports}
          title={t('complexeGerant.creation.sports', 'Sports')}
        />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => setFeuilleSports(true)}
            size="sm"
            title={t('complexeGerant.creation.plusDeSports', '+ de sports')}
            variant="Ghost"
          />
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Input
          keyboardType="number-pad"
          label={t('complexeGerant.creation.siret', 'SIRET (facultatif)')}
          onChangeText={setSiret}
          placeholder={t('complexeGerant.creation.siretExemple', '14 chiffres')}
          value={siret}
        />
        {siretFaux ? (
          <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>
            {t('complexeGerant.creation.siretFaux', 'Le SIRET compte 14 chiffres.')}
          </Text>
        ) : aide(t('complexeGerant.creation.siretAide', 'Il servira à la pastille Vérifié.'))}
      </View>
    </View>
  );

  const libelleAnnulation = annulation === 0
    ? t('complexeGerant.creation.annulationZero', 'Annulation gratuite jusqu’au début du créneau.')
    : t(
      'complexeGerant.creation.annulationAide',
      'Annulation gratuite jusqu’à {{heures}} h avant le créneau.',
      { heures: annulation, ...SANS_ECHAPPEMENT },
    );

  const etapeRegles = (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 4 }}>
        <ChoiceChipGroup
          onSelect={(valeur) => setAgeMinimum(Number(valeur))}
          options={CHOIX_AGE_MINIMUM.map((age) => ({
            label: t('complexeGerant.creation.ans', '{{age}} ans', { age, ...SANS_ECHAPPEMENT }),
            value: age,
          }))}
          selectedValue={ageMinimum}
          title={t('complexeGerant.creation.ageMinimum', 'Âge minimum pour réserver')}
        />
        {aide(t('complexeGerant.creation.ageAide', 'De 13 à 18 ans. Proposé : 18 ans.'))}
      </View>
      <View style={{ gap: 4 }}>
        <ChoiceChipGroup
          onSelect={(valeur) => setAnnulation(Number(valeur))}
          options={CHOIX_ANNULATION.map((heures) => ({
            label: t('complexeGerant.creation.heures', '{{heures}} h', {
              heures,
              ...SANS_ECHAPPEMENT,
            }),
            value: heures,
          }))}
          selectedValue={annulation}
          title={t('complexeGerant.creation.annulation', 'Délai d’annulation')}
        />
        {aide(libelleAnnulation)}
      </View>
      <BandeauComplexe
        texte={t('complexeGerant.creation.toutChanger', 'Tu pourras tout changer dans Réglages.')}
        ton="info"
      />
    </View>
  );

  const ligneRegle = (/** @type {any} */ icone, /** @type {string} */ texte) => (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
      <Image
        source={icone}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
      />
      <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{texte}</Text>
    </View>
  );

  const texteAccepter = t(
    'complexeGerant.creation.accepter',
    'J’accepte les règles d’utilisation des complexes',
  );
  const etapeRecapitulatif = (
    <View style={{ gap: 16 }}>
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 24,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 12,
          padding: 16,
        }}
        testID="complexe-creation-carte"
      >
        <LogoComplexe nom={nom} taille={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{nom.replace(/\s+/g, ' ').trim()}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {[adresse?.city, nomsDesSports.join(', ')].filter(Boolean).join(' · ')}
          </Text>
          <BadgeComplexe />
        </View>
      </View>
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 24,
          borderWidth: 1,
          gap: 8,
          padding: 16,
        }}
      >
        {ligneRegle(
          Images.users,
          t('complexeGerant.creation.recapAge', 'Réservation à partir de {{age}} ans', {
            age: ageMinimum,
            ...SANS_ECHAPPEMENT,
          }),
        )}
        {ligneRegle(
          Images.clock,
          annulation === 0
            ? t(
              'complexeGerant.creation.recapAnnulationZero',
              'Annulation gratuite jusqu’au début du créneau',
            )
            : t(
              'complexeGerant.creation.recapAnnulation',
              'Annulation gratuite jusqu’à {{heures}} h avant',
              { heures: annulation, ...SANS_ECHAPPEMENT },
            ),
        )}
      </View>
      <BandeauComplexe
        texte={t(
          'complexeGerant.creation.visible',
          // eslint-disable-next-line max-len
          'Ton complexe est visible dès maintenant. FoundClub peut le suspendre s’il ne respecte pas les règles d’utilisation.',
        )}
        ton="info"
      />
      <TouchableOpacity
        accessibilityLabel={texteAccepter}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepte }}
        onPress={() => setAccepte(!accepte)}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
        testID="complexe-creation-accepter"
      >
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: accepte ? Colors.primary500 : 'transparent',
              borderColor: Colors.primary500,
              borderRadius: 6,
              borderWidth: 2,
              height: 24,
              width: 24,
            },
          ]}
        >
          {accepte ? (
            <Image
              source={Images.check}
              style={[{ height: 14, width: 14 }, ApplicationStyle.tintColor.primary900]}
            />
          ) : null}
        </View>
        <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
          {texteAccepter}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const titres = [
    t('complexeGerant.creation.titreComplexe', 'Ton complexe'),
    t('complexeGerant.creation.titreRegles', 'Tes règles'),
    t('complexeGerant.creation.titreRecapitulatif', 'Récapitulatif'),
  ];
  let suivantEteint = false;
  if (etape === 1) suivantEteint = !ficheComplete(fiche);
  else if (etape === 3) suivantEteint = !accepte || Boolean(creer.isPending);

  return (
    <>
      <WizardStepLayout
        headerVariant="focus"
        isNextDisabled={suivantEteint}
        isNextLoading={Boolean(creer.isPending)}
        nextLabel={etape === ETAPES
          ? t('complexeGerant.creation.creer', 'Créer mon complexe')
          : t('complexeGerant.creation.continuer', 'Continuer')}
        onBack={retour}
        onNext={suivant}
        stepCount={ETAPES}
        stepIndex={etape}
        title={titres[etape - 1]}
      >
        <View style={{ gap: 16, paddingBottom: 24 }}>
          {etape === 1 ? etapeComplexe : null}
          {etape === 2 ? etapeRegles : null}
          {etape === 3 ? etapeRecapitulatif : null}
          {refus ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
          ) : null}
        </View>
      </WizardStepLayout>

      <BottomModal
        close={() => setFeuilleSports(false)}
        isVisible={feuilleSports}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('complexeGerant.creation.choisirSports', 'Choisir les sports')}
          </Text>
          <ChoixDuSport
            multiple
            onChoisir={(cle) => setSports(basculerSport(sports, cle))}
            sansTousLesSports
            sports={liste}
            valeurs={sports}
          />
          <Button
            onPress={() => setFeuilleSports(false)}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>

      <BottomModal
        close={() => setDoublon(null)}
        isVisible={Boolean(doublon)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t(
              'complexeGerant.creation.doublon',
              'Un complexe « {{nom}} » existe déjà à {{distance}}. C’est le tien ?',
              {
                distance: distanceLisible(doublon?.distanceMeters),
                nom: String(doublon?.name || ''),
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
          <Button
            onPress={ecrireAFoundClub}
            title={t('complexeGerant.creation.cestLeMien', 'Oui, c’est le mien')}
            variant="Secondary"
          />
          <Button
            isLoading={Boolean(creer.isPending)}
            onPress={() => envoyer(true)}
            title={t('complexeGerant.creation.nonContinuer', 'Non, continuer')}
            variant="Primary"
          />
        </View>
      </BottomModal>

      <BottomModal close={resterJoueur} isVisible={Boolean(cree)} webPresentation="dialog">
        <View style={{ gap: 12 }} testID="complexe-creation-deux-modes">
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('complexeGerant.creation.cree', '{{nom}} est créé', {
              nom: String(cree?.name || nom),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('complexeGerant.creation.deuxModes', 'Ton compte a maintenant deux modes.')}
          </Text>
          {[
            t(
              'complexeGerant.creation.garde',
              'Tu gardes tes équipes, tes réservations et tes messages de joueur.',
            ),
            t(
              'complexeGerant.creation.bouton',
              // eslint-disable-next-line max-len
              'Le bouton en haut de l’accueil te fait passer du mode complexe au mode joueur, et retour.',
            ),
            t(
              'complexeGerant.creation.notifications',
              'Tes notifications arrivent dans les deux modes.',
            ),
          ].map((texte) => (
            <View key={texte} style={[Alignments.row, { alignItems: 'flex-start', gap: 12 }]}>
              <Image
                source={Images.check}
                style={[ApplicationStyle.icon16, { tintColor: Colors.success500 }]}
              />
              <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{texte}</Text>
            </View>
          ))}
          <Button
            onPress={ouvrirLEspace}
            title={t('complexeGerant.creation.ouvrirEspace', 'Ouvrir l’espace du complexe')}
            variant="Primary"
          />
          <Button
            onPress={resterJoueur}
            title={t('complexeGerant.creation.resterJoueur', 'Rester en mode joueur')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </>
  );
}

export default ComplexeDevenirGerant;
