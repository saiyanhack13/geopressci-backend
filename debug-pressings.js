const mongoose = require('mongoose');
require('dotenv').config();

async function checkPressings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci');
    console.log('✅ Connecté à MongoDB');
    
    // Récupérer tous les pressings récents
    const pressings = await mongoose.connection.db.collection('pressings')
      .find({})
      .sort({createdAt: -1})
      .limit(5)
      .toArray();
    
    console.log('\n📊 Derniers pressings créés:');
    pressings.forEach((pressing, index) => {
      console.log(`\n--- Pressing ${index + 1} ---`);
      console.log(`ID: ${pressing._id}`);
      console.log(`Nom: ${pressing.businessName || pressing.nom}`);
      console.log(`Email: ${pressing.email}`);
      console.log(`Role: ${pressing.role}`);
      console.log(`isActive: ${pressing.isActive}`);
      console.log(`Subscription Status: ${pressing.subscription?.status}`);
      console.log(`Address Coordinates: ${pressing.address?.coordinates ? 'Oui' : 'Non'}`);
      if (pressing.address?.coordinates) {
        console.log(`  Coordonnées: [${pressing.address.coordinates[0]}, ${pressing.address.coordinates[1]}]`);
      }
      console.log(`Créé le: ${pressing.createdAt}`);
    });
    
    // Vérifier combien de pressings respectent les critères de la carte
    const mapCriteria = {
      'isActive': true,
      'subscription.status': { $in: ['active', 'trialing'] },
      'address.coordinates': { $exists: true, $ne: null }
    };
    
    const mapEligibleCount = await mongoose.connection.db.collection('pressings').countDocuments(mapCriteria);
    const totalCount = await mongoose.connection.db.collection('pressings').countDocuments({});
    
    console.log(`\n📍 Pressings éligibles pour la carte: ${mapEligibleCount}/${totalCount}`);
    
    // Vérifier les pressings qui ne respectent pas les critères
    const ineligiblePressings = await mongoose.connection.db.collection('pressings')
      .find({
        $or: [
          { 'isActive': { $ne: true } },
          { 'subscription.status': { $nin: ['active', 'trialing'] } },
          { 'address.coordinates': { $exists: false } },
          { 'address.coordinates': null }
        ]
      })
      .toArray();
    
    console.log(`\n❌ Pressings NON éligibles pour la carte (${ineligiblePressings.length}):`);
    ineligiblePressings.forEach((pressing, index) => {
      console.log(`\n--- Pressing non éligible ${index + 1} ---`);
      console.log(`Nom: ${pressing.businessName || pressing.nom}`);
      console.log(`isActive: ${pressing.isActive}`);
      console.log(`Subscription Status: ${pressing.subscription?.status}`);
      console.log(`Address Coordinates: ${pressing.address?.coordinates ? 'Oui' : 'Non'}`);
      
      // Identifier les problèmes spécifiques
      const issues = [];
      if (pressing.isActive !== true) issues.push('isActive n\'est pas true');
      if (!['active', 'trialing'].includes(pressing.subscription?.status)) {
        issues.push(`subscription.status est '${pressing.subscription?.status}' au lieu de 'active' ou 'trialing'`);
      }
      if (!pressing.address?.coordinates) issues.push('address.coordinates manquant');
      
      console.log(`Problèmes: ${issues.join(', ')}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Déconnecté de MongoDB');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkPressings();
