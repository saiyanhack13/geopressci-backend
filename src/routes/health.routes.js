const express = require('express');
const mongoose = require('mongoose');
const config = require('../config/config');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check server and database health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 server:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "running"
 *                     environment:
 *                       type: string
 *                       example: "production"
 *                     port:
 *                       type: number
 *                       example: 5000
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "connected"
 *                     name:
 *                       type: string
 *                       example: "geopressci"
 *       503:
 *         description: Server is unhealthy
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        status: 'running',
        environment: config.env,
        port: config.port,
        uptime: process.uptime()
      },
      database: {
        status: 'disconnected',
        name: null,
        host: null
      }
    };

    // Check database connection
    if (mongoose.connection.readyState === 1) {
      health.database = {
        status: 'connected',
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        readyState: mongoose.connection.readyState
      };
    } else if (mongoose.connection.readyState === 2) {
      health.database.status = 'connecting';
      health.status = 'degraded';
    } else if (mongoose.connection.readyState === 3) {
      health.database.status = 'disconnecting';
      health.status = 'degraded';
    } else {
      health.database.status = 'disconnected';
      health.status = 'degraded';
    }

    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      server: {
        status: 'error',
        environment: config.env,
        port: config.port
      },
      database: {
        status: 'unknown'
      }
    });
  }
});

/**
 * @swagger
 * /ping:
 *   get:
 *     summary: Simple ping endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Pong response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "pong"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/ping', (req, res) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
