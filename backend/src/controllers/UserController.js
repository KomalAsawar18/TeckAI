const User = require('../models/User');

// Retrieve all registered platform users (Admin-only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('name email role createdAt')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
