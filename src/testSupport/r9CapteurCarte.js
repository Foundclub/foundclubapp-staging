// 📸 Capteur de props de la carte d evenement, partage entre le `jest.mock`
// (hisse en tete de fichier par Jest) et le corps du test. Il vit dans un module
// a part pour la meme raison que `p7Capteurs` juste a cote : une usine de mock
// ne peut pas fermer sur une variable du fichier de test.
export const capteurCarte = { props: /** @type {any} */ (null) };

export default capteurCarte;
