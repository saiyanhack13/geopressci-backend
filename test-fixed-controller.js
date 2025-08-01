const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Order = require('./src/models/order.model');
const ClientDirect = require('./src/models/client-direct.model');
const Pressing = require('./src/models/pressing.model');

async function testFixedController() {
  try {
    console.log('🧪 Test du contrôleur corrigé...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    const orderId = '688844d1c6a85488a3500579';
    console.log(`🎯 Test de la commande: ${orderId}`);
    
    // Simuler la recherche comme dans le contrôleur
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
      
    console.log('📄 Commande avec population corrigée:', {
      _id: order?._id,
      customer: order?.customer,
      pressing: order?.pressing,
      status: order?.status,
      customerPopulated: !!order?.customer,
      pressingPopulated: !!order?.pressing
    });
    
    if (order?.customer) {
      console.log('✅ Customer correctement populé:', {
        id: order.customer._id,
        nom: order.customer.nom,
        prenom: order.customer.prenom,
        email: order.customer.email
      });
      
      // Test de la logique de permission
      const customerId = order.customer._id?.toString() || order.customer.toString();
      const userId = '687dde13528b48ca748358cf'; // ID du client connecté
      
      console.log('🔐 Test des permissions:', {
        customerId,
        userId,
        match: customerId === userId
      });
      
      if (customerId === userId) {
        console.log('✅ Permissions OK - Client autorisé');
      } else {
        console.log('❌ Permissions KO - Client non autorisé');
      }
    } else {
      console.log('❌ Customer non populé');
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
  testFixedController()
    .then(() => {
      console.log('🎉 Test terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = testFixedController;
