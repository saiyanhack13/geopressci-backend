const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testDirectQuery() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');
    
    const db = client.db('geopressci');
    const collection = db.collection('users');
    
    const lng = -4.0267;
    const lat = 5.3364;
    const radius = 10;
    
    console.log(`\n🔍 Test de la requête géospatiale directe:`);
    console.log(`Point de recherche: [${lng}, ${lat}]`);
    console.log(`Rayon: ${radius} km`);
    
    // Test de l'agrégation $geoNear
    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: 'distance',
          maxDistance: radius * 1000, // Conversion en mètres
          spherical: true,
          key: 'address.coordinates',
          query: {
            'role': 'Pressing',
            'isActive': true,
            'subscription.status': { $in: ['active', 'trialing'] }
          }
        }
      },
      {
        $project: {
          businessName: 1,
          'address.coordinates': 1,
          distance: 1,
          role: 1,
          isActive: 1,
          'subscription.status': 1
        }
      }
    ];
    
    console.log('\n📍 Exécution de l\'agrégation...');
    const results = await collection.aggregate(pipeline).toArray();
    
    console.log(`✅ Résultats trouvés: ${results.length}`);
    
    if (results.length > 0) {
      results.forEach((pressing, index) => {
        console.log(`\n${index + 1}. ${pressing.businessName}`);
        console.log(`   Distance: ${(pressing.distance / 1000).toFixed(2)} km`);
        console.log(`   Coordonnées: [${pressing.address.coordinates.coordinates.join(', ')}]`);
        console.log(`   Status: ${pressing.subscription?.status}`);
      });
    } else {
      console.log('❌ Aucun pressing trouvé');
      
      // Vérifier s'il y a des pressings sans filtre géospatial
      const allPressings = await collection.find({
        'role': 'Pressing',
        'isActive': true,
        'subscription.status': { $in: ['active', 'trialing'] }
      }).toArray();
      
      console.log(`\n📊 Pressings totaux (sans filtre géo): ${allPressings.length}`);
      
      if (allPressings.length > 0) {
        const firstPressing = allPressings[0];
        console.log('\n📋 Premier pressing:');
        console.log('Nom:', firstPressing.businessName);
        console.log('Coordonnées:', firstPressing.address?.coordinates);
        
        // Calculer la distance manuellement
        if (firstPressing.address?.coordinates?.coordinates) {
          const [pressingLng, pressingLat] = firstPressing.address.coordinates.coordinates;
          const distance = calculateDistance(lat, lng, pressingLat, pressingLng);
          console.log(`Distance calculée: ${distance.toFixed(2)} km`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.close();
    console.log('❌ Connexion fermée');
  }
}

// Fonction pour calculer la distance entre deux points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

testDirectQuery();
