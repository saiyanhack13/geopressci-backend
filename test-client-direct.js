const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Order = require('./src/models/order.model');
const ClientDirect = require('./src/models/client-direct.model');
const Pressing = require('./src/models/pressing.model');

async function testClientDirect() {
  try {
    console.log('🧪 Test du modèle Client direct...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    const customerId = '687dde13528b48ca748358cf';
    console.log(`🎯 Test du client: ${customerId}`);
    
    // Test avec le modèle direct
    const client = await ClientDirect.findById(customerId);
    console.log('📄 Client avec modèle direct:', {
      found: !!client,
      id: client?._id,
      nom: client?.nom,
      prenom: client?.prenom,
      email: client?.email
    });
    
    if (client) {
      console.log('✅ Client trouvé avec le modèle direct !');
      
      // Maintenant testons la population avec ce modèle
      const orderId = '688844d1c6a85488a3500579';
      const order = await Order.findById(orderId)
        .populate({
          path: 'customer',
          model: 'ClientDirect',
          select: 'nom prenom email telephone'
        })
        .populate({
          path: 'pressing',
          model: 'Pressing',
          select: 'nomCommerce adresse telephone'
        });
        
      console.log('📄 Population avec ClientDirect:', {
        orderId: order?._id,
        customer: order?.customer,
        pressing: order?.pressing,
        customerPopulated: !!order?.customer,
        pressingPopulated: !!order?.pressing
      });
      
      if (order?.customer) {
        console.log('🎉 Population réussie avec ClientDirect !');
      }
    } else {
      console.log('❌ Client non trouvé même avec le modèle direct');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  testClientDirect()
    .then(() => {
      console.log('🎉 Test terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = testClientDirect;
