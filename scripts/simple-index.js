const { MongoClient } = require('mongodb');
require('dotenv').config();

async function createIndex() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    
    const db = client.db('geopressci');
    const collection = db.collection('users');
    
    // Supprimer tous les index 2dsphere existants sauf _id
    console.log('🗑️ Suppression des anciens index 2dsphere...');
    const indexes = await collection.indexes();
    
    for (const index of indexes) {
      if (index.name !== '_id_' && index.name.includes('2dsphere')) {
        try {
          await collection.dropIndex(index.name);
          console.log(`✅ Index supprimé: ${index.name}`);
        } catch (err) {
          console.log(`⚠️ Impossible de supprimer ${index.name}:`, err.message);
        }
      }
    }
    
    // Créer le nouvel index
    console.log('📍 Création du nouvel index 2dsphere...');
    await collection.createIndex(
      { 'address.coordinates': '2dsphere' },
      { name: 'address_coordinates_2dsphere' }
    );
    
    console.log('✅ Index créé avec succès!');
    
    // Lister les index finaux
    const finalIndexes = await collection.indexes();
    console.log('\n📋 Index finaux:');
    finalIndexes.forEach(idx => {
      console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('❌ Connexion fermée');
  }
}

createIndex();
