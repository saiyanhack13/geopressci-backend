const Pressing = require('../models/pressing.model');
const { ErrorResponse } = require('../utils/error.utils');
const { 
  uploadPressing, 
  uploadProfile, 
  uploadCover, 
  deleteImage, 
  extractPublicId, 
  optimizeImageUrl 
} = require('../config/cloudinary');

/**
 * @desc    Upload une photo de galerie pour le pressing
 * @route   POST /api/v1/pressing/photos/gallery
 * @access  Privé (Pressing)
 */
const uploadGalleryPhoto = async (req, res, next) => {
  // Utiliser le middleware uploadPressing pour traiter l'upload
  uploadPressing.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors de l\'upload de l\'image'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    try {
      const pressingId = req.user._id;
      const { caption, isPrimary } = req.body;

      const pressing = await Pressing.findById(pressingId);
      if (!pressing) {
        return res.status(404).json({
          success: false,
          message: 'Pressing non trouvé'
        });
      }

      // Créer l'objet photo avec l'URL Cloudinary
      const newPhoto = {
        url: req.file.path, // Cloudinary renvoie l'URL dans req.file.path
        publicId: req.file.filename, // Public ID Cloudinary
        caption: caption || '',
        isPrimary: isPrimary === 'true' || isPrimary === true,
        uploadedAt: new Date()
      };

      // Si c'est la première photo, on la marque comme principale
      if (pressing.photos.length === 0) {
        newPhoto.isPrimary = true;
      }

      // Si la nouvelle photo est marquée comme principale, on réinitialise les autres
      if (newPhoto.isPrimary) {
        pressing.photos.forEach(photo => { photo.isPrimary = false; });
      }

      // Ajouter la nouvelle photo
      pressing.photos.push(newPhoto);
      await pressing.save();

      // Récupérer la photo ajoutée
      const addedPhoto = pressing.photos[pressing.photos.length - 1];
      
      res.status(201).json({
        success: true,
        message: 'Photo ajoutée à la galerie avec succès',
        data: {
          ...addedPhoto.toObject(),
          optimizedUrl: optimizeImageUrl(addedPhoto.url, { width: 800, height: 600 })
        }
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de la photo:', error);
      
      // Supprimer l'image de Cloudinary en cas d'erreur
      if (req.file && req.file.filename) {
        try {
          await deleteImage(req.file.filename);
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'image:', deleteError);
        }
      }
      
      next(error);
    }
  });
};

/**
 * @desc    Upload une photo de profil pour le pressing
 * @route   POST /api/v1/pressing/photos/profile
 * @access  Privé (Pressing)
 */
const uploadProfilePhoto = async (req, res, next) => {
  uploadProfile.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors de l\'upload de l\'image'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    try {
      const pressingId = req.user._id;
      const pressing = await Pressing.findById(pressingId);
      
      if (!pressing) {
        return res.status(404).json({
          success: false,
          message: 'Pressing non trouvé'
        });
      }

      // Supprimer l'ancienne photo de profil si elle existe
      if (pressing.profilePhoto && pressing.profilePhoto.publicId) {
        try {
          await deleteImage(pressing.profilePhoto.publicId);
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'ancienne photo:', deleteError);
        }
      }

      // Mettre à jour la photo de profil
      pressing.profilePhoto = {
        url: req.file.path,
        publicId: req.file.filename,
        uploadedAt: new Date()
      };

      await pressing.save();

      res.status(200).json({
        success: true,
        message: 'Photo de profil mise à jour avec succès',
        data: {
          ...pressing.profilePhoto,
          optimizedUrl: optimizeImageUrl(pressing.profilePhoto.url, { width: 400, height: 400 })
        }
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de la photo de profil:', error);
      
      // Supprimer l'image de Cloudinary en cas d'erreur
      if (req.file && req.file.filename) {
        try {
          await deleteImage(req.file.filename);
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'image:', deleteError);
        }
      }
      
      next(error);
    }
  });
};

/**
 * @desc    Upload une photo de couverture pour le pressing
 * @route   POST /api/v1/pressing/photos/cover
 * @access  Privé (Pressing)
 */
const uploadCoverPhoto = async (req, res, next) => {
  uploadCover.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Erreur lors de l\'upload de l\'image'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    try {
      const pressingId = req.user._id;
      const pressing = await Pressing.findById(pressingId);
      
      if (!pressing) {
        return res.status(404).json({
          success: false,
          message: 'Pressing non trouvé'
        });
      }

      // Supprimer l'ancienne photo de couverture si elle existe
      if (pressing.coverPhoto && pressing.coverPhoto.publicId) {
        try {
          await deleteImage(pressing.coverPhoto.publicId);
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'ancienne photo:', deleteError);
        }
      }

      // Mettre à jour la photo de couverture
      pressing.coverPhoto = {
        url: req.file.path,
        publicId: req.file.filename,
        uploadedAt: new Date()
      };

      await pressing.save();

      res.status(200).json({
        success: true,
        message: 'Photo de couverture mise à jour avec succès',
        data: {
          ...pressing.coverPhoto,
          optimizedUrl: optimizeImageUrl(pressing.coverPhoto.url, { width: 1920, height: 600 })
        }
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de la photo de couverture:', error);
      
      // Supprimer l'image de Cloudinary en cas d'erreur
      if (req.file && req.file.filename) {
        try {
          await deleteImage(req.file.filename);
        } catch (deleteError) {
          console.error('Erreur lors de la suppression de l\'image:', deleteError);
        }
      }
      
      next(error);
    }
  });
};

/**
 * @desc    Supprimer une photo de la galerie
 * @route   DELETE /api/v1/pressing/photos/gallery/:photoId
 * @access  Privé (Pressing)
 */
const deleteGalleryPhoto = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { photoId } = req.params;

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver la photo dans la galerie
    const photoIndex = pressing.photos.findIndex(photo => photo._id.toString() === photoId);
    if (photoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée'
      });
    }

    const photo = pressing.photos[photoIndex];

    // Supprimer l'image de Cloudinary
    if (photo.publicId) {
      try {
        await deleteImage(photo.publicId);
      } catch (deleteError) {
        console.error('Erreur lors de la suppression de l\'image Cloudinary:', deleteError);
      }
    }

    // Supprimer la photo du tableau
    pressing.photos.splice(photoIndex, 1);
    await pressing.save();

    res.status(200).json({
      success: true,
      message: 'Photo supprimée avec succès'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Récupérer toutes les photos du pressing avec URLs optimisées
 * @route   GET /api/v1/pressing/photos
 * @access  Privé (Pressing)
 */
const getPressingPhotos = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const pressing = await Pressing.findById(pressingId).select('photos profilePhoto coverPhoto');

    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Optimiser les URLs des photos
    const optimizedPhotos = {
      gallery: pressing.photos.map(photo => ({
        ...photo.toObject(),
        optimizedUrl: optimizeImageUrl(photo.url, { width: 800, height: 600 }),
        thumbnailUrl: optimizeImageUrl(photo.url, { width: 300, height: 200 })
      })),
      profile: pressing.profilePhoto ? {
        ...pressing.profilePhoto,
        optimizedUrl: optimizeImageUrl(pressing.profilePhoto.url, { width: 400, height: 400 }),
        thumbnailUrl: optimizeImageUrl(pressing.profilePhoto.url, { width: 150, height: 150 })
      } : null,
      cover: pressing.coverPhoto ? {
        ...pressing.coverPhoto,
        optimizedUrl: optimizeImageUrl(pressing.coverPhoto.url, { width: 1920, height: 600 }),
        thumbnailUrl: optimizeImageUrl(pressing.coverPhoto.url, { width: 600, height: 200 })
      } : null
    };

    res.status(200).json({
      success: true,
      data: optimizedPhotos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Définir une photo comme principale dans la galerie
 * @route   PUT /api/v1/pressing/photos/gallery/:photoId/primary
 * @access  Privé (Pressing)
 */
const setPrimaryPhoto = async (req, res, next) => {
  try {
    const pressingId = req.user._id;
    const { photoId } = req.params;

    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      return res.status(404).json({
        success: false,
        message: 'Pressing non trouvé'
      });
    }

    // Trouver la photo
    const photo = pressing.photos.find(p => p._id.toString() === photoId);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo non trouvée'
      });
    }

    // Réinitialiser toutes les photos comme non principales
    pressing.photos.forEach(p => { p.isPrimary = false; });
    
    // Définir la photo sélectionnée comme principale
    photo.isPrimary = true;

    await pressing.save();

    res.status(200).json({
      success: true,
      message: 'Photo définie comme principale',
      data: {
        ...photo.toObject(),
        optimizedUrl: optimizeImageUrl(photo.url, { width: 800, height: 600 })
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadGalleryPhoto,
  uploadProfilePhoto,
  uploadCoverPhoto,
  deleteGalleryPhoto,
  getPressingPhotos,
  setPrimaryPhoto
};
