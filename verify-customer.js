const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Client = require('./src/models/client.model');

async function verifyCustomer() {
  try {
    console.log('🔍 Vérification du customer...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    const customerId = '687dde13528b48ca748358cf';
    console.log(`🎯 Recherche du client: ${customerId}`);
    
    // Rechercher le client directement
    const client = await Client.findById(customerId);
    console.log('📄 Client trouvé:', client);
    
    // Lister tous les clients
    const allClients = await Client.find({}).select('_id nom prenom email');
    console.log('\n📋 Tous les clients:');
    allClients.forEach(client => {
      console.log(`   ${client._id}: ${client.nom} ${client.prenom} (${client.email})`);
    });
    
    // Vérifier dans la collection directement
    const db = mongoose.connection.db;
    const clientsCollection = db.collection('clients');
    const clientDirect = await clientsCollection.findOne({ _id: new mongoose.Types.ObjectId(customerId) });
    console.log('\n📄 Client via collection directe:', clientDirect);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  verifyCustomer()
    .then(() => {
      console.log('🎉 Vérification terminée !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = verifyCustomer;
