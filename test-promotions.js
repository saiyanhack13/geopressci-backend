#!/usr/bin/env node

/**
 * Script de test pour vérifier les nouvelles routes de promotions pour les pressings
 */

const axios = require('axios');

const BASE_URL = 'https://geopressci-akcdaadk.b4a.run//api/v1';

// Token d'un pressing (remplacez par un vrai token)
const PRESSING_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // À remplacer

const headers = {
  'Authorization': `Bearer ${PRESSING_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testPromotionEndpoints() {
  console.log('🧪 Test des endpoints de promotions pour les pressings\n');

  try {
    // Test 1: Récupérer les promotions
    console.log('📝 Test 1: GET /pressings/promotions');
    try {
      const response = await axios.get(`${BASE_URL}/pressings/promotions?page=1&limit=12`, { headers });
      console.log('✅ Succès:', response.status, response.data.success ? 'Success' : 'Failed');
      console.log('📊 Promotions trouvées:', response.data.count || 0);
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data?.message || error.message);
    }

    console.log('');

    // Test 2: Créer une promotion de test
    console.log('📝 Test 2: POST /pressings/promotions');
    const promotionData = {
      title: 'Promotion Test',
      description: 'Promotion de test créée automatiquement',
      type: 'percentage',
      value: 20,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 jours
    };

    try {
      const response = await axios.post(`${BASE_URL}/pressings/promotions`, promotionData, { headers });
      console.log('✅ Succès:', response.status, response.data.success ? 'Success' : 'Failed');
      console.log('🎯 Promotion créée:', response.data.data?.name || 'N/A');
      
      // Sauvegarder l'ID pour les tests suivants
      const promotionId = response.data.data?._id;
      
      if (promotionId) {
        console.log('');
        
        // Test 3: Récupérer la promotion par ID
        console.log('📝 Test 3: GET /pressings/promotions/:id');
        try {
          const getResponse = await axios.get(`${BASE_URL}/pressings/promotions/${promotionId}`, { headers });
          console.log('✅ Succès:', getResponse.status, getResponse.data.success ? 'Success' : 'Failed');
          console.log('🎯 Promotion récupérée:', getResponse.data.data?.name || 'N/A');
        } catch (error) {
          console.log('❌ Erreur:', error.response?.status, error.response?.data?.message || error.message);
        }

        console.log('');

        // Test 4: Mettre à jour le statut
        console.log('📝 Test 4: PATCH /pressings/promotions/:id/status');
        try {
          const statusResponse = await axios.patch(`${BASE_URL}/pressings/promotions/${promotionId}/status`, 
            { status: 'active' }, { headers });
          console.log('✅ Succès:', statusResponse.status, statusResponse.data.success ? 'Success' : 'Failed');
          console.log('🎯 Statut mis à jour:', statusResponse.data.data?.status || 'N/A');
        } catch (error) {
          console.log('❌ Erreur:', error.response?.status, error.response?.data?.message || error.message);
        }

        console.log('');

        // Test 5: Supprimer la promotion de test
        console.log('📝 Test 5: DELETE /pressings/promotions/:id');
        try {
          const deleteResponse = await axios.delete(`${BASE_URL}/pressings/promotions/${promotionId}`, { headers });
          console.log('✅ Succès:', deleteResponse.status, deleteResponse.data.success ? 'Success' : 'Failed');
          console.log('🗑️ Promotion supprimée');
        } catch (error) {
          console.log('❌ Erreur:', error.response?.status, error.response?.data?.message || error.message);
        }
      }
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('💥 Erreur générale:', error.message);
  }

  console.log('\n🎉 Tests terminés');
}

// Vérifier si le serveur est accessible
async function checkServer() {
  try {
    const response = await axios.get(`${BASE_URL}/pressings`, { timeout: 5000 });
    console.log('✅ Serveur accessible');
    return true;
  } catch (error) {
    console.log('❌ Serveur non accessible:', error.message);
    console.log('💡 Assurez-vous que le serveur backend est démarré sur le port 5002');
    return false;
  }
}

async function main() {
  console.log('🔍 Vérification de l\'accessibilité du serveur...');
  const serverOk = await checkServer();
  
  if (serverOk) {
    console.log('');
    await testPromotionEndpoints();
  }
}

if (require.main === module) {
  main();
}
