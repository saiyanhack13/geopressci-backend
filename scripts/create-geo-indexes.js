/**
 * Script pour créer les index géospatiaux nécessaires
 * Exécuter avec: node scripts/create-geo-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const createGeoIndexes = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci');
    console.log('✅ Connexion à MongoDB réussie');

    const db = mongoose.connection.db;

    // Créer l'index 2dsphere sur address.coordinates pour la collection users
    console.log('🔄 Création de l\'index 2dsphere sur users.address.coordinates...');
    await db.collection('users').createIndex({ 'address.coordinates': '2dsphere' });
    console.log('✅ Index 2dsphere créé sur users.address.coordinates');

    // Créer d'autres index utiles pour les requêtes géospatiales
    console.log('🔄 Création d\'index supplémentaires...');
    
    // Index composé pour optimiser les requêtes de pressings actifs avec géolocalisation
    await db.collection('users').createIndex({ 
      'role': 1, 
      'isActive': 1, 
      'subscription.status': 1,
      'address.coordinates': '2dsphere' 
    });
    console.log('✅ Index composé créé pour les requêtes de pressings');

    // Index pour optimiser les recherches par ville/district
    await db.collection('users').createIndex({ 
      'address.city': 1, 
      'address.district': 1,
      'role': 1,
      'isActive': 1
    });
    console.log('✅ Index créé pour les recherches par localisation');

    // Vérifier les index créés
    console.log('\n📋 Index existants sur la collection users:');
    const indexes = await db.collection('users').indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n🎉 Tous les index géospatiaux ont été créés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Connexion MongoDB fermée');
  }
};

// Exécuter le script
createGeoIndexes();
