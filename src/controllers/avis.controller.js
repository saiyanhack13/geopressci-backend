const Avis = require('../models/avis.model');
const Pressing = require('../models/pressing.model');
const { ErrorResponse, NotFoundError, BadRequestError } = require('../utils/error.utils');

/**
 * @desc    Créer un nouvel avis
 * @route   POST /api/v1/avis
 * @access  Privé (Client)
 */
const creerAvis = async (req, res, next) => {
  try {
    const { pressingId, commandeId, note, commentaire } = req.body;
    const clientId = req.user.id;

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${pressingId}`);
    }

    // Vérifier que la commande existe et appartient bien au client
    const commande = await Commande.findOne({
      _id: commandeId,
      client: clientId,
      pressing: pressingId,
      statut: 'terminee', // Ne peut noter qu'une commande terminée
    });

    if (!commande) {
      throw new BadRequestError('Commande non trouvée ou non éligible à un avis');
    }

    // Vérifier si l'utilisateur a déjà laissé un avis pour cette commande
    const avisExistant = await Avis.findOne({
      commande: commandeId,
      client: clientId,
    });

    if (avisExistant) {
      throw new BadRequestError('Vous avez déjà laissé un avis pour cette commande');
    }

    // Créer l'avis
    const avis = await Avis.create({
      client: clientId,
      pressing: pressingId,
      commande: commandeId,
      note,
      commentaire,
    });

    // Mettre à jour la note moyenne du pressing
    await updateNoteMoyennePressing(pressingId);

    res.status(201).json({
      success: true,
      data: avis,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Récupérer les avis d'un pressing
 * @route   GET /api/v1/avis/pressing/:pressingId
 * @access  Public
 */
const getAvisByPressing = async (req, res, next) => {
  try {
    const { pressingId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Vérifier que le pressing existe
    const pressing = await Pressing.findById(pressingId);
    if (!pressing) {
      throw new NotFoundError(`Pressing non trouvé avec l'ID ${pressingId}`);
    }

    // Options de pagination
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { dateCreation: -1 }, // Plus récents en premier
      populate: {
        path: 'client',
        select: 'nom prenom photo',
      },
    };

    // Récupérer les avis paginés
    const result = await Avis.paginate(
      { pressing: pressingId },
      options
    );

    res.json({
      success: true,
      data: result.docs,
      pagination: {
        total: result.totalDocs,
        limit: result.limit,
        page: result.page,
        pages: result.totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Récupérer un avis spécifique
 * @route   GET /api/v1/avis/:id
 * @access  Public
 */
const getAvisById = async (req, res, next) => {
  try {
    const avis = await Avis.findById(req.params.id)
      .populate('customer', 'nom prenom photo')
      .populate('pressing', 'nomCommerce');

    if (!avis) {
      throw new NotFoundError(`Avis non trouvé avec l'ID ${req.params.id}`);
    }

    res.json({
      success: true,
      data: avis,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mettre à jour un avis
 * @route   PUT /api/v1/avis/:id
 * @access  Privé (Client)
 */
const updateAvis = async (req, res, next) => {
  try {
    const { note, commentaire } = req.body;
    const clientId = req.user.id;

    // Vérifier que l'avis existe et appartient au client
    let avis = await Avis.findOne({
      _id: req.params.id,
      client: clientId,
    });

    if (!avis) {
      throw new NotFoundError(`Avis non trouvé ou vous n'êtes pas autorisé à le modifier`);
    }

    // Mettre à jour l'avis
    if (note !== undefined) avis.note = note;
    if (commentaire !== undefined) avis.commentaire = commentaire;
    avis.dateModification = Date.now();

    await avis.save();

    // Mettre à jour la note moyenne du pressing
    await updateNoteMoyennePressing(avis.pressing);

    res.json({
      success: true,
      data: avis,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Supprimer un avis
 * @route   DELETE /api/v1/avis/:id
 * @access  Privé (Client ou Admin)
 */
const deleteAvis = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    
    // Un client ne peut supprimer que ses propres avis, un admin peut tout supprimer
    if (req.user.role !== 'admin') {
      query.client = req.user.id;
    }

    const avis = await Avis.findOneAndDelete(query);

    if (!avis) {
      throw new NotFoundError(`Avis non trouvé ou vous n'êtes pas autorisé à le supprimer`);
    }

    // Mettre à jour la note moyenne du pressing
    await updateNoteMoyennePressing(avis.pressing);

    res.json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mettre à jour la note moyenne d'un pressing
 * @param   {string} pressingId - ID du pressing
 * @private
 */
const updateNoteMoyennePressing = async (pressingId) => {
  try {
    const result = await Avis.aggregate([
      {
        $match: { pressing: pressingId },
      },
      {
        $group: {
          _id: '$pressing',
          noteMoyenne: { $avg: '$note' },
          nombreAvis: { $sum: 1 },
        },
      },
    ]);

    if (result.length > 0) {
      const { noteMoyenne, nombreAvis } = result[0];
      
      await Pressing.findByIdAndUpdate(pressingId, {
        noteMoyenne: parseFloat(noteMoyenne.toFixed(1)),
        nombreAvis,
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note moyenne du pressing:', error);
    throw error;
  }
};

module.exports = {
  creerAvis,
  getAvisByPressing,
  getAvisById,
  updateAvis,
  deleteAvis,
};
