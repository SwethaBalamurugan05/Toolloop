import { Backpack, Camera, Drill, Projector, TentTree, Wrench } from 'lucide-react'
import { apiClient, clearAccessToken, setAccessToken } from './apiClient'

const iconMap = { drill: Drill, projector: Projector, camera: Camera, backpack: Backpack, wrench: Wrench, 'tent-tree': TentTree }

function toEquipment(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category_name || 'Other',
    categoryId: row.category_id,
    pricePerDay: Number(row.price_per_day),
    condition: row.condition,
    location: row.location,
    lastInspected: row.last_inspected_on,
    borrowingLimit: row.borrowing_limit_days,
    totalUnits: row.total_units,
    unitsAvailable: row.available_units,
    description: row.description,
    pickupAddress: row.pickup_address,
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'ToolLoop member',
    imageUrl: row.image_url || '',
    isActive: row.is_active,
    icon: iconMap[row.icon_key] || Wrench,
    color: row.card_color || '#F2F2F2',
  }
}

function toRequest(row) {
  return {
    id: row.id,
    requestNumber: row.request_number,
    equipmentId: row.equipment_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'Equipment owner',
    equipmentName: row.equipment_name || 'Equipment',
    requesterName: row.requester_name || '',
    requesterEmail: row.requester_email || '',
    equipmentIcon: iconMap[row.equipment_icon_key] || Wrench,
    equipmentColor: row.equipment_card_color || '#F2F2F2',
    startDate: row.start_date,
    returnDate: row.return_date,
    quantity: row.quantity,
    purpose: row.purpose,
    rentalDays: row.rental_days,
    pricePerDay: Number(row.price_per_day),
    totalCost: Number(row.total_cost),
    status: row.status,
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
  }
}

function toLoan(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    equipmentId: row.equipment_id,
    quantity: row.quantity,
    borrowedDate: row.borrowed_at,
    returnDate: row.due_date,
    returnedAt: row.returned_at,
    status: row.status,
  }
}

function toUser(row) {
  return { id: row.id, username: row.email, name: row.full_name || row.display_name || row.email.split('@')[0] }
}

/** Authentication is validated by FastAPI/Supabase; no password is persisted. */
export async function login(email, password) {
  const data = await apiClient('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  setAccessToken(data.access_token, data.refresh_token, data.expires_at)
  return toUser(data.user)
}

/** Create a Supabase Auth account; the browser never receives or stores a password. */
export async function signup(fullName, email, password) {
  const data = await apiClient('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ full_name: fullName, email, password }),
  })
  if (data.access_token) setAccessToken(data.access_token, data.refresh_token, data.expires_at)
  return { user: toUser(data.user), requiresEmailConfirmation: data.requires_email_confirmation }
}

export async function logout() {
  try {
    await apiClient('/api/auth/logout', { method: 'POST' })
  } catch {
    // The token is cleared locally even if the network is unavailable.
  }
  clearAccessToken()
}

export async function getCurrentUser() {
  return toUser(await apiClient('/api/profiles/me'))
}

export async function getEquipment() {
  return (await apiClient('/api/equipment')).map(toEquipment)
}

export async function getEquipmentById(equipmentId) {
  return toEquipment(await apiClient(`/api/equipment/${equipmentId}`))
}

export async function getCategories() {
  return apiClient('/api/equipment/categories')
}

export async function getMyEquipment() {
  return (await apiClient('/api/equipment/mine')).map(toEquipment)
}

export async function getMyEquipmentById(equipmentId) {
  return toEquipment(await apiClient(`/api/equipment/mine/${equipmentId}`))
}

export async function createEquipment(payload) {
  return toEquipment(await apiClient('/api/equipment', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function updateEquipment(equipmentId, payload) {
  return toEquipment(await apiClient(`/api/equipment/${equipmentId}`, { method: 'PUT', body: JSON.stringify(payload) }))
}

export async function deactivateEquipment(equipmentId) {
  await apiClient(`/api/equipment/${equipmentId}`, { method: 'DELETE' })
}

export async function createRequest(payload) {
  return toRequest(await apiClient('/api/requests', { method: 'POST', body: JSON.stringify(payload) }))
}

export async function getMyRequests() {
  return (await apiClient('/api/requests/me')).map(toRequest)
}

export async function getRequest(requestId) {
  return toRequest(await apiClient(`/api/requests/${requestId}`))
}

export async function getRequestsForMyEquipment() {
  return (await apiClient('/api/requests/for-my-equipment')).map(toRequest)
}

export async function approveOwnerRequest(requestId) {
  return toRequest(await apiClient(`/api/requests/${requestId}/approve`, { method: 'PATCH' }))
}

export async function rejectOwnerRequest(requestId, rejectionReason = '') {
  return toRequest(await apiClient(`/api/requests/${requestId}/reject`, { method: 'PATCH', body: JSON.stringify({ rejection_reason: rejectionReason || null }) }))
}

export async function getBorrowedItems() {
  return (await apiClient('/api/loans/me')).map(toLoan)
}

/** Return a database-backed loan through its originating rental request. */
export async function returnEquipment({ requestId, loanId }) {
  const path = requestId ? `/api/requests/${requestId}/return` : `/api/loans/${loanId}/return`
  return toLoan(await apiClient(path, { method: requestId ? 'PUT' : 'POST' }))
}