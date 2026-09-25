export const OPERATIONAL_COST_PER_PIECE = 3

export function suggestedSalePrice(costValue) {
  const cost = Number(costValue)
  if (!Number.isFinite(cost) || cost <= 0) return null
  return Math.round((cost + cost * 1.4 + OPERATIONAL_COST_PER_PIECE) * 100) / 100
}

export function estimateSoldItem(item, order) {
  const quantity = Number(item.quantity || 0)
  const lineGross = Math.max(0, Number(item.total_amount || 0))
  const subtotal = Math.max(0, Number(order.subtotal || 0))
  const orderDiscount = Math.min(subtotal, Math.max(0, Number(order.discount_amount || 0)))
  const lineDiscountShare = subtotal > 0 ? orderDiscount * (lineGross / subtotal) : 0
  const salesAmount = Math.max(0, lineGross - lineDiscountShare)
  const unitCost = Math.max(0, Number(item.unit_cost_snapshot || 0))
  const costAmount = unitCost * quantity
  const operationalCost = OPERATIONAL_COST_PER_PIECE * quantity
  return {
    costKnown: unitCost > 0,
    salesAmount,
    costAmount,
    operationalCost,
    estimatedProfit: unitCost > 0 ? salesAmount - costAmount - operationalCost : null,
  }
}

