const mongoose = require('mongoose');
require('dotenv').config();

async function createGeoIndex() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Créer l'index 2dsphere sur address.coordinates
    console.log('📍 Création de l\'index 2dsphere sur address.coordinates...');
    const result = await collection.createIndex(
      { 'address.coordinates': '2dsphere' },
      { 
        name: 'address_coordinates_2dsphere',
        background: true 
      }
    );
    
    console.log('✅ Index créé:', result);

    // Vérifier les index existants
    console.log('\n📋 Index existants sur la collection users:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, JSON.stringify(index.key, null, 2));
    });

    console.log('\n✅ Script terminé avec succès');
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('❌ Déconnecté de MongoDB');
  }
}

createGeoIndex();
