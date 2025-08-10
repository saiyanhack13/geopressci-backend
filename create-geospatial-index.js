const mongoose = require('mongoose');
require('dotenv').config();

async function createGeospatialIndex() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Obtenir la collection pressings
    const db = mongoose.connection.db;
    const pressingsCollection = db.collection('pressings');

    // Créer l'index géospatial
    const indexResult = await pressingsCollection.createIndex(
      { 'address.coordinates': '2dsphere' },
      { 
        name: 'address_coordinates_2dsphere',
        background: true 
      }
    );

    console.log('✅ Index géospatial créé:', indexResult);

    // Vérifier les index existants
    const indexes = await pressingsCollection.listIndexes().toArray();
    console.log('\n📋 Index existants sur la collection pressings:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Tester une requête géospatiale simple
    const testQuery = await pressingsCollection.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [-4.0267, 5.3364] }, // Abidjan
          distanceField: 'distance',
          maxDistance: 10000, // 10km
          spherical: true,
          key: 'address.coordinates'
        }
      },
      { $limit: 1 }
    ]).toArray();

    console.log('\n🧪 Test de requête géospatiale:');
    if (testQuery.length > 0) {
      console.log('✅ Requête géospatiale fonctionne');
      console.log(`  Pressing trouvé: ${testQuery[0].businessName || 'N/A'}`);
      console.log(`  Distance: ${Math.round(testQuery[0].distance)}m`);
    } else {
      console.log('⚠️ Aucun pressing trouvé dans un rayon de 10km');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
createGeospatialIndex();
