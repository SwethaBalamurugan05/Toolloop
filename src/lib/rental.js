const millisecondsPerDay = 1000 * 60 * 60 * 24

/**
 * Calculates billable rental days from ISO date inputs.
 * A return date one calendar day after the start date is a one-day rental.
 */
export function getRentalDays(startDate, returnDate) {
  if (!startDate || !returnDate) return 0
  const difference = new Date(`${returnDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)
  return difference > 0 ? Math.round(difference / millisecondsPerDay) : 0
}

/** Price per day × rental days × quantity. Invalid values return zero. */
export function getTotalRentalCost(pricePerDay, rentalDays, quantity) {
  const parsedQuantity = Number(quantity)
  const amount = Number(pricePerDay) * Number(rentalDays) * parsedQuantity
  return Number.isFinite(amount) && amount > 0 && Number.isInteger(parsedQuantity) ? amount : 0
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

/** Marketplace browse results must never include equipment owned by the current user. */
export function filterMarketplaceEquipment(equipment, userId, category = 'All', search = '') {
  const term = search.trim().toLowerCase()
  return equipment.filter((item) => {
    const belongsToCurrentUser = String(item.ownerId) === String(userId)
    const matchesCategory = category === 'All' || item.category === category
    const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term)
    return !belongsToCurrentUser && matchesCategory && matchesSearch
  })
}