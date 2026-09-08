import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingExport } from '@/hooks/useTraining';

// 🪤 L ALIAS PLUTOT QUE LE CHEMIN RELATIF, et ce n est pas un gout : les deux
// regles de tri du depot se CONTREDISENT sur un import relatif — l une le veut
// avant `@/hooks`, l autre apres. Aucune des deux ne peut etre satisfaite. Vu
// par l alias, le fichier rentre dans un groupe que les deux rangent pareil.
import { rangerLeCarnet } from '@/views/training/logbookLisible';

/**
 * LE CARNET — toutes les mesures, sous DEUX formes qui ne servent pas à la même chose.
 *
 * 🔎 POURQUOI DEUX VUES ET PAS UNE. Le carnet BRUT est un format d'échange :
 * `date;jour;test;mesure;unite;cote;essai;valeur;valide;…`. C'est lui qui permet de
 * coller le carnet dans une conversation pour faire analyser un profil, puis de le
 * réimporter. Il est illisible pour un humain, et c'est normal — ce n'est pas son
 * métier. Mais le soir, on veut relire ce qu'on a fait, pas déchiffrer des codes.
 * D'où la vue LISIBLE : les mêmes mesures, rangées par journée, par test, par essai,
 * avec les vrais noms. ⛔ Elle ne REMPLACE pas le carnet brut, elle le double.
 *
 * 🪤 LES NOMS NE SONT PAS DANS LE CARNET. Le brut n'a que des codes ; « Sprint 10
 * mètres » vit dans le PROGRAMME. Le recollage se fait donc dans `logbookLisible.js`,
 * à part, où il se teste sans monter d'écran.
 */

/** Les deux onglets, dans l'ordre du dessin : on relit avant de copier. */
const VUES = ['readable', 'raw'];

/**
 * Une ligne de mesure de la vue lisible.
 * @param {object} props Les propriétés de la ligne.
 * @param {Record<string, any>} props.ligne La mesure à écrire.
 * @returns {React.ReactElement} une ligne : son libellé, sa valeur, ses marqueurs
 */
function LigneLisible({ ligne }) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
      <Text
        numberOfLines={1}
        style={[Fonts.caption, { color: Colors.neutral300, flex: 1 }]}
      >
        {[
          ligne.label,
          ligne.essai ? t('training.logbook.attempt', { count: ligne.essai }) : null,
          ligne.cote ? t(`training.logbook.side.${ligne.cote}`) : null,
        ].filter(Boolean).join(' · ')}
      </Text>
      <Text
        style={[
          Fonts.p3Bold,
          {
            color: ligne.nulle ? Colors.gold500 : Colors.neutral00,
            // Un essai annulé se BARRE au lieu de disparaître : il compte dans la
            // série, et le voir barré évite de croire qu'on a oublié de le saisir.
            textDecorationLine: ligne.nulle ? 'line-through' : 'none',
          },
        ]}
      >
        {`${ligne.valeur}${ligne.unit ? ` ${ligne.unit}` : ''}`}
      </Text>
      {ligne.calculee && (
        <View style={{
          backgroundColor: withAlpha(Colors.primary500, 0.18),
          borderRadius: 999,
          paddingHorizontal: 6,
          paddingVertical: 1,
        }}
        >
          <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
            {t('training.logbook.computed')}
          </Text>
        </View>
      )}
      {ligne.nulle ? (
        <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
          {ligne.jugePar
            ? t(`training.logbook.voidBy.${ligne.jugePar}`)
            : t('training.logbook.void')}
        </Text>
      ) : (
        <Text style={[Fonts.caption, { color: Colors.success500 }]}>✓</Text>
      )}
    </View>
  );
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @returns {React.ReactElement} L'écran du carnet, sous ses deux formes.
 */
function TrainingLogbook({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    data, error, isLoading, refetch,
  } = useTrainingExport({ enabled: true });
  const { enrollment, sessions } = useMyTraining();
  const [copied, setCopied] = useState(false);
  const [vue, setVue] = useState('readable');

  const csv = data?.csv || '';
  const rows = data?.rows || 0;

  const lisible = useMemo(
    () => rangerLeCarnet(sessions, enrollment?.program?.days),
    [enrollment, sessions],
  );

  /**
   * Les lignes du carnet brut, decoupees UNE FOIS et non a chaque rendu.
   *
   * 🪤 Chacune porte sa propre clef : deux lignes du carnet peuvent etre
   * identiques mot pour mot — un essai ressaisi a la meme valeur — et React les
   * fusionnerait, faisant disparaitre la seconde.
   * @returns {{corps: {cle: string, texte: string}[], entete: string}} l entete et le corps
   */
  const brut = useMemo(() => {
    const toutes = csv ? csv.split('\n') : [];
    return {
      corps: toutes.slice(1).map((texte, rang) => ({ cle: `l${rang}`, texte })),
      entete: toutes[0] || '',
    };
  }, [csv]);

  /**
   * Le presse-papiers est charge A LA DEMANDE, comme partout ailleurs dans ce depot
   * (`shareLocalFile.native.js:52`, `Conversation.js`, `SuperAdminEntryList.js`) :
   * la dependance est facultative, et un build sans elle ne doit pas casser l ecran.
   * Le carnet reste selectionnable a la main dans tous les cas.
   */
  const copy = useCallback(() => {
    if (!csv) return;
    try {
      // eslint-disable-next-line global-require
      const maybeModule = require('@react-native-clipboard/clipboard');
      const clipboard = maybeModule?.default || maybeModule;
      if (!clipboard?.setString) return;
      clipboard.setString(csv);
      setCopied(true);
    } catch (_error) {
      // Sans presse-papiers, le texte reste selectionnable : on ne dit rien de faux.
    }
  }, [csv]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      {/*
        🪤 LA PAGE NE DÉFILAIT PAS. Le gabarit d'écran ne pose aucun défilement de
        lui-même : sur un carnet de huit journées, tout ce qui dépassait l'écran
        était simplement inatteignable — y compris le bouton « Copier ».
      */}
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[24]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          <View style={Spaces.gap[16]}>
            <View style={Spaces.gap[4]}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                <Text style={[Fonts.h2Bold, { color: Colors.neutral00, flex: 1 }]}>
                  {t('training.logbook.title')}
                </Text>
                {/* Le compte se met À CÔTÉ du titre, en petit : sur sa propre ligne
                    il poussait le carnet d'autant, sans rien dire de plus. */}
                {rows > 0 && (
                  <Text
                    // 🔊 « 47 » tout seul ne dit rien a la voix : l etiquette porte
                    // la phrase entiere, l ecran garde le chiffre.
                    accessibilityLabel={t('training.logbook.rows', { count: rows })}
                    style={[Fonts.p3Bold, { color: Colors.primary400 }]}
                  >
                    {rows}
                  </Text>
                )}
              </View>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('training.logbook.description')}
              </Text>
            </View>

            {rows > 0 ? (
              <View style={Spaces.gap[12]}>
                <View style={{
                  backgroundColor: withAlpha(Colors.primary500, 0.1),
                  borderRadius: 10,
                  flexDirection: 'row',
                  padding: 3,
                }}
                >
                  {VUES.map((clef) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ selected: vue === clef }}
                      key={clef}
                      onPress={() => setVue(clef)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: vue === clef ? Colors.primary500 : 'transparent',
                        borderRadius: 8,
                        flex: 1,
                        justifyContent: 'center',
                        // 44 points : la cible du doigt, comme partout ailleurs.
                        minHeight: 44,
                      }}
                    >
                      <Text
                        style={[
                          Fonts.p3Bold,
                          { color: vue === clef ? Colors.neutral00 : Colors.neutral300 },
                        ]}
                      >
                        {t(`training.logbook.view.${clef}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {vue === 'readable' ? (
                  <View style={Spaces.gap[16]}>
                    {lisible.map((jour) => (
                      <View key={`${jour.code}-${jour.date}`} style={Spaces.gap[8]}>
                        <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8 }}>
                          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                            {jour.title || jour.code}
                          </Text>
                          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                            {formatSessionDate(jour.date)}
                          </Text>
                        </View>
                        {jour.tests.map((test) => (
                          <View key={test.code} style={[Spaces.gap[4], { paddingLeft: 10 }]}>
                            <Text style={[Fonts.p3Bold, { color: Colors.primary400 }]}>
                              {test.name}
                            </Text>
                            {test.lignes.map((ligne) => (
                              <LigneLisible key={ligne.cle} ligne={ligne} />
                            ))}
                          </View>
                        ))}
                      </View>
                    ))}
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.logbook.readableHint')}
                    </Text>
                  </View>
                ) : (
                  <View style={Spaces.gap[12]}>
                    <ScrollView
                      horizontal
                      style={{
                        backgroundColor: Colors.neutral900,
                        borderColor: Colors.neutral700,
                        borderRadius: 8,
                        borderWidth: 1,
                        maxHeight: 320,
                        padding: 10,
                      }}
                    >
                      <ScrollView>
                        {/*
                          La première ligne du brut est celle des TITRES DE COLONNES :
                          elle se détache en cyan, séparée d'un trait. Sans ça, on
                          cherche à quelle colonne correspond la quatrième valeur.
                        */}
                        <Text
                          selectable
                          style={[
                            Fonts.caption,
                            {
                              borderBottomColor: withAlpha(Colors.primary500, 0.4),
                              borderBottomWidth: 1,
                              color: Colors.primary400,
                              fontFamily: 'monospace',
                              paddingBottom: 4,
                            },
                          ]}
                        >
                          {brut.entete}
                        </Text>
                        {brut.corps.map((ligne) => (
                          <Text
                            key={ligne.cle}
                            selectable
                            style={[
                              Fonts.caption,
                              {
                                // Un essai nul ressort en or jusque dans le brut :
                                // c'est la colonne « valide », neuvième sur onze, et
                                // personne ne la compte à l'œil.
                                color: ligne.texte.split(';')[8] === 'N'
                                  ? Colors.gold500 : Colors.neutral200,
                                fontFamily: 'monospace',
                              },
                            ]}
                          >
                            {ligne.texte}
                          </Text>
                        ))}
                      </ScrollView>
                    </ScrollView>

                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.logbook.rawHint')}
                    </Text>

                    <Button
                      onPress={copy}
                      title={copied
                        ? t('training.logbook.copied')
                        : t('training.actions.copyLogbook')}
                      variant="Primary"
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={Spaces.gap[12]}>
                <EmptyState
                  description={t('training.logbook.empty')}
                  // 🪤 Le titre du vide REDISAIT « Mon carnet », juste sous le vrai
                  // titre : on lisait deux fois la même chose et on croyait à un
                  // défaut d'affichage.
                  title={t('training.logbook.emptyTitle')}
                />
                {/* Un écran vide sans porte de sortie est un cul-de-sac : la seule
                    chose à faire quand le carnet est vide, c'est aller s'entraîner. */}
                <Button
                  onPress={() => navigation.navigate(RouteNames.TrainingPlan)}
                  title={t('training.logbook.emptyAction')}
                  variant="Secondary"
                />
              </View>
            )}
          </View>
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingLogbook;
