const axios = require('axios');
const polyline = require('@mapbox/polyline');

/**
 * @desc    Get directions from Google Maps API
 * @route   GET /api/maps/directions
 * @access  Public
 */
exports.getDirections = async (req, res) => {
  try {
    console.log('Received request with query:', req.query);
    
    const { origin, destination, mode = 'driving' } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('Google Maps API key is not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Google Maps API key is missing'
      });
    }

    if (!origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination are required'
      });
    }

    console.log('Calling Google Maps API with:', { origin, destination, mode });
    
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json`,
      {
        params: {
          origin,
          destination,
          mode,
          key: apiKey
        },
        timeout: 10000 // 10 secondes de timeout
      }
    );

    console.log('Google Maps API response status:', response.data.status);
    
    if (response.data.status !== 'OK') {
      console.error('Google Maps API error:', {
        status: response.data.status,
        error_message: response.data.error_message,
        available_travel_modes: response.data.available_travel_modes
      });
      
      return res.status(400).json({
        success: false,
        message: response.data.error_message || 'Error getting directions',
        status: response.data.status
      });
    }

    const route = response.data.routes[0];
    
    if (!route || !route.legs || route.legs.length === 0) {
      console.error('No route legs found in response:', response.data);
      return res.status(400).json({
        success: false,
        message: 'No route found between the specified points'
      });
    }
    
    const { distance, duration } = route.legs[0];

    // Vérifier si la polyligne est présente
    if (!route.overview_polyline || !route.overview_polyline.points) {
      console.error('No polyline data in route:', route);
      return res.status(400).json({
        success: false,
        message: 'No route geometry data available'
      });
    }

    // Décoder la polyligne pour obtenir les points de l'itinéraire
    let points = [];
    try {
      points = polyline.decode(route.overview_polyline.points).map(point => ({
        lat: point[0],
        lng: point[1]
      }));
    } catch (polylineError) {
      console.error('Error decoding polyline:', polylineError);
      return res.status(500).json({
        success: false,
        message: 'Error processing route geometry',
        error: polylineError.message
      });
    }

    const result = {
      success: true,
      data: {
        distance: {
          text: distance?.text || 'Unknown distance',
          value: distance?.value || 0
        },
        duration: {
          text: duration?.text || 'Unknown duration',
          value: duration?.value || 0
        },
        points,
        start_address: route.legs[0]?.start_address || 'Unknown start',
        end_address: route.legs[0]?.end_address || 'Unknown end',
        polyline: route.overview_polyline.points
      }
    };
    
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
