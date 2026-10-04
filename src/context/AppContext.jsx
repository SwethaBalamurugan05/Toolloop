import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { restoreAccessToken } from '../services/apiClient'
import * as api from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState('')
  const [requests, setRequests] = useState([])
  const [equipment, setEquipment] = useState([])
  const [borrowedItems, setBorrowedItems] = useState([])
  const [myEquipment, setMyEquipment] = useState([])
  const [ownerRequests, setOwnerRequests] = useState([])

  async function loadUserData({ throwOnError = false } = {}) {
    setIsLoadingData(true)
    setDataError('')
    try {
      const [equipmentData, requestData, loanData, mineData, ownerRequestData] = await Promise.all([api.getEquipment(), api.getMyRequests(), api.getBorrowedItems(), api.getMyEquipment(), api.getRequestsForMyEquipment()])
      setEquipment(equipmentData)
      setRequests(requestData)
      setBorrowedItems(loanData)
      setMyEquipment(mineData)
      setOwnerRequests(ownerRequestData)
    } catch (error) {
      setDataError(error.message || 'Unable to load your ToolLoop data. Please try again.')
      if (throwOnError) throw error
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    async function initializeAuth() {
      try {
        if (restoreAccessToken()) {
          const profile = await api.getCurrentUser()
          setUser(profile)
          await loadUserData()
        }
      } catch {
        await api.logout()
        setUser(null)
      } finally {
        setAuthReady(true)
      }
    }
    initializeAuth()
  }, [])

  async function login(username, password) {
    try {
      const profile = await api.login(username, password)
      setUser(profile)
      await loadUserData()
      return { success: true, user: profile }
    } catch (error) {
      if (error.status === 401) return { success: false, error: 'Invalid username or password.' }
      return { success: false, error: 'Unable to sign in. Please try again.' }
    }
  }

  async function signup(fullName, email, password) {
    try {
      const result = await api.signup(fullName, email, password)
      if (result.requiresEmailConfirmation) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: 'Account created. Check your email to confirm your account, then sign in.',
        }
      }
      setUser(result.user)
      await loadUserData()
      return { success: true, user: result.user }
    } catch (error) {
      if (error.status === 409) return { success: false, error: 'An account with this email already exists. Please log in.' }
      if (error.status === 422) return { success: false, error: 'Please check your account details and try again.' }
      return { success: false, error: 'Unable to create your account. Please try again.' }
    }
  }

  async function logout() {
    await api.logout()
    setUser(null)
    setRequests([])
    setEquipment([])
    setBorrowedItems([])
    setMyEquipment([])
    setOwnerRequests([])
  }

  async function addRequest(details) {
    const request = await api.createRequest({
      equipment_id: details.equipmentId,
      start_date: details.startDate,
      return_date: details.returnDate,
      quantity: details.quantity,
      purpose: details.purpose,
    })
    setRequests((current) => [request, ...current])
    return request
  }

  async function returnBorrowedItem(id) {
    const loan = borrowedItems.find((item) => item.id === id)
    const returnedLoan = await api.returnEquipment({ requestId: loan?.requestId, loanId: id })
    setBorrowedItems((current) => current.filter((item) => item.id !== returnedLoan.id))
    await loadUserData()
    return returnedLoan
  }

  async function getEquipmentById(id) {
    const item = await api.getEquipmentById(id)
    setEquipment((current) => current.some((entry) => entry.id === item.id) ? current.map((entry) => entry.id === item.id ? item : entry) : [...current, item])
    return item
  }

  async function getRequestById(id) {
    const request = await api.getRequest(id)
    setRequests((current) => current.some((entry) => entry.id === request.id) ? current.map((entry) => entry.id === request.id ? request : entry) : [request, ...current])
    return request
  }

  const value = useMemo(() => ({
    user, authReady, isLoadingData, dataError, login, signup, logout, equipment, requests, myEquipment, ownerRequests, addRequest, borrowedItems, returnBorrowedItem, loadUserData, getEquipmentById, getRequestById,
    getRequest: (id) => requests.find((request) => request.id === id),
    pendingCount: requests.filter((request) => request.status === 'pending').length,
    borrowedCount: borrowedItems.length,
  }), [user, authReady, isLoadingData, dataError, requests, equipment, borrowedItems])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}