// GUIDES-SITE-CORR-2 S12 (tournée des guides sur le site, 09/11, D 1360 rang 070) : la demande
// d'exemple de la mission 4 disait « Karim Benali demande à rejoindre ton club comme coach » alors
// que le dirigeant connecté s'appelait lui-même Karim Benali, et la bulle dit « cette personne
// n'existe pas ». Le prénom d'exemple évite celui du dirigeant comme celui du coach de M2.
import { exampleMembershipRequest } from '@/domains/tour/tourExamples';

const nom = (contexte) => exampleMembershipRequest(contexte).meta.requesterName;

it('S12 : le dirigeant s’appelle Karim : la demande d’exemple porte un autre prénom', () => {
  expect(nom({ viewerFirstName: 'Karim' })).not.toMatch(/^Karim /);
  expect(exampleMembershipRequest({ viewerFirstName: ' karim ' }).subtitle).not.toMatch(/Karim/);
});

it('S12 : ni le prénom du dirigeant, ni celui du coach de M2', () => {
  const choisi = nom({ coachFirstName: 'Sami', viewerFirstName: 'Karim' });
  expect(choisi).not.toMatch(/^(Karim|Sami) /);
  expect(choisi).toMatch(/ Benali$/);
});

it('sans conflit, l’exemple reste « Karim Benali » (témoins existants)', () => {
  expect(nom({ viewerFirstName: 'Julie' })).toBe('Karim Benali');
  expect(nom()).toBe('Karim Benali');
});
