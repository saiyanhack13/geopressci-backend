const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupGeoIndexes() {
  try {
    console.log('🔗 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connexion à MongoDB réussie');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Lister tous les index existants
    console.log('\n📋 Index existants sur la collection users:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Supprimer tous les index 2dsphere sauf celui sur address.coordinates
    console.log('\n🧹 Nettoyage des index 2dsphere...');
    
    for (const index of indexes) {
      // Vérifier si c'est un index 2dsphere
      const has2dsphere = Object.values(index.key).includes('2dsphere');
      
      if (has2dsphere && index.name !== '_id_' && index.name !== 'address.coordinates_2dsphere') {
        try {
          console.log(`🗑️ Suppression de l'index: ${index.name}`);
          await collection.dropIndex(index.name);
          console.log(`✅ Index ${index.name} supprimé`);
        } catch (error) {
          console.log(`⚠️ Erreur lors de la suppression de ${index.name}:`, error.message);
        }
      }
    }

    // Créer l'index principal si il n'existe pas
    console.log('\n🔄 Vérification de l\'index principal...');
    try {
      await collection.createIndex(
        { "address.coordinates": "2dsphere" },
        { name: "address.coordinates_2dsphere" }
      );
      console.log('✅ Index principal address.coordinates_2dsphere vérifié/créé');
    } catch (error) {
      if (error.code === 85) {
        console.log('✅ Index principal déjà existant');
      } else {
        console.log('⚠️ Erreur lors de la création de l\'index principal:', error.message);
      }
    }

    // Lister les index finaux
    console.log('\n📋 Index finaux sur la collection users:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n🎉 Nettoyage des index terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des index:', error);
  } finally {
    console.log('🔌 Fermeture de la connexion MongoDB');
    await mongoose.connection.close();
  }
}

cleanupGeoIndexes();
