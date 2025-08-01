const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    
    const db = client.db('geopressci');
    const collection = db.collection('users');
    
    // Compter les documents avec role = 'Pressing'
    const pressingCount = await collection.countDocuments({ role: 'Pressing' });
    console.log(`📊 Nombre de pressings: ${pressingCount}`);
    
    // Compter les pressings actifs
    const activePressingCount = await collection.countDocuments({ 
      role: 'Pressing', 
      isActive: true 
    });
    console.log(`✅ Pressings actifs: ${activePressingCount}`);
    
    // Compter les pressings avec subscription active/trialing
    const subscribedPressingCount = await collection.countDocuments({ 
      role: 'Pressing', 
      isActive: true,
      'subscription.status': { $in: ['active', 'trialing'] }
    });
    console.log(`💳 Pressings avec abonnement valide: ${subscribedPressingCount}`);
    
    // Vérifier les coordonnées
    const pressingsWithCoords = await collection.countDocuments({ 
      role: 'Pressing', 
      isActive: true,
      'subscription.status': { $in: ['active', 'trialing'] },
      'address.coordinates': { $exists: true, $ne: null }
    });
    console.log(`📍 Pressings avec coordonnées: ${pressingsWithCoords}`);
    
    // Exemple de pressing avec coordonnées
    const samplePressing = await collection.findOne({ 
      role: 'Pressing', 
      isActive: true,
      'subscription.status': { $in: ['active', 'trialing'] },
      'address.coordinates': { $exists: true, $ne: null }
    });
    
    if (samplePressing) {
      console.log('\n📋 Exemple de pressing:');
      console.log('ID:', samplePressing._id);
      console.log('Nom:', samplePressing.businessName);
      console.log('Coordonnées:', samplePressing.address?.coordinates);
      console.log('Type coordonnées:', typeof samplePressing.address?.coordinates);
      console.log('Structure:', JSON.stringify(samplePressing.address?.coordinates, null, 2));
    } else {
      console.log('❌ Aucun pressing trouvé avec coordonnées');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('❌ Connexion fermée');
  }
}

checkData();
