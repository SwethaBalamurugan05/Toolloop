import assert from 'node:assert/strict'
import test from 'node:test'
import { filterMarketplaceEquipment, getRentalDays, getTotalRentalCost } from './rental.js'

test('calculates a one-day rental from consecutive dates', () => {
  assert.equal(getRentalDays('2026-08-10', '2026-08-11'), 1)
  assert.equal(getTotalRentalCost(2, 1, 1), 2)
})

test('calculates a multi-day rental', () => {
  assert.equal(getRentalDays('2026-08-10', '2026-08-13'), 3)
  assert.equal(getTotalRentalCost(2, 3, 1), 6)
})

test('includes quantity in the total', () => {
  assert.equal(getTotalRentalCost(5, 3, 2), 30)
})

test('invalid dates and invalid quantities do not produce a charge', () => {
  assert.equal(getRentalDays('2026-08-13', '2026-08-10'), 0)
  assert.equal(getTotalRentalCost(2, 0, 1), 0)
  assert.equal(getTotalRentalCost(2, 2, 0), 0)
  assert.equal(getTotalRentalCost(2, 2, -1), 0)
  assert.equal(getTotalRentalCost(2, 2, 1.5), 0)
})

test('excludes the current user’s equipment from marketplace results', () => {
  const equipment = [
    { id: 'mine', ownerId: 'owner-1', name: 'My Drill', category: 'Tools' },
    { id: 'other-tool', ownerId: 'owner-2', name: 'Circular Saw', category: 'Tools' },
    { id: 'other-camera', ownerId: 'owner-3', name: 'Camera', category: 'Electronics' },
  ]

  assert.deepEqual(
    filterMarketplaceEquipment(equipment, 'owner-1', 'Tools', 'saw').map((item) => item.id),
    ['other-tool'],
  )
  assert.deepEqual(filterMarketplaceEquipment(equipment, 'owner-1').map((item) => item.id), ['other-tool', 'other-camera'])
})