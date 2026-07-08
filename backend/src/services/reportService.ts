import prisma from '../config/db';

export const reportService = {
  // ── Daily Z-Report Summary ───────────────────────────────────────────────
  async getDailySummary(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch all paid orders for the day
    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        orderItems: true,
        payments: true,
      },
    });

    // Revenue metrics
    const grossSales = orders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const subtotalSales = orders.reduce((s, o) => s + Number(o.subtotal), 0);
    const taxCollected = orders.reduce((s, o) => s + Number(o.taxTotal), 0);
    const discountGranted = orders.reduce((s, o) => s + Number(o.discountTotal), 0);
    const receiptCount = orders.length;

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    orders.forEach((o) => {
      o.payments.forEach((p) => {
        const method = p.method as string;
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(p.amount);
      });
    });

    // HPP / COGS calculation for the day
    let totalHpp = 0;
    for (const order of orders) {
      for (const item of order.orderItems) {
        if (item.menuItemId) {
          const recipes = await prisma.recipe.findMany({
            where: { menuItemId: item.menuItemId },
            include: { rawMaterial: { select: { unitCost: true } } },
          });
          const itemHpp = recipes.reduce((s, r) => s + Number(r.rawMaterial.unitCost) * Number(r.quantity), 0);
          totalHpp += itemHpp * item.quantity;
        }
      }
    }

    // Manual cash book entries for the day
    const ledgerEntries = await prisma.financeLedger.findMany({
      where: {
        occurredAt: { gte: dayStart, lte: dayEnd },
        orderId: null, // exclude auto-created order entries
      },
    });
    const manualExpenses = ledgerEntries
      .filter((l) => l.type === 'expense')
      .reduce((s, l) => s + Number(l.amount), 0);
    const manualIncome = ledgerEntries
      .filter((l) => l.type === 'income')
      .reduce((s, l) => s + Number(l.amount), 0);

    const grossProfit = grossSales - totalHpp;
    const netProfit = grossProfit - manualExpenses + manualIncome;
    const marginPercent = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;

    return {
      date: targetDate.toISOString().split('T')[0],
      receiptCount,
      grossSales,
      subtotalSales,
      taxCollected,
      discountGranted,
      totalHpp,
      grossProfit,
      marginPercent: Math.round(marginPercent * 100) / 100,
      manualExpenses,
      manualIncome,
      netProfit,
      paymentBreakdown,
    };
  },

  // ── Date-Range Sales Report ───────────────────────────────────────────────
  async getSalesReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: start, lte: end } },
      include: { payments: true, orderItems: true },
      orderBy: { paidAt: 'asc' },
    });

    const totalRevenue = orders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const orderCount = orders.length;

    return { startDate, endDate, orderCount, totalRevenue, orders };
  },

  // ── Stock Reconciliation Report (HPP vs Physical Opname) ────────────────
  async getStockReconciliation() {
    const materials = await prisma.rawMaterial.findMany({
      include: {
        stockMovements: {
          where: { movementType: 'opname_correction' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return materials.map((m) => {
      const lastOpname = m.stockMovements[0];
      return {
        id: m.id,
        name: m.name,
        unit: m.unit,
        unitCost: Number(m.unitCost),
        systemQuantity: Number(m.currentQuantity),
        minimumQuantity: Number(m.minimumQuantity),
        isLowStock: Number(m.currentQuantity) <= Number(m.minimumQuantity),
        lastOpnameDate: lastOpname?.createdAt ?? null,
        lastOpnameDelta: lastOpname ? Number(lastOpname.quantityDelta) : null,
      };
    });
  },

  // ── Top Selling Menu Items ───────────────────────────────────────────────
  async getTopSellingItems(limit = 10) {
    const grouped = await prisma.orderItem.groupBy({
      by: ['menuItemId', 'itemName'],
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({
      menuItemId: g.menuItemId,
      itemName: g.itemName,
      totalQuantitySold: g._sum.quantity ?? 0,
      totalRevenue: Number(g._sum.lineTotal ?? 0),
    }));
  },
};
