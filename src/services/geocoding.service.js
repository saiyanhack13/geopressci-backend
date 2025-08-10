const axios = require('axios');
const config = require('../config/config');
const mapboxService = require('./mapbox.service');

/**
 * Convertit une adresse en coordonnées géographiques (géocodage) - Utilise Mapbox
 * @param {string} address - Adresse à géocoder
 * @returns {Promise<{lat: number, lng: number} | null>} Coordonnées géographiques ou null en cas d'erreur
 */
const getGeocode = async (address) => {
  try {
    console.log('🗺️ Géocodage Mapbox pour:', address);
    
    // Utiliser le service Mapbox au lieu de Google Maps
    const result = await mapboxService.geocodeAddress(address, {
      country: 'ci', // Côte d'Ivoire
      proximity: '-4.01,5.36', // Abidjan
      language: 'fr'
    });

    if (result.success && result.data) {
      const { latitude, longitude } = result.data;
      console.log('✅ Géocodage Mapbox réussi:', { lat: latitude, lng: longitude });
      return { lat: latitude, lng: longitude };
    } else {
      console.error('❌ Erreur géocodage Mapbox:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur lors du géocodage Mapbox:', error.message);
    return null;
  }
};

/**
 * Convertit des coordonnées en adresse (géocodage inverse) - Utilise Mapbox
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string | null>} Adresse ou null en cas d'erreur
 */
const getReverseGeocode = async (lat, lng) => {
  try {
    console.log('🗺️ Géocodage inverse Mapbox pour:', { lat, lng });
    
    const result = await mapboxService.reverseGeocode(lat, lng, {
      language: 'fr'
    });

    if (result.success && result.data) {
      console.log('✅ Géocodage inverse Mapbox réussi:', result.data.address);
      return result.data.address;
    } else {
      console.error('❌ Erreur géocodage inverse Mapbox:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur lors du géocodage inverse Mapbox:', error.message);
    return null;
  }
};

/**
 * Calcule la distance en kilomètres entre deux points géographiques (formule de la Haversine)
 * @param {number} lat1 - Latitude du premier point
 * @param {number} lon1 - Longitude du premier point
 * @param {number} lat2 - Latitude du deuxième point
 * @param {number} lon2 - Longitude du deuxième point
 * @returns {number} Distance en kilomètres
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

// Convertit les degrés en radians
const toRad = (value) => {
  return (value * Math.PI) / 180;
};

module.exports = {
  getGeocode,
  getReverseGeocode,
  calculateDistance,
};
