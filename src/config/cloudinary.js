const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuration du stockage Cloudinary pour les photos de pressing
const pressingStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'geopressci/pressings',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1200, height: 800, crop: 'limit', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const pressingId = req.user?._id || req.params.id || 'unknown';
      return `pressing_${pressingId}_${timestamp}`;
    },
  },
});

// Configuration du stockage pour les photos de profil
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'geopressci/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const pressingId = req.user?._id || req.params.id || 'unknown';
      return `profile_${pressingId}_${timestamp}`;
    },
  },
});

// Configuration du stockage pour les photos de couverture
const coverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'geopressci/covers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 1920, height: 600, crop: 'fill', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const pressingId = req.user?._id || req.params.id || 'unknown';
      return `cover_${pressingId}_${timestamp}`;
    },
  },
});

// Middleware Multer pour différents types d'upload
const uploadPressing = multer({ 
  storage: pressingStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

const uploadProfile = multer({ 
  storage: profileStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

const uploadCover = multer({ 
  storage: coverStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Fonction utilitaire pour supprimer une image de Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'image:', error);
    throw error;
  }
};

// Fonction utilitaire pour extraire le public_id d'une URL Cloudinary
const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return null;
  
  // Récupérer la partie après /upload/v{version}/
  const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
  // Supprimer l'extension du fichier
  return pathAfterUpload.replace(/\.[^/.]+$/, '');
};

// Fonction pour optimiser une URL d'image
const optimizeImageUrl = (url, options = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  const { width, height, quality = 'auto', format = 'auto' } = options;
  
  let transformation = `f_${format},q_${quality}`;
  if (width) transformation += `,w_${width}`;
  if (height) transformation += `,h_${height}`;
  
  return url.replace('/upload/', `/upload/${transformation}/`);
};

module.exports = {
  cloudinary,
  uploadPressing,
  uploadProfile,
  uploadCover,
  deleteImage,
  extractPublicId,
  optimizeImageUrl,
};
