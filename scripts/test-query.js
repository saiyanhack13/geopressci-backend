const mongoose = require('mongoose');
require('dotenv').config();

// Import du modèle Pressing
const Pressing = require('../src/models/pressing.model');

async function testQuery() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const lng = -4.0267;
    const lat = 5.3364;
    const radius = 10;

    console.log(`\n🔍 Test de la requête géospatiale:`);
    console.log(`Longitude: ${lng}`);
    console.log(`Latitude: ${lat}`);
    console.log(`Rayon: ${radius} km`);

    // Test de la méthode findNearby
    console.log('\n📍 Exécution de la requête...');
    const results = await Pressing.findNearby(lng, lat, radius);
    
    console.log(`✅ Résultats trouvés: ${results.length}`);
    
    if (results.length > 0) {
      results.forEach((pressing, index) => {
        console.log(`\n${index + 1}. ${pressing.businessName}`);
        console.log(`   Distance: ${(pressing.distance / 1000).toFixed(2)} km`);
        console.log(`   Coordonnées: [${pressing.address.coordinates.coordinates.join(', ')}]`);
      });
    } else {
      console.log('❌ Aucun pressing trouvé dans le rayon spécifié');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la requête:', error);
  } finally {
    await mongoose.disconnect();
    console.log('❌ Déconnecté de MongoDB');
  }
}

testQuery();
