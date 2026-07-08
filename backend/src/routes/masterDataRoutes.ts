import { Router } from 'express';
import { masterDataController } from '../controllers/masterDataController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// ── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', authenticate, masterDataController.getCategories);
router.post('/categories', authenticate, authorize('owner', 'admin'), masterDataController.createCategory);
router.put('/categories/:id', authenticate, authorize('owner', 'admin'), masterDataController.updateCategory);
router.delete('/categories/:id', authenticate, authorize('owner', 'admin'), masterDataController.deleteCategory);

// ── Menu Items ──────────────────────────────────────────────────────────────
router.get('/menu-items', authenticate, masterDataController.getMenuItems);
router.get('/menu-items/:id', authenticate, masterDataController.getMenuItemById);
router.post('/menu-items', authenticate, authorize('owner', 'admin'), masterDataController.createMenuItem);
router.put('/menu-items/:id', authenticate, authorize('owner', 'admin'), masterDataController.updateMenuItem);
router.delete('/menu-items/:id', authenticate, authorize('owner', 'admin'), masterDataController.deleteMenuItem);
router.get('/menu-items/:id/hpp', authenticate, masterDataController.getMenuHpp);

// ── Variant Groups & Variants ───────────────────────────────────────────────
router.post('/variant-groups', authenticate, authorize('owner', 'admin'), masterDataController.createVariantGroup);
router.delete('/variant-groups/:id', authenticate, authorize('owner', 'admin'), masterDataController.deleteVariantGroup);
router.post('/variants', authenticate, authorize('owner', 'admin'), masterDataController.createVariant);

// ── Modifiers ───────────────────────────────────────────────────────────────
router.get('/modifiers', authenticate, masterDataController.getModifiers);
router.post('/modifiers', authenticate, authorize('owner', 'admin'), masterDataController.createModifier);
router.put('/modifiers/:id', authenticate, authorize('owner', 'admin'), masterDataController.updateModifier);
router.delete('/modifiers/:id', authenticate, authorize('owner', 'admin'), masterDataController.deleteModifier);

// ── Raw Materials ───────────────────────────────────────────────────────────
router.get('/raw-materials', authenticate, masterDataController.getRawMaterials);
router.post('/raw-materials', authenticate, authorize('owner', 'admin'), masterDataController.createRawMaterial);
router.put('/raw-materials/:id', authenticate, authorize('owner', 'admin'), masterDataController.updateRawMaterial);
router.delete('/raw-materials/:id', authenticate, authorize('owner'), masterDataController.deleteRawMaterial);

// ── Recipes (BOM) ───────────────────────────────────────────────────────────
router.get('/menu-items/:menuItemId/recipes', authenticate, masterDataController.getRecipesByMenuItem);
router.post('/recipes', authenticate, authorize('owner', 'admin'), masterDataController.upsertRecipe);
router.delete('/recipes/:id', authenticate, authorize('owner', 'admin'), masterDataController.deleteRecipe);

export default router;
