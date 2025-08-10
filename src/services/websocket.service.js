/**
 * Service WebSocket pour GeoPressCI
 * Gestion des connexions temps réel et notifications push
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const pushNotificationService = require('./pushNotification.service');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<userId, Set<WebSocket>>
    this.rooms = new Map(); // Map<roomId, Set<userId>>
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
    this.wss.on('error', this.handleError.bind(this));

    // Nettoyage périodique des connexions fermées
    setInterval(() => {
      this.cleanup();
    }, 30000); // Toutes les 30 secondes

    logger.info('Service WebSocket initialisé');
  }

  /**
   * Vérifier l'authentification du client WebSocket
   * @param {Object} info - Informations de connexion
   * @returns {boolean} - Autorisation de connexion
   */
  verifyClient(info) {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('Tentative de connexion WebSocket sans token');
        return false;
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      info.req.user = decoded;
      return true;

    } catch (error) {
      logger.warn('Token WebSocket invalide:', error.message);
      return false;
    }
  }

  /**
   * Gérer une nouvelle connexion WebSocket
   * @param {WebSocket} ws - Socket client
   * @param {Object} req - Requête HTTP
   */
  handleConnection(ws, req) {
    const user = req.user;
    const userId = user.id;

    logger.info(`Nouvelle connexion WebSocket: ${userId} (${user.role})`);

    // Ajouter le client à la map
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);

    // Configuration du socket
    ws.userId = userId;
    ws.userRole = user.role;
    ws.isAlive = true;

    // Envoyer un message de bienvenue
    this.sendToSocket(ws, {
      type: 'connection',
      message: 'Connexion WebSocket établie',
      timestamp: new Date().toISOString(),
      user: {
        id: userId,
        role: user.role
      }
    });

    // Gestionnaires d'événements
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnection(ws));
    ws.on('error', (error) => this.handleSocketError(ws, error));
    ws.on('pong', () => { ws.isAlive = true; });

    // Rejoindre les rooms appropriées selon le rôle
    this.joinDefaultRooms(userId, user.role);
  }

  /**
   * Gérer les messages reçus du client
   * @param {WebSocket} ws - Socket client
   * @param {Buffer} data - Données reçues
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      const userId = ws.userId;

      logger.debug(`Message WebSocket reçu de ${userId}:`, message);

      switch (message.type) {
        case 'ping':
          this.sendToSocket(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'join_room':
          this.joinRoom(userId, message.room);
          break;

        case 'leave_room':
          this.leaveRoom(userId, message.room);
          break;

        case 'subscribe_push':
          this.handlePushSubscription(userId, ws.userRole, message.subscription);
          break;

        case 'order_update':
          this.handleOrderUpdate(userId, message.data);
          break;

        default:
          logger.warn(`Type de message WebSocket non reconnu: ${message.type}`);
      }

    } catch (error) {
      logger.error('Erreur lors du traitement du message WebSocket:', error);
      this.sendToSocket(ws, {
        type: 'error',
        message: 'Erreur lors du traitement du message',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Gérer la déconnexion d'un client
   * @param {WebSocket} ws - Socket client
   */
  handleDisconnection(ws) {
    const userId = ws.userId;
    
    if (userId && this.clients.has(userId)) {
      this.clients.get(userId).delete(ws);
      
      // Supprimer l'utilisateur s'il n'a plus de connexions
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
        this.removeFromAllRooms(userId);
      }
    }

    logger.info(`Déconnexion WebSocket: ${userId}`);
  }

  /**
   * Gérer les erreurs de socket
   * @param {WebSocket} ws - Socket client
   * @param {Error} error - Erreur
   */
  handleSocketError(ws, error) {
    logger.error(`Erreur WebSocket pour ${ws.userId}:`, error);
  }

  /**
   * Gérer les erreurs du serveur WebSocket
   * @param {Error} error - Erreur
   */
  handleError(error) {
    logger.error('Erreur du serveur WebSocket:', error);
  }

  /**
   * Rejoindre les rooms par défaut selon le rôle
   * @param {string} userId - ID utilisateur
   * @param {string} role - Rôle utilisateur
   */
  joinDefaultRooms(userId, role) {
    // Room globale pour tous les utilisateurs
    this.joinRoom(userId, 'global');

    // Rooms spécifiques par rôle
    switch (role) {
      case 'client':
        this.joinRoom(userId, 'clients');
        this.joinRoom(userId, `client_${userId}`);
        break;

      case 'pressing':
        this.joinRoom(userId, 'pressings');
        this.joinRoom(userId, `pressing_${userId}`);
        break;

      case 'admin':
        this.joinRoom(userId, 'admins');
        this.joinRoom(userId, 'clients');
        this.joinRoom(userId, 'pressings');
        break;
    }
  }

  /**
   * Rejoindre une room
   * @param {string} userId - ID utilisateur
   * @param {string} roomId - ID de la room
   */
  joinRoom(userId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);
    
    logger.debug(`Utilisateur ${userId} a rejoint la room ${roomId}`);
  }

  /**
   * Quitter une room
   * @param {string} userId - ID utilisateur
   * @param {string} roomId - ID de la room
   */
  leaveRoom(userId, roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      
      // Supprimer la room si elle est vide
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    logger.debug(`Utilisateur ${userId} a quitté la room ${roomId}`);
  }

  /**
   * Supprimer un utilisateur de toutes les rooms
   * @param {string} userId - ID utilisateur
   */
  removeFromAllRooms(userId) {
    for (const [roomId, users] of this.rooms.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        
        // Supprimer la room si elle est vide
        if (users.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }
  }

  /**
   * Envoyer un message à un socket spécifique
   * @param {WebSocket} ws - Socket destinataire
   * @param {Object} message - Message à envoyer
   */
  sendToSocket(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Erreur lors de l\'envoi du message WebSocket:', error);
      }
    }
  }

  /**
   * Envoyer un message à un utilisateur spécifique
   * @param {string} userId - ID utilisateur
   * @param {Object} message - Message à envoyer
   */
  sendToUser(userId, message) {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      userSockets.forEach(ws => {
        this.sendToSocket(ws, message);
      });
      return true;
    }
    return false;
  }

  /**
   * Envoyer un message à tous les utilisateurs d'une room
   * @param {string} roomId - ID de la room
   * @param {Object} message - Message à envoyer
   * @param {string} excludeUserId - ID utilisateur à exclure (optionnel)
   */
  sendToRoom(roomId, message, excludeUserId = null) {
    const roomUsers = this.rooms.get(roomId);
    if (!roomUsers) return 0;

    let sentCount = 0;
    roomUsers.forEach(userId => {
      if (userId !== excludeUserId) {
        if (this.sendToUser(userId, message)) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Diffuser un message à tous les clients connectés
   * @param {Object} message - Message à diffuser
   * @param {string} excludeUserId - ID utilisateur à exclure (optionnel)
   */
  broadcast(message, excludeUserId = null) {
    return this.sendToRoom('global', message, excludeUserId);
  }

  /**
   * Gérer une subscription push via WebSocket
   * @param {string} userId - ID utilisateur
   * @param {string} userRole - Rôle utilisateur
   * @param {Object} subscription - Données de subscription
   */
  async handlePushSubscription(userId, userRole, subscription) {
    try {
      await pushNotificationService.saveSubscription(userId, userRole, subscription);
      
      this.sendToUser(userId, {
        type: 'push_subscription_success',
        message: 'Subscription push enregistrée avec succès',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de la subscription push:', error);
      
      this.sendToUser(userId, {
        type: 'push_subscription_error',
        message: 'Erreur lors de l\'enregistrement de la subscription push',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Gérer une mise à jour de commande
   * @param {string} userId - ID utilisateur
   * @param {Object} orderData - Données de la commande
   */
  handleOrderUpdate(userId, orderData) {
    // Notifier le pressing concerné
    if (orderData.pressingId) {
      this.sendToRoom(`pressing_${orderData.pressingId}`, {
        type: 'order_update',
        data: orderData,
        timestamp: new Date().toISOString()
      });
    }

    // Notifier le client concerné
    if (orderData.customerId) {
      this.sendToRoom(`client_${orderData.customerId}`, {
        type: 'order_update',
        data: orderData,
        timestamp: new Date().toISOString()
      });
    }

    // Notifier les admins
    this.sendToRoom('admins', {
      type: 'order_update',
      data: orderData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifier une nouvelle commande
   * @param {Object} order - Données de la commande
   * @param {Object} customer - Données du client
   * @param {Object} pressing - Données du pressing
   */
  notifyNewOrder(order, customer, pressing) {
    const notification = {
      type: 'new_order',
      data: {
        orderId: order._id,
        orderNumber: order.reference || order._id,
        customerName: `${customer.prenom} ${customer.nom}`,
        pressingName: pressing.nomCommerce,
        totalAmount: order.montantTotal,
        createdAt: order.createdAt
      },
      timestamp: new Date().toISOString()
    };

    // Notifier le pressing
    this.sendToUser(pressing._id.toString(), notification);
    
    // Notifier les admins
    this.sendToRoom('admins', notification);

    // Envoyer aussi une notification push au pressing
    pushNotificationService.sendTemplatedPush(
      'newOrder',
      pressing._id.toString(),
      { order, customer }
    ).catch(error => {
      logger.error('Erreur lors de l\'envoi de la notification push nouvelle commande:', error);
    });
  }

  /**
   * Notifier une mise à jour de statut de commande
   * @param {Object} order - Données de la commande
   * @param {string} previousStatus - Ancien statut
   */
  notifyOrderStatusUpdate(order, previousStatus) {
    const notification = {
      type: 'order_status_update',
      data: {
        orderId: order._id,
        orderNumber: order.reference || order._id,
        status: order.statut || order.status,
        previousStatus,
        updatedAt: order.updatedAt
      },
      timestamp: new Date().toISOString()
    };

    // Notifier le client
    if (order.customer) {
      this.sendToUser(order.customer.toString(), notification);
      
      // Envoyer une notification push au client
      pushNotificationService.sendTemplatedPush(
        'orderStatusUpdate',
        order.customer.toString(),
        { order, newStatus: order.statut || order.status }
      ).catch(error => {
        logger.error('Erreur lors de l\'envoi de la notification push mise à jour:', error);
      });
    }

    // Notifier le pressing
    if (order.pressing) {
      this.sendToUser(order.pressing.toString(), notification);
    }

    // Notifier les admins
    this.sendToRoom('admins', notification);
  }

  /**
   * Nettoyer les connexions fermées
   */
  cleanup() {
    if (!this.wss) return;

    this.wss.clients.forEach(ws => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      ws.ping();
    });

    // Nettoyer les clients déconnectés
    for (const [userId, sockets] of this.clients.entries()) {
      const activeSockets = new Set();
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          activeSockets.add(ws);
        }
      });
      
      if (activeSockets.size === 0) {
        this.clients.delete(userId);
        this.removeFromAllRooms(userId);
      } else {
        this.clients.set(userId, activeSockets);
      }
    }
  }

  /**
   * Obtenir les statistiques des connexions
   * @returns {Object} - Statistiques
   */
  getStats() {
    const stats = {
      totalConnections: this.wss ? this.wss.clients.size : 0,
      activeUsers: this.clients.size,
      rooms: this.rooms.size,
      roomDetails: {}
    };

    // Détails des rooms
    for (const [roomId, users] of this.rooms.entries()) {
      stats.roomDetails[roomId] = users.size;
    }

    return stats;
  }

  /**
   * Fermer le service WebSocket
   */
  close() {
    if (this.wss) {
      this.wss.close();
      logger.info('Service WebSocket fermé');
    }
  }
}

// Instance singleton
const websocketService = new WebSocketService();

module.exports = websocketService;
