const jwt = require('jsonwebtoken');
const config = require('./src/config/config');

// Test du token JWT pour un client
console.log('🧪 Test du token JWT pour client\n');

// Simuler un utilisateur client
const mockClientUser = {
  _id: '687dde13528b48ca748358cf', // ID d'un client existant dans la base
  email: 'client@test.com',
  role: 'client',
  constructor: {
    modelName: 'User'
  }
};

// Fonction generateToken (copie de auth.controller.js)
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    type: user.constructor.modelName.toLowerCase()
  };
  
  // Ajouter le pressingId pour les utilisateurs pressing
  if (user.role === 'pressing') {
    // Si l'utilisateur est un pressing, son ID est le pressingId
    payload.pressingId = user._id;
    
    // Si l'utilisateur pressing a une référence à un pressing séparé, l'utiliser
    if (user.pressing) {
      payload.pressingId = user.pressing;
    }
  }
  
  // Options du token
  const options = {
    expiresIn: config.jwt.expiresIn,
    issuer: 'geopressci-api',
    audience: user.role
  };
  
  return jwt.sign(payload, config.jwt.secret, options);
};

// Générer le token pour le client
const clientToken = generateToken(mockClientUser);
console.log('✅ Token JWT généré pour client:');
console.log('Token:', clientToken.substring(0, 50) + '...\n');

// Décoder le token pour vérifier le payload
const decoded = jwt.decode(clientToken);
console.log('📋 Payload du token client:');
console.log(JSON.stringify(decoded, null, 2));

// Vérifier que l'ID utilisateur est présent
if (decoded.id) {
  console.log('\n✅ ID utilisateur trouvé dans le token:', decoded.id);
  console.log('✅ Le filtrage des commandes client devrait fonctionner!');
} else {
  console.log('\n❌ ID utilisateur manquant dans le token');
  console.log('❌ Le filtrage des commandes client ne fonctionnera pas');
}

console.log('\n🔗 URL de test pour récupérer les commandes client:');
console.log('GET http://localhost:5001/api/v1/orders');
console.log('Headers: Authorization: Bearer ' + clientToken.substring(0, 30) + '...');

console.log('\n📝 Commande curl de test:');
console.log(`curl -H "Authorization: Bearer ${clientToken}" http://localhost:5001/api/v1/orders`);

console.log('\n🎯 Filtre attendu dans getOrders:');
console.log(`{ customer: '${decoded.id}' }`);
