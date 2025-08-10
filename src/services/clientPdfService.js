const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ClientPdfService {
  constructor() {
    this.ensureUploadsDirectory();
  }

  ensureUploadsDirectory() {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  /**
   * Génère un PDF des statistiques personnelles du client
   * @param {Object} clientData - Données du client
   * @param {Array} orders - Commandes du client
   * @param {Object} stats - Statistiques calculées
   * @returns {Promise<string>} - Chemin vers le fichier PDF généré
   */
  async generateClientStatsPDF(clientData, orders, stats) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filename = `client-stats-${clientData._id}-${Date.now()}.pdf`;
        const filepath = path.join(__dirname, '../../uploads', filename);

        // Stream vers le fichier
        doc.pipe(fs.createWriteStream(filepath));

        // En-tête du document
        this.addHeader(doc, clientData);
        
        // Statistiques principales
        this.addMainStats(doc, stats);
        
        // Graphique des commandes par mois (textuel)
        this.addMonthlyOrdersChart(doc, orders);
        
        // Historique des commandes
        this.addOrdersHistory(doc, orders);
        
        // Pressings favoris
        this.addFavoritePressings(doc, stats);
        
        // Pied de page
        this.addFooter(doc);

        doc.end();

        doc.on('end', () => {
          resolve(filepath);
        });

        doc.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  addHeader(doc, clientData) {
    // Logo et titre
    doc.fontSize(24)
       .fillColor('#2563eb')
       .text('GeoPressCI', 50, 50)
       .fontSize(18)
       .fillColor('#374151')
       .text('Rapport Personnel - Statistiques Client', 50, 80);

    // Informations client
    doc.fontSize(12)
       .fillColor('#6b7280')
       .text(`Client: ${clientData.prenom} ${clientData.nom}`, 50, 110)
       .text(`Email: ${clientData.email}`, 50, 125)
       .text(`Téléphone: ${clientData.telephone}`, 50, 140)
       .text(`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`, 50, 155);

    // Ligne de séparation
    doc.moveTo(50, 180)
       .lineTo(550, 180)
       .stroke('#e5e7eb');

    return doc;
  }

  addMainStats(doc, stats) {
    const startY = 200;
    
    doc.fontSize(16)
       .fillColor('#374151')
       .text('📊 Statistiques Principales', 50, startY);

    const statsData = [
      { label: 'Total des commandes', value: stats.totalOrders, icon: '📦' },
      { label: 'Commandes livrées', value: stats.completedOrders, icon: '✅' },
      { label: 'Montant total dépensé', value: `${stats.totalSpent.toLocaleString('fr-FR')} FCFA`, icon: '💰' },
      { label: 'Pressing favori', value: stats.favoritePressing || 'Aucun', icon: '⭐' },
      { label: 'Note moyenne', value: `${stats.averageRating}/5`, icon: '🌟' },
      { label: 'Taux de satisfaction', value: `${stats.satisfactionRate}%`, icon: '😊' }
    ];

    let currentY = startY + 30;
    statsData.forEach((stat, index) => {
      if (index % 2 === 0 && index > 0) {
        currentY += 25;
      }
      
      const x = index % 2 === 0 ? 50 : 300;
      
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text(`${stat.icon} ${stat.label}:`, x, currentY)
         .fontSize(12)
         .fillColor('#374151')
         .text(stat.value.toString(), x, currentY + 12);
    });

    return currentY + 40;
  }

  addMonthlyOrdersChart(doc, orders) {
    const startY = 350;
    
    doc.fontSize(16)
       .fillColor('#374151')
       .text('📈 Évolution des Commandes (6 derniers mois)', 50, startY);

    // Calculer les commandes par mois
    const monthlyData = this.calculateMonthlyOrders(orders);
    
    let currentY = startY + 30;
    monthlyData.forEach(month => {
      const barWidth = Math.max(month.count * 20, 10);
      
      // Barre graphique simple
      doc.rect(50, currentY, barWidth, 15)
         .fill('#3b82f6');
      
      // Texte
      doc.fontSize(10)
         .fillColor('#374151')
         .text(`${month.name}: ${month.count} commandes`, barWidth + 60, currentY + 3);
      
      currentY += 25;
    });

    return currentY + 20;
  }

  addOrdersHistory(doc, orders) {
    const startY = 520;
    
    doc.fontSize(16)
       .fillColor('#374151')
       .text('📋 Historique des Commandes Récentes', 50, startY);

    // Prendre les 10 dernières commandes
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    let currentY = startY + 30;
    
    // En-têtes du tableau
    doc.fontSize(10)
       .fillColor('#6b7280')
       .text('N° Commande', 50, currentY)
       .text('Date', 150, currentY)
       .text('Pressing', 220, currentY)
       .text('Statut', 350, currentY)
       .text('Montant', 450, currentY);

    currentY += 20;

    // Ligne de séparation
    doc.moveTo(50, currentY)
       .lineTo(550, currentY)
       .stroke('#e5e7eb');

    currentY += 10;

    recentOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleDateString('fr-FR');
      const status = this.getStatusLabel(order.status);
      const amount = `${order.totalAmount.toLocaleString('fr-FR')} FCFA`;

      doc.fontSize(9)
         .fillColor('#374151')
         .text(order.orderNumber || order._id.toString().slice(-6), 50, currentY)
         .text(date, 150, currentY)
         .text((order.pressingName || 'N/A').substring(0, 20), 220, currentY)
         .text(status, 350, currentY)
         .text(amount, 450, currentY);

      currentY += 15;

      // Nouvelle page si nécessaire
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }
    });

    return currentY + 20;
  }

  addFavoritePressings(doc, stats) {
    if (doc.y > 700) {
      doc.addPage();
    }

    const startY = doc.y + 20;
    
    doc.fontSize(16)
       .fillColor('#374151')
       .text('⭐ Pressings Favoris', 50, startY);

    if (stats.topPressings && stats.topPressings.length > 0) {
      let currentY = startY + 30;
      
      stats.topPressings.slice(0, 5).forEach((pressing, index) => {
        doc.fontSize(12)
           .fillColor('#374151')
           .text(`${index + 1}. ${pressing.name}`, 70, currentY)
           .fontSize(10)
           .fillColor('#6b7280')
           .text(`${pressing.orderCount} commandes - Note: ${pressing.averageRating}/5`, 70, currentY + 15);
        
        currentY += 35;
      });
    } else {
      doc.fontSize(12)
         .fillColor('#6b7280')
         .text('Aucun pressing favori pour le moment', 70, startY + 30);
    }
  }

  addFooter(doc) {
    const pageHeight = doc.page.height;
    
    doc.fontSize(8)
       .fillColor('#9ca3af')
       .text('GeoPressCI - Service de pressing à domicile', 50, pageHeight - 50)
       .text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 50, pageHeight - 35)
       .text('Ce rapport est confidentiel et destiné uniquement au client concerné.', 50, pageHeight - 20);
  }

  calculateMonthlyOrders(orders) {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      
      const count = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === date.getMonth() && 
               orderDate.getFullYear() === date.getFullYear();
      }).length;
      
      months.push({ name: monthName, count });
    }
    
    return months;
  }

  getStatusLabel(status) {
    const statusMap = {
      'en_attente': 'En attente',
      'confirmee': 'Confirmée',
      'en_cours': 'En cours',
      'prete': 'Prête',
      'en_livraison': 'En livraison',
      'livree': 'Livrée',
      'annulee': 'Annulée'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Supprime les anciens fichiers PDF (plus de 24h)
   */
  async cleanupOldPDFs() {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 heures

      files.forEach(file => {
        if (file.startsWith('client-stats-') && file.endsWith('.pdf')) {
          const filepath = path.join(uploadsDir, file);
          const stats = fs.statSync(filepath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filepath);
            console.log(`Ancien PDF supprimé: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('Erreur lors du nettoyage des PDFs:', error);
    }
  }
}

module.exports = new ClientPdfService();
