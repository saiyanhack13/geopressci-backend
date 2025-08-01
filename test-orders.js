const jwt = require('jsonwebtoken');
const config = require('./src/config/config');

// Test du token JWT pour un pressing
console.log('🧪 Test du système de commandes GeoPressCI\n');

// Simuler un utilisateur pressing
const mockPressingUser = {
  _id: '507f1f77bcf86cd799439011',
  email: 'pressing@test.com',
  role: 'pressing',
  constructor: {
    modelName: 'Pressing'
  }
};

// Fonction generateToken modifiée (copie de auth.controller.js)
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

// Générer le token
const token = generateToken(mockPressingUser);
console.log('✅ Token JWT généré pour pressing:');
console.log('Token:', token.substring(0, 50) + '...\n');

// Décoder le token pour vérifier le payload
const decoded = jwt.decode(token);
console.log('📋 Payload du token:');
console.log(JSON.stringify(decoded, null, 2));

// Vérifier que pressingId est présent
if (decoded.pressingId) {
  console.log('\n✅ pressingId trouvé dans le token:', decoded.pressingId);
  console.log('✅ Le système de filtrage des commandes devrait fonctionner!');
} else {
  console.log('\n❌ pressingId manquant dans le token');
  console.log('❌ Le système de filtrage des commandes ne fonctionnera pas');
}

console.log('\n🔗 URL de test pour récupérer les commandes:');
console.log('GET http://localhost:5001/api/v1/orders');
console.log('Headers: Authorization: Bearer ' + token.substring(0, 30) + '...');

console.log('\n📝 Commande curl de test:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:5001/api/v1/orders`);
