const mongoose = require('mongoose');
require('dotenv').config();

async function migratePressing() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const pressingsCollection = db.collection('pressings');

    // Trouver l'utilisateur pressing spécifique
    const pressingUserId = '68950559e0e42bf6c61e3bc4';
    const pressingUser = await usersCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(pressingUserId),
      role: 'pressing'
    });

    if (!pressingUser) {
      console.log('❌ Utilisateur pressing non trouvé dans la collection users');
      return;
    }

    console.log('✅ Utilisateur pressing trouvé:', {
      id: pressingUser._id,
      email: pressingUser.email,
      businessName: pressingUser.businessName,
      role: pressingUser.role
    });

    // Vérifier s'il existe déjà dans pressings
    const existingPressing = await pressingsCollection.findOne({ 
      _id: pressingUser._id 
    });

    if (existingPressing) {
      console.log('⚠️ Le pressing existe déjà dans la collection pressings');
    } else {
      // Copier vers la collection pressings
      const pressingData = {
        ...pressingUser,
        // S'assurer que les champs requis sont présents
        role: 'pressing',
        createdAt: pressingUser.createdAt || new Date(),
        updatedAt: new Date()
      };

      await pressingsCollection.insertOne(pressingData);
      console.log('✅ Pressing copié vers la collection pressings');
    }

    // Supprimer de la collection users
    await usersCollection.deleteOne({ _id: pressingUser._id });
    console.log('✅ Utilisateur supprimé de la collection users');

    // Vérifier que la migration a fonctionné
    const migratedPressing = await pressingsCollection.findOne({ 
      _id: pressingUser._id 
    });

    if (migratedPressing) {
      console.log('🎉 Migration réussie !');
      console.log('📊 Pressing dans la bonne collection:', {
        id: migratedPressing._id,
        email: migratedPressing.email,
        businessName: migratedPressing.businessName,
        collection: 'pressings'
      });
    }

    // Créer l'index géospatial si nécessaire
    try {
      await pressingsCollection.createIndex(
        { 'address.coordinates': '2dsphere' },
        { background: true }
      );
      console.log('✅ Index géospatial créé/vérifié');
    } catch (error) {
      console.log('⚠️ Index géospatial:', error.message);
    }

  } catch (error) {
    console.error('❌ Erreur de migration:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la migration
migratePressing();
