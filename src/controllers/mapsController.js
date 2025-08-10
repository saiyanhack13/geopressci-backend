const axios = require('axios');
const polyline = require('@mapbox/polyline');
const mapboxService = require('../services/mapbox.service');

/**
 * @desc    Get directions from Mapbox API (remplace Google Maps)
 * @route   GET /api/maps/directions
 * @access  Public
 */
exports.getDirections = async (req, res) => {
  try {
    console.log('🗺️ Received Mapbox directions request:', req.query);
    
    const { origin, destination, mode = 'driving' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required'
      });
    }

    // Parser les coordonnées depuis les paramètres
    let originCoords, destinationCoords;
    
    try {
      // Format attendu: "lat,lng" ou objet avec lat/lng
      if (typeof origin === 'string' && origin.includes(',')) {
        const [lat, lng] = origin.split(',').map(Number);
        originCoords = { latitude: lat, longitude: lng };
      } else {
        const parsed = typeof origin === 'string' ? JSON.parse(origin) : origin;
        originCoords = { latitude: parsed.lat || parsed.latitude, longitude: parsed.lng || parsed.longitude };
      }
      
      if (typeof destination === 'string' && destination.includes(',')) {
        const [lat, lng] = destination.split(',').map(Number);
        destinationCoords = { latitude: lat, longitude: lng };
      } else {
        const parsed = typeof destination === 'string' ? JSON.parse(destination) : destination;
        destinationCoords = { latitude: parsed.lat || parsed.latitude, longitude: parsed.lng || parsed.longitude };
      }
    } catch (parseError) {
      console.error('Erreur parsing coordonnées:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Format de coordonnées invalide. Utilisez "lat,lng" ou {"lat": x, "lng": y}'
      });
    }

    console.log('🗺️ Calling Mapbox API with:', { 
      origin: originCoords, 
      destination: destinationCoords, 
      mode 
    });
    
    // Utiliser le service Mapbox
    const mapboxResult = await mapboxService.getDirections(
      originCoords,
      destinationCoords,
      { profile: mode === 'walking' ? 'walking' : 'driving' }
    );

    if (!mapboxResult.success) {
      console.error('Erreur Mapbox API:', mapboxResult.error);
      return res.status(400).json({
        success: false,
        message: mapboxResult.error || 'Erreur lors du calcul de l\'itinéraire'
      });
    }

    const routeData = mapboxResult.data;
    
    // Formater la réponse pour compatibilité avec l'ancien format Google Maps
    const distance = {
      text: `${routeData.summary.distance_km} km`,
      value: routeData.distance // en mètres
    };
    
    const duration = {
      text: routeData.summary.duration_text,
      value: routeData.duration // en secondes
    };
    
    // Debug logging pour diagnostiquer les données Mapbox
    console.log('✅ Mapbox route data:', {
      distance: distance,
      duration: duration,
      distanceText: distance?.text,
      distanceValue: distance?.value,
      durationText: duration?.text,
      durationValue: duration?.value
    });

    // Vérifier si la géométrie est présente (format GeoJSON de Mapbox)
    if (!routeData.geometry || !routeData.geometry.coordinates) {
      console.error('No geometry data in Mapbox route:', routeData);
      return res.status(400).json({
        success: false,
        message: 'No route geometry data available from Mapbox'
      });
    }

    // Convertir les coordonnées GeoJSON en points lat/lng
    let points = [];
    try {
      points = routeData.geometry.coordinates.map(coord => ({
        lat: coord[1], // Mapbox utilise [lng, lat]
        lng: coord[0]
      }));
    } catch (geometryError) {
      console.error('Error processing Mapbox geometry:', geometryError);
      return res.status(500).json({
        success: false,
        message: 'Error processing route geometry from Mapbox',
        error: geometryError.message
      });
    }

    // Générer une polyline encodée pour compatibilité (optionnel)
    let encodedPolyline = '';
    try {
      const polylinePoints = points.map(p => [p.lat, p.lng]);
      encodedPolyline = polyline.encode(polylinePoints);
    } catch (polylineError) {
      console.warn('Could not encode polyline:', polylineError.message);
    }

    const result = {
      success: true,
      data: {
        distance: {
          text: distance?.text || 'Distance inconnue',
          value: distance?.value || 0
        },
        duration: {
          text: duration?.text || 'Durée inconnue',
          value: duration?.value || 0
        },
        points,
        start_address: `${originCoords.latitude}, ${originCoords.longitude}`,
        end_address: `${destinationCoords.latitude}, ${destinationCoords.longitude}`,
        polyline: encodedPolyline,
        geometry: routeData.geometry, // Géométrie GeoJSON complète
        provider: 'mapbox' // Indiquer que c'est Mapbox
      }
    };
    
    // Debug logging pour vérifier les données envoyées
    console.log('Final result data:', {
      distanceText: result.data.distance.text,
      durationText: result.data.duration.text,
      pointsCount: result.data.points.length
    });
    
    console.log('Sending response with route data');
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in getDirections:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      code: error.code,
      config: {
        url: error.config?.url,
        params: error.config?.params,
        method: error.config?.method
      }
    });
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error_message || 
                        error.message || 
                        'An unexpected error occurred while getting directions';
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    Get address from coordinates using Google Maps Geocoding API
 * @route   GET /api/maps/reverse-geocode
 * @access  Public
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key is not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Google Maps API key is missing'
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          latlng: `${lat},${lng}`,
          key: apiKey
        },
        timeout: 10000
      }
    );

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      console.error('Google Maps Geocoding API error:', {
        status: response.data.status,
        error_message: response.data.error_message
      });
      
      return res.status(400).json({
        success: false,
        message: response.data.error_message || 'Could not find address for the given coordinates',
        status: response.data.status
      });
    }

    const formattedAddress = response.data.results[0].formatted_address;

    res.status(200).json({
      success: true,
      data: {
        address: formattedAddress
      }
    });

  } catch (error) {
    console.error('Error in reverseGeocode:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      code: error.code
    });
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error_message || 
                        error.message || 
                        'An unexpected error occurred during reverse geocoding';
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
};
