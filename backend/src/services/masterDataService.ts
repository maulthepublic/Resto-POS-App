import prisma from '../config/db';

export const masterDataService = {
  // ── Categories ───────────────────────────────────────────────────────────
  async getCategories() {
    return prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  },
  async createCategory(name: string, sortOrder = 0) {
    return prisma.category.create({ data: { name, sortOrder } });
  },
  async updateCategory(id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    return prisma.category.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  },
  async deleteCategory(id: string) {
    return prisma.category.update({ where: { id }, data: { isActive: false } });
  },

  // ── Menu Items ───────────────────────────────────────────────────────────
  async getMenuItems(includeInactive = false) {
    return prisma.menuItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        variantGroups: { include: { variants: true } },
        recipes: {
          include: { rawMaterial: { select: { id: true, name: true, unit: true, unitCost: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },
  async getMenuItemById(id: string) {
    return prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: true,
        variantGroups: { include: { variants: true } },
        recipes: { include: { rawMaterial: true } },
      },
    });
  },
  async createMenuItem(data: {
    name: string; categoryId?: string; basePrice: number;
    description?: string; imageUrl?: string;
  }) {
    return prisma.menuItem.create({ data });
  },
  async updateMenuItem(id: string, data: Record<string, unknown>) {
    return prisma.menuItem.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  },
  async deleteMenuItem(id: string) {
    return prisma.menuItem.update({ where: { id }, data: { isActive: false } });
  },

  // ── Variants ─────────────────────────────────────────────────────────────
  async createVariantGroup(menuItemId: string, name: string, isRequired: boolean, maxSelected: number) {
    return prisma.variantGroup.create({ data: { menuItemId, name, isRequired, maxSelected } });
  },
  async createVariant(variantGroupId: string, name: string, priceDelta: number) {
    return prisma.variant.create({ data: { variantGroupId, name, priceDelta } });
  },
  async deleteVariantGroup(id: string) {
    return prisma.variantGroup.delete({ where: { id } });
  },

  // ── Modifiers ────────────────────────────────────────────────────────────
  async getModifiers() {
    return prisma.modifier.findMany({ where: { isActive: true } });
  },
  async createModifier(name: string, priceDelta: number) {
    return prisma.modifier.create({ data: { name, priceDelta } });
  },
  async updateModifier(id: string, data: { name?: string; priceDelta?: number; isActive?: boolean }) {
    return prisma.modifier.update({ where: { id }, data });
  },
  async deleteModifier(id: string) {
    return prisma.modifier.update({ where: { id }, data: { isActive: false } });
  },

  // ── Raw Materials (Bahan Baku) ────────────────────────────────────────────
  async getRawMaterials() {
    return prisma.rawMaterial.findMany({ orderBy: { name: 'asc' } });
  },
  async createRawMaterial(data: {
    name: string; unit: string; unitCost: number;
    minimumQuantity?: number; currentQuantity?: number;
  }) {
    return prisma.rawMaterial.create({ data });
  },
  async updateRawMaterial(id: string, data: Record<string, unknown>) {
    return prisma.rawMaterial.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  },
  async deleteRawMaterial(id: string) {
    return prisma.rawMaterial.delete({ where: { id } });
  },

  // ── Recipes (BOM) ─────────────────────────────────────────────────────────
  async getRecipesByMenuItem(menuItemId: string) {
    return prisma.recipe.findMany({
      where: { menuItemId },
      include: { rawMaterial: true },
    });
  },
  async upsertRecipe(menuItemId: string, rawMaterialId: string, quantity: number) {
    return prisma.recipe.upsert({
      where: { menuItemId_rawMaterialId: { menuItemId, rawMaterialId } },
      update: { quantity },
      create: { menuItemId, rawMaterialId, quantity },
    });
  },
  async deleteRecipe(id: string) {
    return prisma.recipe.delete({ where: { id } });
  },

  // ── HPP Calculation ───────────────────────────────────────────────────────
  async calculateHpp(menuItemId: string): Promise<number> {
    const recipes = await prisma.recipe.findMany({
      where: { menuItemId },
      include: { rawMaterial: { select: { unitCost: true } } },
    });
    return recipes.reduce((sum, r) => {
      return sum + Number(r.rawMaterial.unitCost) * Number(r.quantity);
    }, 0);
  },
};
