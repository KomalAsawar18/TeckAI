const express = require('express');
const categoryController = require('../controllers/CategoryController');
const { protect, adminOnly } = require('../middlewares/auth');
const router = express.Router();

router.get('/', categoryController.getCategories);
router.post('/', protect, adminOnly, categoryController.createCategory);

module.exports = router;
