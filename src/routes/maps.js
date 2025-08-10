const express = require('express');
const { getDirections, reverseGeocode } = require('../controllers/mapsController');

const router = express.Router();

// Routes pour les fonctionnalités de cartographie
router.get('/directions', getDirections);
router.get('/reverse-geocode', reverseGeocode);

module.exports = router;
