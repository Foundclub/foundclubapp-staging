import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { lirePrix, messageDeRefus, prixEnSaisie } from '@/domains/complexe/complexeGerant';
import {
  catalogueAvec,
  catalogueSans,
  erreursDOption,
  NOM_OPTION_MAX,
  texteDUneOption,
} from '@/domains/complexe/optionsTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { useModifierComplexe } from '@/services/complexe/complexeQueries';

/**
 * LE BLOC « OPTIONS » D'UN TERRAIN — RESA-OPTIONS (12/11/2026), demande d'Adel D61
 * (« 233- oui »), maquette RESA-JOUEUR section 4 bis : sous le prix, dans la création et la
 * modification d'un terrain. Les options appartiennent au COMPLEXE : ce terrain active celles
 * qu'il propose, d'un interrupteur (enregistré avec le terrain). « + Créer une option » ouvre la
 * feuille « Nouvelle option » (un nom, un prix, une unité, obligatoire ou non) ; elle est
 * enregistrée tout de suite pour le complexe et activée ici. Toucher une option rouvre la même
 * feuille, préremplie : la modifier la change sur tous les terrains, « Retirer l'option » la sort
 * de tous (les réservations la gardent).
 * @param {object} props - Les propriétés.
 * @param {string[]} props.actives - Les options activées sur ce terrain.
 * @param {Array<any>} props.catalogue - Le catalogue du complexe (`useComplexeGere`).
 * @param {string | null} props.complexeId - Le complexe.
 * @param {string} [props.nomDuComplexe] - « Le Five de Montrivage ».
 * @param {(ids: string[]) => void} props.onActives - Les options activées, changées.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocOptionsTerrain({
  actives, catalogue, complexeId, nomDuComplexe = '', onActives,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const modifier = useModifierComplexe();
  // Le catalogue rendu par le serveur après un geste, sans attendre la relecture du complexe.
  const [relu, setRelu] = useState(/** @type {any[] | null} */ (null));
  const [feuille, setFeuille] = useState(/** @type {{ id?: string } | null} */ (null));
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [unite, setUnite] = useState('reservation');
  const [obligatoire, setObligatoire] = useState(false);
  const [tente, setTente] = useState(false);
  const [refus, setRefus] = useState('');

  const liste = relu || (Array.isArray(catalogue) ? catalogue : []);
  const ids = new Set(liste.map((option) => option.id));
  const allumees = (Array.isArray(actives) ? actives : []).filter((id) => ids.has(id));
  const erreurs = erreursDOption({ nom, prix });

  useEffect(() => {
    if (!feuille) return;
    const option = feuille.id ? liste.find((candidate) => candidate.id === feuille.id) : null;
    setNom(option ? String(option.name) : '');
    setPrix(option ? prixEnSaisie(option.price) : '');
    setUnite(option?.unit === 'unite' ? 'unite' : 'reservation');
    setObligatoire(option?.required === true);
    setTente(false);
    setRefus('');
    // La feuille se remplit à son ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feuille]);

  const basculer = (/** @type {string} */ id, /** @type {boolean} */ allume) => {
    const sans = allumees.filter((autre) => autre !== id);
    onActives(allume ? [...sans, id] : sans);
  };

  const envoyer = async (
    /** @type {any[]} */ nouveau,
    /** @type {(apres: any[]) => void} */ ensuite,
  ) => {
    setRefus('');
    try {
      const reponse = await modifier.mutateAsync({ complexeId, donnees: { options: nouveau } });
      const apres = Array.isArray(reponse?.data?.options) ? reponse.data.options : nouveau;
      setRelu(apres);
      ensuite(apres);
      setFeuille(null);
    } catch (erreur) {
      const repli = t('complexeOptions.echec', 'L’option n’est pas enregistrée. Réessaie.');
      setRefus(messageDeRefus(t, erreur, repli));
    }
  };

  const enregistrerLOption = () => {
    setTente(true);
    if (Object.keys(erreurs).length || !feuille) return;
    const option = {
      ...(feuille.id ? { id: feuille.id } : {}),
      name: nom.replace(/\s+/g, ' ').trim(),
      price: Number(lirePrix(prix)),
      required: obligatoire,
      unit: unite,
    };
    envoyer(catalogueAvec(liste, option), (apres) => {
      // Neuve : activée sur ce terrain (maquette : « enregistrée pour tout le complexe et
      // activée sur ce terrain »).
      if (feuille.id) return;
      const neuve = apres.find((candidate) => !ids.has(candidate.id));
      if (neuve) onActives([...allumees, neuve.id]);
    });
  };

  const retirerLOption = () => {
    if (!feuille?.id) return;
    const { id } = feuille;
    envoyer(catalogueSans(liste, id), () => onActives(allumees.filter((autre) => autre !== id)));
  };

  const uniteBouton = (/** @type {string} */ valeur, /** @type {string} */ libelle) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: unite === valeur }}
      onPress={() => setUnite(valeur)}
      style={[
        Alignments.fill,
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: unite === valeur ? Colors.primary500 : 'transparent',
          borderRadius: 12,
          minHeight: 44,
        },
      ]}
      testID={`option-unite-${valeur}`}
    >
      <Text style={[Fonts.p2Bold, unite === valeur ? Fonts.neutral900 : Fonts.primary500]}>
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary700, 0.45),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
      testID="complexe-terrain-options"
    >
      <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
          {t('complexeOptions.titre', 'Options').toUpperCase()}
        </Text>
        {liste.length ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {allumees.length > 1
              ? t('complexeOptions.actives', '{{nombre}} actives sur {{total}}', {
                nombre: allumees.length, total: liste.length, ...SANS_ECHAPPEMENT,
              })
              : t('complexeOptions.active', '{{nombre}} active sur {{total}}', {
                nombre: allumees.length, total: liste.length, ...SANS_ECHAPPEMENT,
              })}
          </Text>
        ) : null}
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {liste.length
          ? t(
            'complexeOptions.dit',
            'Les options de ton complexe. Active celles que ce terrain propose.',
          )
          : t(
            'complexeOptions.ditVide',
            'Chasubles, ballon, arbitre… : crée une option, elle servira aussi à tes autres '
              + 'terrains.',
          )}
      </Text>
      {liste.map((option) => {
        const allume = allumees.includes(option.id);
        return (
          <View
            key={option.id}
            style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 52 }]}
            testID={`option-${option.id}`}
          >
            <TouchableOpacity
              accessibilityHint={t(
                'complexeOptions.modifierAide',
                'Modifier ou retirer cette option',
              )}
              accessibilityRole="button"
              onPress={() => setFeuille({ id: option.id })}
              style={[Alignments.fill, { gap: 2 }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{option.name}</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{texteDUneOption(t, option)}</Text>
            </TouchableOpacity>
            <Switch
              accessibilityLabel={t(
                'complexeOptions.activer',
                'Proposer « {{nom}} » sur ce terrain',
                { nom: option.name, ...SANS_ECHAPPEMENT },
              )}
              onValueChange={(valeur) => basculer(option.id, valeur)}
              testID={`option-interrupteur-${option.id}`}
              thumbColor={Colors.neutral00}
              trackColor={{ false: withAlpha(Colors.neutral00, 0.2), true: Colors.primary500 }}
              value={allume}
            />
          </View>
        );
      })}
      <Button
        onPress={() => setFeuille({})}
        title={t('complexeOptions.creer', '+ Créer une option')}
        variant="Secondary"
      />
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'complexeOptions.pied',
          'Les joueurs les choisissent au récapitulatif. Elles s’ajoutent au prix, à régler sur '
            + 'place. Changer le nom ou le prix d’une option la change sur tous les terrains ; les '
            + 'réservations déjà faites gardent leur prix.',
        )}
      </Text>

      <BottomModal
        close={() => setFeuille(null)}
        isVisible={Boolean(feuille)}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }} testID="feuille-option">
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {feuille?.id
              ? t('complexeOptions.feuilleModifier', 'Modifier l’option')
              : t('complexeOptions.feuilleNouvelle', 'Nouvelle option')}
          </Text>
          <Input
            label={t('complexeOptions.nom', 'Nom')}
            maxLength={NOM_OPTION_MAX}
            onChangeText={setNom}
            placeholder={t('complexeOptions.nomExemple', 'Location de chasubles')}
            value={nom}
          />
          {tente && erreurs.nom ? (
            <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>
              {t('complexeOptions.nomFaux', 'Donne un nom à l’option (2 caractères au moins).')}
            </Text>
          ) : null}
          <Input
            keyboardType="decimal-pad"
            label={t('complexeOptions.prix', 'Prix (€)')}
            onChangeText={setPrix}
            placeholder="5"
            value={prix}
          />
          {tente && erreurs.prix ? (
            <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>
              {t('complexeOptions.prixFaux', 'Le prix : de 0 à 999 €, deux décimales au plus.')}
            </Text>
          ) : null}
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('complexeOptions.lePrixCompte', 'Le prix compte')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            style={[
              Alignments.row,
              {
                borderColor: withAlpha(Colors.primary500, 0.4),
                borderRadius: 14,
                borderWidth: 1,
                padding: 2,
              },
            ]}
          >
            {uniteBouton('unite', t('complexeOptions.uniteParUnite', 'Par unité'))}
            {uniteBouton(
              'reservation',
              t('complexeOptions.uniteParReservation', 'Par réservation'),
            )}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeOptions.uniteAide',
              'Par unité : le joueur choisit combien il en veut (ballons, boissons). Par '
                + 'réservation : une seule fois (chasubles, éclairage).',
            )}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}>
            <View style={[Alignments.fill, { gap: 2 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('complexeOptions.obligatoireTitre', 'Obligatoire')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'complexeOptions.obligatoireDit',
                  'Comptée dans chaque réservation (arbitre, éclairage).',
                )}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('complexeOptions.obligatoireTitre', 'Obligatoire')}
              onValueChange={setObligatoire}
              testID="option-obligatoire"
              thumbColor={Colors.neutral00}
              trackColor={{ false: withAlpha(Colors.neutral00, 0.2), true: Colors.primary500 }}
              value={obligatoire}
            />
          </View>
          {!feuille?.id ? (
            <Text style={[Fonts.p3, Fonts.primary200]}>
              {nomDuComplexe
                ? t(
                  'complexeOptions.pourToutLeComplexe',
                  'Enregistrée pour tout {{complexe}} : tu pourras l’activer sur tes autres '
                    + 'terrains d’un geste.',
                  { complexe: nomDuComplexe, ...SANS_ECHAPPEMENT },
                )
                : t(
                  'complexeOptions.pourToutLeComplexeSansNom',
                  'Enregistrée pour tout ton complexe : tu pourras l’activer sur tes autres '
                    + 'terrains d’un geste.',
                )}
            </Text>
          ) : null}
          {refus ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
          ) : null}
          <Button
            disabled={Boolean(modifier.isPending)}
            isLoading={Boolean(modifier.isPending)}
            onPress={enregistrerLOption}
            title={feuille?.id
              ? t('complexeOptions.enregistrerLOption', 'Enregistrer l’option')
              : t('complexeOptions.creerLOption', 'Créer l’option')}
            variant="Primary"
          />
          {feuille?.id ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={Boolean(modifier.isPending)}
              onPress={retirerLOption}
              style={[Alignments.justifyCenter, { gap: 2, minHeight: 44 }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.error300]}>
                {t('complexeOptions.retirer', 'Retirer l’option')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'complexeOptions.retirerDit',
                  'Elle sort de tous tes terrains. Les réservations déjà faites la gardent.',
                )}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Button
            onPress={() => setFeuille(null)}
            title={t('complexeGerant.creation.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
    </View>
  );
}

export default BlocOptionsTerrain;
