// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  useCreateDeclaredChild,
  useGetMyDeclaredChildren,
  useUpdateDeclaredChild,
} from '@/services/declaredChild/declaredChildQueries';
import { buildChildPayload } from '@/services/declaredChild/declaredChildRules';

import { isBirthdateUnderParentAccountAge } from '@/constants/parentalDeclaration';

/**
 * PARENT P2 — ÉCRAN 8 : « AJOUTER OU MODIFIER UN ENFANT ».
 *
 * 🔒 TROIS CHAMPS OBLIGATOIRES, ET PAS UN DE PLUS QUE C10 DU PLAN : prénom, nom,
 * date de naissance. Chaque champ est une donnée personnelle de MINEUR, et la
 * minimisation n'est pas un confort, c'est la loi. ⛔ Ni téléphone, ni e-mail,
 * ni adresse (on contacte SON PARENT) ; ni taille ni poids (ce sont ces deux-là
 * qui obligent déjà les magasins à une déclaration « données de santé ») ; ni
 * nationalité. La liste blanche du serveur les jetterait de toute façon — cet
 * écran ne les DEMANDE même pas.
 *
 * 🔒 EN MODIFICATION, LA DATE DE NAISSANCE N'EST PAS PRÉ-REMPLIE, et ce n'est
 * pas un oubli : le serveur ne la rend JAMAIS (il rend un `age` calculé, comme
 * le profil public d'un compte). L'écran le DIT — « laisse vide pour ne pas la
 * changer » — au lieu d'afficher trois cases muettes. Une clef absente reste
 * absente, et le serveur garde alors la date qu'il a en base.
 *
 * 🧒 LE PALIER 13 EST DIT ICI, AVANT D'ENVOYER. `isBirthdateUnderParentAccountAge`
 * existait dans l'app depuis des mois sans être appelé nulle part (§4.5 du plan
 * PARENT) : le palier ne tenait que sur le refus serveur, qui marche, mais qui
 * ne prévient qu'après un aller-retour. Il est branché.
 * @returns {import('react').ReactElement} L'écran.
 */
function ChildEdit() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();

  const documentIdVise = String(route?.params?.childDocumentId || '').trim();
  const estUneModification = Boolean(documentIdVise);

  const { data: enfantsBruts } = useGetMyDeclaredChildren();
  const enfantExistant = useMemo(() => (
    (Array.isArray(enfantsBruts) ? enfantsBruts : [])
      .find((enfant) => enfant?.documentId === documentIdVise) || null
  ), [enfantsBruts, documentIdVise]);

  const { isPending: creationEnCours, mutate: creerEnfant } = useCreateDeclaredChild();
  const { isPending: modificationEnCours, mutate: modifierEnfant } = useUpdateDeclaredChild();

  const [firstname, setFirstname] = useState(enfantExistant?.firstname || '');
  const [lastname, setLastname] = useState(enfantExistant?.lastname || '');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [number, setNumber] = useState(
    enfantExistant?.number === null || enfantExistant?.number === undefined
      ? ''
      : String(enfantExistant.number),
  );
  const [position, setPosition] = useState(enfantExistant?.position || '');
  const [erreur, setErreur] = useState('');

  /**
   * Assemble la date saisie, ou rien du tout.
   *
   * ⚠️ Les trois cases vont ENSEMBLE : une date à moitié saisie n'est pas une
   * date, et surtout elle ne doit pas partir au serveur comme si elle en était
   * une. On ne rend une date que si les trois cases sont remplies.
   * @returns {string} La date au format ISO court, ou une chaîne vide.
   */
  const dateSaisie = useCallback(() => {
    const jour = day.trim();
    const mois = month.trim();
    const annee = year.trim();
    if (!jour || !mois || !annee) return '';
    return `${annee.padStart(4, '0')}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;
  }, [day, month, year]);

  const enregistrer = useCallback(() => {
    setErreur('');
    const naissance = dateSaisie();

    // ① Les trois obligatoires. En modification, la date PEUT rester vide : le
    //    serveur garde la sienne (il ne nous l'a jamais rendue).
    if (!firstname.trim() || !lastname.trim() || (!estUneModification && !naissance)) {
      setErreur(t('myChildren.form.errors.required', 'Le prénom, le nom et la date de naissance sont obligatoires.'));
      return;
    }

    // ② La date existe-t-elle vraiment ? Un 31 février n'est pas une date, et
    //    `new Date('2017-02-31')` ne le dit pas franchement selon les moteurs.
    if (naissance) {
      const [a, m, j] = naissance.split('-').map(Number);
      const date = new Date(Date.UTC(a, m - 1, j));
      const existe = date.getUTCFullYear() === a
        && date.getUTCMonth() === m - 1
        && date.getUTCDate() === j;
      if (!existe) {
        setErreur(t('myChildren.form.errors.invalidDate', 'Cette date n’existe pas.'));
        return;
      }

      // ③ 🧒 LE PALIER 13, DIT AVANT L'ALLER-RETOUR.
      if (!isBirthdateUnderParentAccountAge(naissance)) {
        setErreur(t('myChildren.form.errors.tooOld', 'Une fiche enfant est réservée aux moins de 13 ans.'));
        return;
      }
    }

    const payload = buildChildPayload({
      birthdate: naissance,
      firstname,
      lastname,
      number,
      position,
    });

    const surErreur = () => setErreur(t('myChildren.form.errors.save', 'Impossible d’enregistrer cette fiche pour le moment.'));
    const surSucces = () => navigation.goBack();

    if (estUneModification) {
      modifierEnfant(
        { documentId: documentIdVise, payload },
        { onError: surErreur, onSuccess: surSucces },
      );
      return;
    }
    creerEnfant(payload, { onError: surErreur, onSuccess: surSucces });
  }, [
    creerEnfant, dateSaisie, documentIdVise, estUneModification, firstname, lastname,
    modifierEnfant, navigation, number, position, t,
  ]);

  const caseDate = (valeur, poser, repere, indication, longueur) => (
    <Input
      inputMode="numeric"
      keyboardType="number-pad"
      maxLength={longueur}
      onChangeText={poser}
      placeholder={indication}
      testID={repere}
      value={valeur}
      wrapperStyle={{ width: longueur === 4 ? 84 : 60 }}
    />
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Spaces.paddingBottom[24]]}
      // 🎨 LES DEUX PROPS VONT ENSEMBLE. `ScreenContainer` place son défilement
      // À L'INTÉRIEUR de l'évitement de clavier : `keyboardScroll` seul ne monte
      // rien. Cet écran porte 5 champs plus un bouton — clavier ouvert, la zone
      // restante ne les contient plus, et le bouton devient intouchable.
      // ⚠️ Aucune porte ne mesure ça : le témoin ⑦ lit ces deux props.
      keyboardAvoiding
      keyboardScroll
    >
      <View style={[Spaces.gap[24], Spaces.paddingTop[20]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {estUneModification
              ? t('myChildren.form.editTitle', 'Modifier la fiche')
              : t('myChildren.form.addTitle', 'Ajouter un enfant')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('myChildren.form.hint', 'Trois informations suffisent.')}
          </Text>
        </View>

        <Input
          label={t('myChildren.form.firstnameLabel', 'Prénom')}
          onChangeText={setFirstname}
          placeholder={t('myChildren.form.firstnamePlaceholder', '')}
          testID="child-firstname"
          value={firstname}
        />
        <Input
          label={t('myChildren.form.lastnameLabel', 'Nom')}
          onChangeText={setLastname}
          placeholder={t('myChildren.form.lastnamePlaceholder', '')}
          testID="child-lastname"
          value={lastname}
        />

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {t('myChildren.form.birthdateLabel', 'Date de naissance')}
          </Text>
          <View style={[Alignments.row, Alignments.alignEnd, Spaces.gap[16]]}>
            {caseDate(day, setDay, 'child-day', 'JJ', 2)}
            <Text style={[Fonts.h1Bold, Fonts.neutral00]}>/</Text>
            {caseDate(month, setMonth, 'child-month', 'MM', 2)}
            <Text style={[Fonts.h1Bold, Fonts.neutral00]}>/</Text>
            {caseDate(year, setYear, 'child-year', 'AAAA', 4)}
          </View>
          {/* 🔒 On explique le vide au lieu de le laisser inquiéter. */}
          {estUneModification ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('myChildren.form.birthdateKeepHint', 'Laisse vide pour ne pas la changer.')}
            </Text>
          ) : null}
        </View>

        <Input
          inputMode="numeric"
          keyboardType="number-pad"
          label={t('myChildren.form.numberLabel', 'Numéro de maillot (facultatif)')}
          maxLength={2}
          onChangeText={setNumber}
          testID="child-number"
          value={number}
        />
        <Input
          label={t('myChildren.form.positionLabel', 'Poste (facultatif)')}
          onChangeText={setPosition}
          placeholder={t('myChildren.form.positionPlaceholder', '')}
          testID="child-position"
          value={position}
        />

        {erreur ? (
          <Text style={[Fonts.p3, { color: '#ff284f' }]}>{erreur}</Text>
        ) : null}

        <Button
          disabled={creationEnCours || modificationEnCours}
          onPress={enregistrer}
          testID="child-edit-submit"
          title={estUneModification
            ? t('myChildren.form.submitEdit', 'Enregistrer')
            : t('myChildren.form.submitAdd', 'Déclarer mon enfant')}
        />
      </View>
    </ScreenContainer>
  );
}

export default ChildEdit;
