/**
 * Service Mapbox pour géolocalisation et routage
 * Remplace Google Maps pour une meilleure précision en Afrique de l'Ouest
 */

const axios = require('axios');
const config = require('../config/config');

class MapboxService {
  constructor() {
    this.accessToken = config.mapbox.accessToken;
    this.baseUrl = 'https://api.mapbox.com';
    
    if (!this.accessToken) {
      console.warn('⚠️  MAPBOX_ACCESS_TOKEN non définie - les fonctionnalités de géolocalisation ne fonctionneront pas');
    }
  }

  /**
   * Géocodage : Convertir une adresse en coordonnées
   * @param {string} address - Adresse à géocoder
   * @param {object} options - Options de géocodage
   * @returns {Promise<object>} Coordonnées et informations
   */
  async geocodeAddress(address, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('Token Mapbox non configuré');
      }

      const {
        country = 'ci', // Côte d'Ivoire par défaut
        proximity = '-4.01,5.36', // Abidjan par défaut
        language = 'fr',
        limit = 5
      } = options;

      const encodedAddress = encodeURIComponent(address);
      const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${encodedAddress}.json`;
      
      const response = await axios.get(url, {
        params: {
          access_token: this.accessToken,
          country,
          proximity,
          language,
          limit
        },
        timeout: 10000
      });

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        const [longitude, latitude] = feature.center;
        
        return {
          success: true,
          data: {
            latitude,
            longitude,
            address: feature.place_name,
            confidence: feature.relevance || 1,
            components: {
              country: feature.context?.find(c => c.id.includes('country'))?.text,
              region: feature.context?.find(c => c.id.includes('region'))?.text,
              district: feature.context?.find(c => c.id.includes('district'))?.text,
              place: feature.context?.find(c => c.id.includes('place'))?.text
            }
          }
        };
      } else {
        return {
          success: false,
          error: 'Aucun résultat trouvé pour cette adresse'
        };
      }
    } catch (error) {
      console.error('Erreur géocodage Mapbox:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Géocodage inverse : Convertir des coordonnées en adresse
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {object} options - Options
   * @returns {Promise<object>} Adresse et informations
   */
  async reverseGeocode(latitude, longitude, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('Token Mapbox non configuré');
      }

      const {
        language = 'fr',
        types = 'address'
      } = options;

      const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${longitude},${latitude}.json`;
      
      const response = await axios.get(url, {
        params: {
          access_token: this.accessToken,
          language,
          types
        },
        timeout: 10000
      });

      if (response.data.features && response.data.features.length > 0) {
        const feature = response.data.features[0];
        
        return {
          success: true,
          data: {
            address: feature.place_name,
            components: {
              country: feature.context?.find(c => c.id.includes('country'))?.text,
              region: feature.context?.find(c => c.id.includes('region'))?.text,
              district: feature.context?.find(c => c.id.includes('district'))?.text,
              place: feature.context?.find(c => c.id.includes('place'))?.text,
              neighborhood: feature.context?.find(c => c.id.includes('neighborhood'))?.text
            }
          }
        };
      } else {
        return {
          success: false,
          error: 'Aucune adresse trouvée pour ces coordonnées'
        };
      }
    } catch (error) {
      console.error('Erreur géocodage inverse Mapbox:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcul d'itinéraire entre deux points
   * @param {object} origin - Point de départ {latitude, longitude}
   * @param {object} destination - Point d'arrivée {latitude, longitude}
   * @param {object} options - Options de routage
   * @returns {Promise<object>} Itinéraire et informations
   */
  async getDirections(origin, destination, options = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('Token Mapbox non configuré');
      }

      const {
        profile = 'driving', // driving, walking, cycling
        geometries = 'geojson',
        overview = 'full',
        steps = true,
        language = 'fr'
      } = options;

      const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      const url = `${this.baseUrl}/directions/v5/mapbox/${profile}/${coordinates}`;
      
      const response = await axios.get(url, {
        params: {
          access_token: this.accessToken,
          geometries,
          overview,
          steps,
          language
        },
        timeout: 15000
      });

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        
        return {
          success: true,
          data: {
            distance: Math.round(route.distance), // en mètres
            duration: Math.round(route.duration), // en secondes
            geometry: route.geometry,
            steps: route.legs[0]?.steps || [],
            summary: {
              distance_km: (route.distance / 1000).toFixed(1),
              duration_minutes: Math.round(route.duration / 60),
              duration_text: this.formatDuration(route.duration)
            }
          }
        };
      } else {
        return {
          success: false,
          error: 'Aucun itinéraire trouvé'
        };
      }
    } catch (error) {
      console.error('Erreur directions Mapbox:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcul de distance à vol d'oiseau entre deux points
   * @param {object} point1 - Premier point {latitude, longitude}
   * @param {object} point2 - Deuxième point {latitude, longitude}
   * @returns {number} Distance en mètres
   */
  calculateDistance(point1, point2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance en mètres
  }

  /**
   * Formate une durée en secondes en texte lisible
   * @param {number} seconds - Durée en secondes
   * @returns {string} Durée formatée
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  /**
   * Génère une URL pour une carte statique Mapbox
   * @param {object} center - Centre de la carte {latitude, longitude}
   * @param {object} options - Options de la carte
   * @returns {string} URL de la carte statique
   */
  generateStaticMapUrl(center, options = {}) {
    if (!this.accessToken) {
      return null;
    }

    const {
      zoom = 15,
      width = 600,
      height = 400,
      style = 'streets-v12',
      markers = []
    } = options;

    let markerString = '';
    if (markers.length > 0) {
      const markerParams = markers.map(marker => 
        `pin-s+${marker.color || 'ff0000'}(${marker.longitude},${marker.latitude})`
      ).join(',');
      markerString = `/${markerParams}`;
    }

    return `${this.baseUrl}/styles/v1/mapbox/${style}/static${markerString}/${center.longitude},${center.latitude},${zoom}/${width}x${height}?access_token=${this.accessToken}`;
  }
}

module.exports = new MapboxService();
