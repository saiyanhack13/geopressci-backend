const mongoose = require('mongoose');
const Order = require('./src/models/order.model');
const ClientDirect = require('./src/models/client-direct.model');
const Pressing = require('./src/models/pressing.model');
require('dotenv').config();

async function testOrderData() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const orderId = '688844d1c6a85488a3500579';
    console.log(`\n🔍 Test des données de la commande ${orderId}:`);

    // 1. Récupérer la commande brute
    console.log('\n📋 1. Commande brute (sans population):');
    const rawOrder = await Order.findById(orderId);
    if (rawOrder) {
      console.log('- ID Customer:', rawOrder.customer);
      console.log('- ID Pressing:', rawOrder.pressing);
      console.log('- Metadata pressingSnapshot:', rawOrder.metadata?.pressingSnapshot ? 'EXISTE' : 'ABSENT');
      if (rawOrder.metadata?.pressingSnapshot) {
        console.log('  - Nom:', rawOrder.metadata.pressingSnapshot.name);
        console.log('  - Téléphone:', rawOrder.metadata.pressingSnapshot.phone);
        console.log('  - Adresse:', rawOrder.metadata.pressingSnapshot.address);
      }
    } else {
      console.log('❌ Commande non trouvée');
      return;
    }

    // 2. Vérifier si le pressing existe
    console.log('\n🏢 2. Vérification du pressing:');
    const pressing = await Pressing.findById(rawOrder.pressing);
    if (pressing) {
      console.log('✅ Pressing trouvé:');
      console.log('- Nom:', pressing.nomCommerce || pressing.name);
      console.log('- Adresse:', pressing.adresse);
      console.log('- Téléphone:', pressing.telephone);
    } else {
      console.log('❌ Pressing non trouvé avec ID:', rawOrder.pressing);
    }

    // 3. Récupérer la commande avec population
    console.log('\n🔗 3. Commande avec population:');
    const populatedOrder = await Order.findById(orderId)
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

    if (populatedOrder) {
      console.log('✅ Population réussie:');
      console.log('- Customer populé:', populatedOrder.customer ? 'OUI' : 'NON');
      if (populatedOrder.customer) {
        console.log('  - Nom:', populatedOrder.customer.nom, populatedOrder.customer.prenom);
      }
      
      console.log('- Pressing populé:', populatedOrder.pressing ? 'OUI' : 'NON');
      if (populatedOrder.pressing) {
        console.log('  - Nom:', populatedOrder.pressing.nomCommerce || populatedOrder.pressing.name);
        console.log('  - Adresse:', populatedOrder.pressing.adresse);
        console.log('  - Téléphone:', populatedOrder.pressing.telephone);
      }
    }

    // 4. Test de la réponse JSON complète
    console.log('\n📤 4. Réponse JSON (comme envoyée au frontend):');
    const response = {
      success: true,
      data: populatedOrder
    };
    
    // Simuler ce que reçoit le frontend
    const orderData = response.data;
    console.log('- Articles:', orderData.items?.length || 0);
    if (orderData.items?.[0]) {
      console.log('  - Premier article:', orderData.items[0].serviceDetails?.name);
      console.log('  - Prix unitaire:', orderData.items[0].unitPrice);
    }
    console.log('- Total:', orderData.payment?.amount?.total);
    console.log('- Pressing populé:', orderData.pressing ? 'OUI' : 'NON');
    console.log('- Metadata pressing:', orderData.metadata?.pressingSnapshot ? 'OUI' : 'NON');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

testOrderData();
