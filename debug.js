// Charger les variables d'environnement en premier
require('dotenv').config({ path: '.env' });

console.log('=== DÉMARRAGE DU DÉBOGAGE ===');

// 1. Vérifier les variables d'environnement
console.log('\n1. Vérification des variables d\'environnement:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '*** MongoDB URI configurée ***' : 'NON CONFIGURÉE');

// 2. Tester la connexion à MongoDB
console.log('\n2. Test de connexion à MongoDB...');
const mongoose = require('mongoose');

async function testMongoDB() {
  try {
    console.log('Tentative de connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connexion à MongoDB réussie!');
    console.log('- Base de données:', mongoose.connection.name);
    console.log('- Hôte:', mongoose.connection.host);
    await mongoose.connection.close();
    return true;
  } catch (error) {
    console.error('❌ Échec de la connexion à MongoDB:');
    console.error('- Message:', error.message);
    console.error('- Code:', error.code);
    console.error('- CodeName:', error.codeName);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nVérifiez que:');
      console.error('1. MongoDB est en cours d\'exécution');
      console.error('2. L\'URL de connexion est correcte');
      console.error('3. Votre IP est autorisée (si vous utilisez MongoDB Atlas)');
    }
    return false;
  }
}

// 3. Tester le chargement de l'application
console.log('\n3. Test de chargement de l\'application...');
try {
  const app = require('./src/app');
  console.log('✅ Application chargée avec succès!');
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'application:');
  console.error(error);
}

// Exécuter les tests
async function runTests() {
  console.log('\n=== LANCEMENT DES TESTS ===');
  
  // Tester MongoDB
  const mongoConnected = await testMongoDB();
  
  // Afficher le résumé
  console.log('\n=== RÉSUMÉ ===');
  console.log(`- MongoDB: ${mongoConnected ? '✅ Connecté' : '❌ Échec de la connexion'}`);
  
  if (!mongoConnected) {
    console.log('\nCONSEIL: Vérifiez votre connexion Internet et que MongoDB est en cours d\'exécution.');
    console.log('Si vous utilisez MongoDB Atlas, assurez-vous que votre IP est autorisée.');
  } else {
    console.log('\nLe serveur devrait démarrer normalement. Essayez à nouveau avec:');
    console.log('  npm start');
  }
}

// Lancer les tests
runTests().catch(console.error);
