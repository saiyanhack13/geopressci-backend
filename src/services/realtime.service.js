/**
 * Service de notifications temps réel avec WebSocket
 * Optimisé pour GeoPressCI - Gestion des commandes en temps réel
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const notificationService = require('./notification.service');

class RealtimeService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<userId, WebSocket>
    this.pressingClients = new Map(); // Map<pressingId, WebSocket>
    this.adminClients = new Set(); // Set<WebSocket>
    this.heartbeatInterval = null;
  }

  /**
   * Initialiser le serveur WebSocket
   * @param {Object} server - Serveur HTTP
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();

    logger.info('🔴 Service de notifications temps réel initialisé');
  }

  /**
   * Vérifier l'authentification du client WebSocket
   */
  verifyClient(info) {
    try {
      const token = new URL(info.req.url, 'http://localhost').searchParams.get('token');
      if (!token) return false;

      const decoded = jwt.verify(token, config.JWT_SECRET);
      info.req.user = decoded;
      return true;
    } catch (error) {
      logger.warn('❌ Authentification WebSocket échouée:', error.message);
      return false;
    }
  }

  /**
   * Gérer une nouvelle connexion WebSocket
   */
  handleConnection(ws, req) {
    const user = req.user;
    logger.info(`🟢 Nouvelle connexion WebSocket: ${user.id} (${user.role})`);

    // Stocker la connexion selon le rôle
    this.storeConnection(ws, user);

    // Configurer les événements
    ws.on('message', (data) => this.handleMessage(ws, user, data));
    ws.on('close', () => this.handleDisconnection(ws, user));
    ws.on('error', (error) => logger.error('❌ Erreur WebSocket:', error));

    // Envoyer confirmation de connexion
    this.sendToClient(ws, {
      type: 'connection_established',
      data: {
        userId: user.id,
        role: user.role,
        timestamp: new Date().toISOString()
      }
    });

    // Envoyer les notifications non lues
    this.sendUnreadNotifications(ws, user);
  }

  /**
   * Stocker la connexion selon le rôle utilisateur
   */
  storeConnection(ws, user) {
    ws.userId = user.id;
    ws.userRole = user.role;
    ws.isAlive = true;

    switch (user.role) {
      case 'pressing':
        this.pressingClients.set(user.id, ws);
        break;
      case 'admin':
        this.adminClients.add(ws);
        break;
      case 'client':
      default:
        this.clients.set(user.id, ws);
        break;
    }
  }

  /**
   * Gérer les messages reçus du client
   */
  handleMessage(ws, user, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ping':
          ws.isAlive = true;
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        case 'mark_notification_read':
          this.handleMarkNotificationRead(user.id, message.notificationId);
          break;
          
        case 'subscribe_order_updates':
          ws.subscribedOrders = message.orderIds || [];
          break;
          
        default:
          logger.warn('❓ Type de message WebSocket inconnu:', message.type);
      }
    } catch (error) {
      logger.error('❌ Erreur traitement message WebSocket:', error);
    }
  }

  /**
   * Gérer la déconnexion d'un client
   */
  handleDisconnection(ws, user) {
    logger.info(`🔴 Déconnexion WebSocket: ${user.id} (${user.role})`);

    // Supprimer la connexion des maps
    switch (user.role) {
      case 'pressing':
        this.pressingClients.delete(user.id);
        break;
      case 'admin':
        this.adminClients.delete(ws);
        break;
      case 'client':
      default:
        this.clients.delete(user.id);
        break;
    }
  }

  /**
   * Envoyer un message à un client spécifique
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Envoyer les notifications non lues à un client
   */
  async sendUnreadNotifications(ws, user) {
    try {
      const notifications = await notificationService.getUserNotifications(user.id, {
        isRead: false,
        limit: 10
      });

      if (notifications.length > 0) {
        this.sendToClient(ws, {
          type: 'unread_notifications',
          data: notifications
        });
      }
    } catch (error) {
      logger.error('❌ Erreur envoi notifications non lues:', error);
    }
  }

  /**
   * Marquer une notification comme lue
   */
  async handleMarkNotificationRead(userId, notificationId) {
    try {
      await notificationService.markNotificationAsRead(notificationId, userId);
      
      // Notifier le client que la notification a été marquée comme lue
      const ws = this.clients.get(userId) || this.pressingClients.get(userId);
      if (ws) {
        this.sendToClient(ws, {
          type: 'notification_marked_read',
          data: { notificationId }
        });
      }
    } catch (error) {
      logger.error('❌ Erreur marquage notification lue:', error);
    }
  }

  /**
   * Notifier une nouvelle commande en temps réel
   */
  notifyNewOrder(order, customer, pressing) {
    // Notifier le pressing
    const pressingWs = this.pressingClients.get(pressing._id.toString());
    if (pressingWs) {
      this.sendToClient(pressingWs, {
        type: 'new_order',
        data: {
          order: {
            id: order._id,
            orderNumber: order.reference,
            customerName: customer.prenom + ' ' + customer.nom,
            customerPhone: customer.telephone,
            totalAmount: order.montantTotal,
            status: order.statut,
            createdAt: order.createdAt,
            items: order.services
          },
          customer: {
            id: customer._id,
            name: customer.prenom + ' ' + customer.nom,
            phone: customer.telephone
          }
        }
      });
    }

    // Notifier le client
    const clientWs = this.clients.get(customer._id.toString());
    if (clientWs) {
      this.sendToClient(clientWs, {
        type: 'order_confirmation',
        data: {
          orderId: order._id,
          orderNumber: order.reference,
          pressingName: pressing.nom,
          totalAmount: order.montantTotal,
          status: order.statut
        }
      });
    }

    // Notifier les admins
    this.adminClients.forEach(ws => {
      this.sendToClient(ws, {
        type: 'admin_new_order',
        data: {
          orderId: order._id,
          pressingName: pressing.nom,
          customerName: customer.prenom + ' ' + customer.nom,
          totalAmount: order.montantTotal
        }
      });
    });

    logger.info(`📦 Notification temps réel nouvelle commande: ${order._id}`);
  }

  /**
   * Notifier la mise à jour du statut d'une commande
   */
  notifyOrderStatusUpdate(order, previousStatus, customer, pressing) {
    const statusUpdate = {
      orderId: order._id,
      orderNumber: order.reference,
      previousStatus,
      newStatus: order.statut,
      updatedAt: new Date().toISOString()
    };

    // Notifier le client
    const clientWs = this.clients.get(customer._id.toString());
    if (clientWs) {
      this.sendToClient(clientWs, {
        type: 'order_status_update',
        data: {
          ...statusUpdate,
          pressingName: pressing.nom,
          message: this.getStatusUpdateMessage(order.statut)
        }
      });
    }

    // Notifier le pressing
    const pressingWs = this.pressingClients.get(pressing._id.toString());
    if (pressingWs) {
      this.sendToClient(pressingWs, {
        type: 'order_updated',
        data: {
          ...statusUpdate,
          customerName: customer.prenom + ' ' + customer.nom
        }
      });
    }

    logger.info(`🔄 Notification temps réel mise à jour commande: ${order._id} (${previousStatus} → ${order.statut})`);
  }

  /**
   * Obtenir le message de mise à jour de statut
   */
  getStatusUpdateMessage(status) {
    const messages = {
      'confirmee': 'Votre commande a été confirmée par le pressing',
      'en_cours': 'Votre commande est en cours de traitement',
      'prete': 'Votre commande est prête pour la livraison',
      'livree': 'Votre commande a été livrée avec succès',
      'annulee': 'Votre commande a été annulée'
    };
    return messages[status] || 'Le statut de votre commande a été mis à jour';
  }

  /**
   * Diffuser une notification à tous les clients d'un type
   */
  broadcast(type, message, data) {
    const notification = {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    // Diffuser selon le type
    switch (type) {
      case 'pressing':
        this.pressingClients.forEach(ws => this.sendToClient(ws, notification));
        break;
      case 'client':
        this.clients.forEach(ws => this.sendToClient(ws, notification));
        break;
      case 'admin':
        this.adminClients.forEach(ws => this.sendToClient(ws, notification));
        break;
      case 'all':
        [...this.clients.values(), ...this.pressingClients.values(), ...this.adminClients].forEach(ws => {
          this.sendToClient(ws, notification);
        });
        break;
    }
  }

  /**
   * Système de heartbeat pour maintenir les connexions
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }
        
        ws.isAlive = false;
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // 30 secondes

    logger.info('💓 Heartbeat WebSocket démarré (30s)');
  }

  /**
   * Arrêter le service
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    logger.info('🔴 Service de notifications temps réel arrêté');
  }

  /**
   * Obtenir les statistiques de connexion
   */
  getStats() {
    return {
      totalConnections: this.wss ? this.wss.clients.size : 0,
      clientConnections: this.clients.size,
      pressingConnections: this.pressingClients.size,
      adminConnections: this.adminClients.size,
      uptime: process.uptime()
    };
  }
}

// Instance singleton
const realtimeService = new RealtimeService();

module.exports = realtimeService;
