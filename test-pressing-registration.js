const mongoose = require('mongoose');
const { User } = require('./src/models/user.model');
const Pressing = require('./src/models/pressing.model');
const Client = require('./src/models/client.model');

// Configuration de la base de données
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/geopressci';

async function testPressingRegistration() {
  try {
    // Connexion à MongoDB
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connexion MongoDB établie');

    // Données de test pour un pressing
    const testPressingData = {
      // Champs hérités de User
      prenom: 'Jean',
      nom: 'Dupont',
      email: 'test-pressing@example.com',
      phone: '+2250701234567',
      password: 'TestPassword123',
      role: 'pressing',
      
      // Champs spécifiques au Pressing
      businessName: 'Pressing Test',
      businessPhone: '0701234567',
      
      // Structure address
      address: {
        street: 'Rue de la Paix',
        city: 'Abidjan',
        district: 'Cocody',
        postalCode: '00225',
        country: 'Côte d\'Ivoire',
        coordinates: {
          type: 'Point',
          coordinates: [-4.001, 5.365]
        },
        formattedAddress: 'Cocody, Rue de la Paix'
      },
      
      description: 'Pressing de test pour validation',
      
      // Configuration par défaut
      businessHours: [
        { day: 'lundi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'mardi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'mercredi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'jeudi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'vendredi', open: '08:00', close: '18:00', isClosed: false },
        { day: 'samedi', open: '08:00', close: '16:00', isClosed: false },
        { day: 'dimanche', open: '00:00', close: '00:00', isClosed: true }
      ],
      
      services: [],
      
      deliveryOptions: {
        isAvailable: false,
        freeDeliveryThreshold: 10000,
        deliveryFee: 1000,
        maxDeliveryDistance: 10,
        estimatedDeliveryTime: 120
      },
      
      status: 'pending',
      isVerified: false
    };

    console.log('📝 Tentative de création du pressing...');
    console.log('Données:', {
      email: testPressingData.email,
      businessName: testPressingData.businessName,
      role: testPressingData.role,
      coordinates: testPressingData.address.coordinates.coordinates
    });

    // Supprimer l'utilisateur existant s'il existe
    await User.deleteOne({ email: testPressingData.email });
    console.log('🗑️ Utilisateur existant supprimé (si présent)');

    // Créer le pressing
    const pressing = new Pressing(testPressingData);
    const savedPressing = await pressing.save();
    
    console.log('✅ Pressing créé avec succès !');
    console.log('ID:', savedPressing._id);
    console.log('Email:', savedPressing.email);
    console.log('Business Name:', savedPressing.businessName);
    console.log('Role:', savedPressing.role);
    console.log('Collection:', savedPressing.collection.name);
    
    // Vérifier que c'est bien dans la collection users
    const userCheck = await User.findById(savedPressing._id);
    console.log('✅ Vérification dans collection users:', userCheck ? 'TROUVÉ' : 'NON TROUVÉ');
    
    // Tester aussi la création d'un client
    console.log('\n📝 Test création client...');
    const testClientData = {
      prenom: 'Marie',
      nom: 'Martin',
      email: 'test-client@example.com',
      phone: '+2250701234568',
      password: 'TestPassword123',
      role: 'client',
      addresses: [],
      status: 'active'
    };

    await User.deleteOne({ email: testClientData.email });
    const client = new Client(testClientData);
    const savedClient = await client.save();
    
    console.log('✅ Client créé avec succès !');
    console.log('ID:', savedClient._id);
    console.log('Email:', savedClient.email);
    console.log('Role:', savedClient.role);
    console.log('Collection:', savedClient.collection.name);

    // Nettoyer les données de test
    await User.deleteOne({ email: testPressingData.email });
    await User.deleteOne({ email: testClientData.email });
    console.log('🗑️ Données de test nettoyées');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    console.error('Message:', error.message);
    if (error.errors) {
      console.error('Erreurs de validation:', error.errors);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB');
  }
}

// Exécuter le test
testPressingRegistration();
