const axios = require('axios');
const config = require('../config/config');

/**
 * Convertit une adresse en coordonnées géographiques (géocodage)
 * @param {string} address - Adresse à géocoder
 * @returns {Promise<{lat: number, lng: number} | null>} Coordonnées géographiques ou null en cas d'erreur
 */
const getGeocode = async (address) => {
  try {
    if (!config.googleMaps.apiKey) {
      console.warn('Aucune clé API Google Maps fournie, le géocodage ne fonctionnera pas');
      return null;
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: config.googleMaps.apiKey,
          region: 'ci', // Côte d'Ivoire
          components: 'country:CI', // Côte d'Ivoire
        },
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng };
    } else {
      console.error('Erreur de géocodage:', response.data.status, response.data.error_message || '');
      return null;
    }
  } catch (error) {
    console.error('Erreur lors du géocodage:', error.message);
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
  calculateDistance,
};
