const clientPdfService = require('../services/clientPdfService');
const Client = require('../models/client.model');
const Order = require('../models/order.model');
const path = require('path');
const fs = require('fs');

/**
 * Calcule les statistiques personnelles d'un client
 */
const calculateClientStats = (orders) => {
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      averageRating: 0,
      satisfactionRate: 0,
      favoritePressing: null,
      topPressings: [],
      monthlyOrders: []
    };
  }

  const completedOrders = orders.filter(order => order.status === 'livree');
  const cancelledOrders = orders.filter(order => order.status === 'annulee');
  const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  
  // Calcul de la note moyenne
  const ratedOrders = orders.filter(order => order.rating && order.rating > 0);
  const averageRating = ratedOrders.length > 0 
    ? ratedOrders.reduce((sum, order) => sum + order.rating, 0) / ratedOrders.length 
    : 0;

  // Calcul du taux de satisfaction (commandes notées >= 4/5)
  const satisfiedOrders = ratedOrders.filter(order => order.rating >= 4);
  const satisfactionRate = ratedOrders.length > 0 
    ? Math.round((satisfiedOrders.length / ratedOrders.length) * 100) 
    : 0;

  // Pressings favoris
  const pressingStats = {};
  orders.forEach(order => {
    if (order.pressingName) {
      if (!pressingStats[order.pressingName]) {
        pressingStats[order.pressingName] = {
          name: order.pressingName,
          orderCount: 0,
          totalSpent: 0,
          ratings: []
        };
      }
      pressingStats[order.pressingName].orderCount++;
      pressingStats[order.pressingName].totalSpent += order.totalAmount || 0;
      if (order.rating) {
        pressingStats[order.pressingName].ratings.push(order.rating);
      }
    }
  });

  // Tri des pressings par nombre de commandes
  const topPressings = Object.values(pressingStats)
    .map(pressing => ({
      ...pressing,
      averageRating: pressing.ratings.length > 0 
        ? pressing.ratings.reduce((sum, rating) => sum + rating, 0) / pressing.ratings.length 
        : 0
    }))
    .sort((a, b) => b.orderCount - a.orderCount);

  const favoritePressing = topPressings.length > 0 ? topPressings[0].name : null;

  return {
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    cancelledOrders: cancelledOrders.length,
    totalSpent,
    averageOrderValue: orders.length > 0 ? totalSpent / orders.length : 0,
    averageRating: Math.round(averageRating * 10) / 10,
    satisfactionRate,
    favoritePressing,
    topPressings: topPressings.slice(0, 5),
    monthlyOrders: calculateMonthlyOrders(orders)
  };
};

/**
 * Calcule les commandes par mois pour les 6 derniers mois
 */
const calculateMonthlyOrders = (orders) => {
  const months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    const count = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate.getMonth() === date.getMonth() && 
             orderDate.getFullYear() === date.getFullYear();
    }).length;
    
    months.push({ name: monthName, count });
  }
  
  return months;
};

/**
 * Récupère les statistiques personnelles d'un client
 * GET /api/v1/clients/stats
 */
const getClientStats = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Récupération des commandes du client
    const orders = await Order.find({ customer: clientId })
      .populate('pressing', 'nomCommerce')
      .sort({ createdAt: -1 });

    // Ajout du nom du pressing dans les commandes
    const ordersWithPressingName = orders.map(order => ({
      ...order.toObject(),
      pressingName: order.pressing?.nomCommerce || 'Pressing inconnu'
    }));

    // Calcul des statistiques
    const stats = calculateClientStats(ordersWithPressingName);

    res.json({
      success: true,
      stats,
      ordersCount: orders.length
    });

  } catch (error) {
    console.error('Erreur lors du calcul des statistiques client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul des statistiques',
      error: error.message
    });
  }
};

/**
 * Génère et télécharge un PDF des statistiques personnelles
 * POST /api/v1/clients/export-stats-pdf
 */
const exportStatsPDF = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Récupération des données du client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Récupération des commandes du client
    const orders = await Order.find({ customer: clientId })
      .populate('pressing', 'nomCommerce')
      .sort({ createdAt: -1 });

    // Ajout du nom du pressing dans les commandes
    const ordersWithPressingName = orders.map(order => ({
      ...order.toObject(),
      pressingName: order.pressing?.nomCommerce || 'Pressing inconnu'
    }));

    // Calcul des statistiques
    const stats = calculateClientStats(ordersWithPressingName);

    // Génération du PDF
    const pdfPath = await clientPdfService.generateClientStatsPDF(
      client,
      ordersWithPressingName,
      stats
    );

    // Vérification que le fichier existe
    if (!fs.existsSync(pdfPath)) {
      throw new Error('Erreur lors de la génération du PDF');
    }

    // Configuration des headers pour le téléchargement
    const filename = `statistiques-${client.prenom}-${client.nom}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(pdfPath).size);

    // Stream du fichier vers la réponse
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // Suppression du fichier temporaire après envoi
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        } catch (error) {
          console.error('Erreur lors de la suppression du fichier temporaire:', error);
        }
      }, 1000);
    });

  } catch (error) {
    console.error('Erreur lors de l\'export PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du PDF',
      error: error.message
    });
  }
};

/**
 * Exporte les données client en JSON
 * GET /api/v1/clients/export-data-json
 */
const exportDataJSON = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Récupération des données du client
    const client = await Client.findById(clientId).select('-password');
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Récupération des commandes du client
    const orders = await Order.find({ customer: clientId })
      .populate('pressing', 'nomCommerce adresse telephone')
      .sort({ createdAt: -1 });

    // Ajout du nom du pressing dans les commandes
    const ordersWithPressingName = orders.map(order => ({
      ...order.toObject(),
      pressingName: order.pressing?.nomCommerce || 'Pressing inconnu'
    }));

    // Calcul des statistiques
    const stats = calculateClientStats(ordersWithPressingName);

    // Données complètes à exporter
    const exportData = {
      client: client.toObject(),
      statistics: stats,
      orders: ordersWithPressingName,
      exportDate: new Date().toISOString(),
      totalRecords: {
        orders: orders.length,
        completedOrders: stats.completedOrders,
        totalSpent: stats.totalSpent
      }
    };

    // Configuration des headers pour le téléchargement JSON
    const filename = `donnees-${client.prenom}-${client.nom}-${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);

  } catch (error) {
    console.error('Erreur lors de l\'export JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export des données',
      error: error.message
    });
  }
};

/**
 * Nettoyage périodique des anciens fichiers PDF
 */
const cleanupPDFs = async (req, res) => {
  try {
    await clientPdfService.cleanupOldPDFs();
    res.json({
      success: true,
      message: 'Nettoyage des anciens PDFs effectué'
    });
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du nettoyage',
      error: error.message
    });
  }
};

module.exports = {
  getClientStats,
  exportStatsPDF,
  exportDataJSON,
  cleanupPDFs,
  calculateClientStats
};
