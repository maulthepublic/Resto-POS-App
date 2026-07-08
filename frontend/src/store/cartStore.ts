import { create } from 'zustand';
import { LocalMenuItem, LocalVariant, LocalModifier } from '../db/localSchema';

export interface CartItem {
  id: string; // unique ID for this cart item row (to allow same menu item with different configs)
  menuItem: LocalMenuItem;
  selectedVariants: LocalVariant[];
  selectedModifiers: LocalModifier[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  kitchenNote: string;
}

interface CartState {
  cartItems: CartItem[];
  discountPercent: number;
  taxPercent: number; // default 10%
  addToCart: (
    menuItem: LocalMenuItem,
    variants: LocalVariant[],
    modifiers: LocalModifier[],
    quantity: number,
    kitchenNote?: string
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, qty: number) => void;
  clearCart: () => void;
  setDiscount: (percent: number) => void;
  getTotals: () => {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  cartItems: [],
  discountPercent: 0,
  taxPercent: 10, // 10% tax rate

  addToCart: (menuItem, variants, modifiers, quantity, kitchenNote = '') => {
    // Calculate unit price = basePrice + sum(variants priceDelta) + sum(modifiers priceDelta)
    const variantDelta = variants.reduce((sum, v) => sum + Number(v.priceDelta || 0), 0);
    const modifierDelta = modifiers.reduce((sum, m) => sum + Number(m.priceDelta || 0), 0);
    const unitPrice = Number(menuItem.basePrice) + variantDelta + modifierDelta;

    const cartItems = [...get().cartItems];

    // Check if an identical item exists (same menu id, same variants, same modifiers, same note)
    const existingIndex = cartItems.findIndex((item) => {
      if (item.menuItem.id !== menuItem.id) return false;
      if (item.kitchenNote !== kitchenNote) return false;
      
      const vIds1 = item.selectedVariants.map((v) => v.id).sort().join(',');
      const vIds2 = variants.map((v) => v.id).sort().join(',');
      if (vIds1 !== vIds2) return false;

      const mIds1 = item.selectedModifiers.map((m) => m.id).sort().join(',');
      const mIds2 = modifiers.map((m) => m.id).sort().join(',');
      if (mIds1 !== mIds2) return false;

      return true;
    });

    if (existingIndex > -1) {
      // Aggregate quantity
      const existing = cartItems[existingIndex];
      const newQty = existing.quantity + quantity;
      cartItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        lineTotal: existing.unitPrice * newQty,
      };
    } else {
      // Add new cart item
      const newItem: CartItem = {
        id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        menuItem,
        selectedVariants: variants,
        selectedModifiers: modifiers,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        kitchenNote,
      };
      cartItems.push(newItem);
    }

    set({ cartItems });
  },

  removeFromCart: (cartItemId) => {
    set({
      cartItems: get().cartItems.filter((item) => item.id !== cartItemId),
    });
  },

  updateQuantity: (cartItemId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }
    set({
      cartItems: get().cartItems.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity: qty, lineTotal: item.unitPrice * qty }
          : item
      ),
    });
  },

  clearCart: () => {
    set({ cartItems: [], discountPercent: 0 });
  },

  setDiscount: (percent) => {
    set({ discountPercent: Math.max(0, Math.min(100, percent)) });
  },

  getTotals: () => {
    const { cartItems, discountPercent, taxPercent } = get();
    const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const discountTotal = subtotal * (discountPercent / 100);
    const taxTotal = (subtotal - discountTotal) * (taxPercent / 100);
    const grandTotal = subtotal - discountTotal + taxTotal;

    return {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
    };
  },
}));
