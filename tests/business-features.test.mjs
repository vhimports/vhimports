import assert from 'node:assert/strict'
import test from 'node:test'
import { birthdayList, upcomingBirthday } from '../src/lib/customerDates.js'
import { estimateSoldItem, OPERATIONAL_COST_PER_PIECE, suggestedSalePrice } from '../src/lib/estimatedProfit.js'

test('birthday reminders include today through the next 30 days and sort nearest first', () => {
  const today = new Date(2026, 8, 23, 12)
  const result = birthdayList([
    { name: 'Marta', birth_date: '1990-10-23' },
    { name: 'Ana', birth_date: '1980-09-23' },
    { name: 'Bia', birth_date: '1995-10-24' },
    { name: 'Dora', birth_date: null },
  ], today, 30)
  assert.deepEqual(result.map(({ name, daysUntil }) => [name, daysUntil]), [['Ana', 0], ['Marta', 30]])
})

test('birthday occurrence rolls into next year and leap-day notice goes to March 1 in non-leap years', () => {
  assert.equal(upcomingBirthday('1992-12-31', new Date(2026, 11, 31, 12)).daysUntil, 0)
  assert.equal(upcomingBirthday('1992-02-29', new Date(2025, 1, 28, 12)).date.getMonth(), 2)
  assert.equal(upcomingBirthday('1992-02-29', new Date(2025, 1, 28, 12)).daysUntil, 1)
})

test('birthday agenda uses the business calendar in America/Sao_Paulo', () => {
  const result = upcomingBirthday('1990-12-31', new Date('2026-01-01T02:00:00.000Z'))
  assert.equal(result.daysUntil, 0)
})

test('VH Imports suggested sale price is purchase cost plus 140 percent and R$ 3 operation cost', () => {
  assert.equal(OPERATIONAL_COST_PER_PIECE, 3)
  assert.equal(suggestedSalePrice(100), 243)
  assert.equal(suggestedSalePrice(0), null)
})

test('sold-item estimate subtracts proportional order discount, historical cost and operational cost per unit', () => {
  const result = estimateSoldItem({ quantity: 2, total_amount: 40, unit_cost_snapshot: 10 }, { subtotal: 100, discount_amount: 10 })
  assert.equal(result.salesAmount, 36)
  assert.equal(result.costAmount, 20)
  assert.equal(result.operationalCost, 6)
  assert.equal(result.estimatedProfit, 10)
  assert.equal(result.costKnown, true)
})

test('sold-item with no historical cost does not receive an inflated profit estimate', () => {
  const result = estimateSoldItem({ quantity: 1, total_amount: 40, unit_cost_snapshot: 0 }, { subtotal: 40, discount_amount: 0 })
  assert.equal(result.costKnown, false)
  assert.equal(result.estimatedProfit, null)
})

