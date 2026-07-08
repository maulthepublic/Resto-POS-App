import { Request, Response, NextFunction } from 'express';
import { masterDataService } from '../services/masterDataService';

export const masterDataController = {
  // ── Categories ─────────────────────────────────────────────────────────
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.getCategories();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, sortOrder } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi.' });
      const data = await masterDataService.createCategory(name, sortOrder);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.updateCategory(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.deleteCategory(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Menu Items ─────────────────────────────────────────────────────────
  async getMenuItems(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const data = await masterDataService.getMenuItems(includeInactive);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async getMenuItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.getMenuItemById(req.params.id);
      if (!data) return res.status(404).json({ success: false, message: 'Menu item tidak ditemukan.' });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async createMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, basePrice, categoryId, description, imageUrl } = req.body;
      if (!name || basePrice == null) {
        return res.status(400).json({ success: false, message: 'name dan basePrice wajib diisi.' });
      }
      const data = await masterDataService.createMenuItem({ name, basePrice: Number(basePrice), categoryId, description, imageUrl });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async updateMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.updateMenuItem(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.deleteMenuItem(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Variant Groups & Variants ──────────────────────────────────────────
  async createVariantGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { menuItemId, name, isRequired, maxSelected } = req.body;
      if (!menuItemId || !name) return res.status(400).json({ success: false, message: 'menuItemId dan name wajib diisi.' });
      const data = await masterDataService.createVariantGroup(menuItemId, name, isRequired ?? false, maxSelected ?? 1);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async createVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantGroupId, name, priceDelta } = req.body;
      if (!variantGroupId || !name) return res.status(400).json({ success: false, message: 'variantGroupId dan name wajib diisi.' });
      const data = await masterDataService.createVariant(variantGroupId, name, Number(priceDelta ?? 0));
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteVariantGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await masterDataService.deleteVariantGroup(req.params.id);
      res.json({ success: true, message: 'Variant group dihapus.' });
    } catch (err) { next(err); }
  },

  // ── Modifiers ─────────────────────────────────────────────────────────
  async getModifiers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.getModifiers();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async createModifier(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, priceDelta } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'name wajib diisi.' });
      const data = await masterDataService.createModifier(name, Number(priceDelta ?? 0));
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async updateModifier(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.updateModifier(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteModifier(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.deleteModifier(req.params.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Raw Materials ─────────────────────────────────────────────────────
  async getRawMaterials(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.getRawMaterials();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async createRawMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, unit, unitCost, minimumQuantity, currentQuantity } = req.body;
      if (!name || !unit || unitCost == null) {
        return res.status(400).json({ success: false, message: 'name, unit, dan unitCost wajib diisi.' });
      }
      const data = await masterDataService.createRawMaterial({ name, unit, unitCost: Number(unitCost), minimumQuantity: Number(minimumQuantity ?? 0), currentQuantity: Number(currentQuantity ?? 0) });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async updateRawMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.updateRawMaterial(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteRawMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      await masterDataService.deleteRawMaterial(req.params.id);
      res.json({ success: true, message: 'Bahan baku dihapus.' });
    } catch (err) { next(err); }
  },

  // ── Recipes (BOM) ─────────────────────────────────────────────────────
  async getRecipesByMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await masterDataService.getRecipesByMenuItem(req.params.menuItemId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
  async upsertRecipe(req: Request, res: Response, next: NextFunction) {
    try {
      const { menuItemId, rawMaterialId, quantity } = req.body;
      if (!menuItemId || !rawMaterialId || quantity == null) {
        return res.status(400).json({ success: false, message: 'menuItemId, rawMaterialId, dan quantity wajib diisi.' });
      }
      const data = await masterDataService.upsertRecipe(menuItemId, rawMaterialId, Number(quantity));
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },
  async deleteRecipe(req: Request, res: Response, next: NextFunction) {
    try {
      await masterDataService.deleteRecipe(req.params.id);
      res.json({ success: true, message: 'Resep dihapus.' });
    } catch (err) { next(err); }
  },

  // ── HPP ───────────────────────────────────────────────────────────────
  async getMenuHpp(req: Request, res: Response, next: NextFunction) {
    try {
      const menuItem = await masterDataService.getMenuItemById(req.params.id);
      if (!menuItem) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
      const hpp = await masterDataService.calculateHpp(req.params.id);
      const price = Number(menuItem.basePrice);
      const margin = price > 0 ? ((price - hpp) / price) * 100 : 0;
      res.json({
        success: true,
        data: {
          menuItemId: req.params.id,
          name: menuItem.name,
          basePrice: price,
          hpp,
          grossProfit: price - hpp,
          marginPercent: Math.round(margin * 100) / 100,
        },
      });
    } catch (err) { next(err); }
  },
};
