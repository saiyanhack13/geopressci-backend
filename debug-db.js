const mongoose = require('mongoose');
const config = require('./src/config/config');

async function debugDatabase() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(config.db.uri);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    
    // Lister toutes les collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections disponibles:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Vérifier la collection users
    console.log('\n👥 Collection users:');
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    console.log(`  Nombre d'utilisateurs: ${usersCount}`);
    
    if (usersCount > 0) {
      const users = await usersCollection.find({}).limit(5).toArray();
      console.log('  Premiers utilisateurs:');
      users.forEach(user => {
        console.log(`    - ID: ${user._id}, Email: ${user.email}, Role: ${user.role}`);
      });
    }

    // Vérifier la collection clients
    console.log('\n👤 Collection clients:');
    const clientsCollection = db.collection('clients');
    const clientsCount = await clientsCollection.countDocuments();
    console.log(`  Nombre de clients: ${clientsCount}`);
    
    if (clientsCount > 0) {
      const clients = await clientsCollection.find({}).limit(5).toArray();
      console.log('  Premiers clients:');
      clients.forEach(client => {
        console.log(`    - ID: ${client._id}, Email: ${client.email}, Role: ${client.role}`);
      });
    }

    // Rechercher l'utilisateur spécifique
    const targetId = '687dde13528b48ca748358cf';
    console.log(`\n🔍 Recherche de l'utilisateur ${targetId}:`);
    
    try {
      const objectId = new mongoose.Types.ObjectId(targetId);
      
      const userInUsers = await usersCollection.findOne({ _id: objectId });
      console.log(`  Dans users: ${userInUsers ? 'TROUVÉ' : 'NON TROUVÉ'}`);
      
      const userInClients = await clientsCollection.findOne({ _id: objectId });
      console.log(`  Dans clients: ${userInClients ? 'TROUVÉ' : 'NON TROUVÉ'}`);
      
      if (userInClients) {
        console.log('  Données client:', {
          id: userInClients._id,
          email: userInClients.email,
          nom: userInClients.nom,
          prenom: userInClients.prenom,
          role: userInClients.role,
          createdAt: userInClients.createdAt
        });
      }
    } catch (error) {
      console.log(`  Erreur ObjectId: ${error.message}`);
    }

    // Vérifier s'il y a des utilisateurs avec un email spécifique
    console.log('\n📧 Recherche par email eddy1399@gmail.com:');
    const userByEmail = await clientsCollection.findOne({ email: 'eddy1399@gmail.com' });
    if (userByEmail) {
      console.log('  Utilisateur trouvé:', {
        id: userByEmail._id,
        email: userByEmail.email,
        role: userByEmail.role
      });
    } else {
      console.log('  Aucun utilisateur trouvé avec cet email');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

debugDatabase();
