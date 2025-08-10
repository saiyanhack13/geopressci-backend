const mongoose = require('mongoose');
const config = require('./src/config/config');

// Modèles
const Order = require('./src/models/order.model');

async function investigateOrder() {
  try {
    console.log('🔍 Investigation de la commande spécifique...');
    
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');
    
    const orderId = '688844d1c6a85488a3500579';
    console.log(`🎯 Recherche de la commande: ${orderId}`);
    
    // Rechercher la commande sans population
    const orderRaw = await Order.findById(orderId);
    console.log('📄 Commande brute:', {
      _id: orderRaw?._id,
      customer: orderRaw?.customer,
      pressing: orderRaw?.pressing,
      status: orderRaw?.status,
      createdAt: orderRaw?.createdAt,
      customerExists: orderRaw?.customer !== undefined,
      customerIsNull: orderRaw?.customer === null,
      pressingExists: orderRaw?.pressing !== undefined,
      pressingIsNull: orderRaw?.pressing === null
    });
    
    // Rechercher avec population (en utilisant les bons modèles)
    let orderPopulated = null;
    try {
      // Essayer avec les modèles Client et Pressing
      const Client = require('./src/models/client.model');
      const Pressing = require('./src/models/pressing.model');
      
      orderPopulated = await Order.findById(orderId)
        .populate({
          path: 'customer',
          model: 'Client',
          select: 'nom prenom email'
        })
        .populate({
          path: 'pressing', 
          model: 'Pressing',
          select: 'nomCommerce adresse'
        });
    } catch (error) {
      console.log('⚠️ Erreur de population:', error.message);
    }
      
    console.log('📄 Commande avec population:', {
      _id: orderPopulated?._id,
      customer: orderPopulated?.customer,
      pressing: orderPopulated?.pressing,
      status: orderPopulated?.status,
      customerPopulated: !!orderPopulated?.customer,
      pressingPopulated: !!orderPopulated?.pressing
    });
    
    // Rechercher toutes les commandes avec des problèmes de customer
    const ordersWithNullCustomer = await Order.find({ 
      customer: null 
    });
    
    const ordersWithUndefinedCustomer = await Order.find({ 
      customer: { $exists: false } 
    });
    
    console.log(`📊 Commandes avec customer null: ${ordersWithNullCustomer.length}`);
    console.log(`📊 Commandes sans champ customer: ${ordersWithUndefinedCustomer.length}`);
    
    // Lister toutes les commandes avec leurs customers
    const allOrders = await Order.find({}).select('_id customer pressing status');
    console.log('\n📋 Toutes les commandes:');
    allOrders.forEach(order => {
      console.log(`   ${order._id}: customer=${order.customer || 'NULL'}, pressing=${order.pressing || 'NULL'}, status=${order.status}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'investigation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  investigateOrder()
    .then(() => {
      console.log('🎉 Investigation terminée !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = investigateOrder;
