import { CalendarDays, MapPin, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CustomButton from '../components/CustomButton'
import CustomInput from '../components/CustomInput'
import ScreenHeader from '../components/ScreenHeader'
import { useApp } from '../context/AppContext'
import { formatCurrency, getRentalDays, getTotalRentalCost } from '../lib/rental'

const today = new Date().toISOString().split('T')[0]

export default function RequestEquipmentScreen() {
  const { equipmentId } = useParams()
  const { equipment, addRequest, getEquipmentById, user } = useApp()
  const navigate = useNavigate()
  const cachedItem = equipment.find((entry) => entry.id === equipmentId)
  const [item, setItem] = useState(cachedItem || null)
  const [isLoadingItem, setIsLoadingItem] = useState(!cachedItem)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [values, setValues] = useState({ startDate: '', returnDate: '', quantity: 1, purpose: '' })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let active = true
    async function loadItem() {
      setIsLoadingItem(true)
      setLoadError('')
      try {
        const data = await getEquipmentById(equipmentId)
        if (active) setItem(data)
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load this equipment item.')
      } finally {
        if (active) setIsLoadingItem(false)
      }
    }
    loadItem()
    return () => { active = false }
  }, [equipmentId])

  if (isLoadingItem) return <div className="min-h-screen bg-white"><ScreenHeader title="Request Equipment" showBack /><div className="px-5 py-10 text-center text-sm text-[#666]">Loading equipment…</div></div>
  if (loadError || !item) return <div className="min-h-screen bg-white"><ScreenHeader title="Request Equipment" showBack /><div className="px-5 py-10 text-center"><p className="text-sm text-red-700">{loadError || 'Equipment item not found.'}</p><CustomButton className="mt-4" onClick={() => navigate('/home')}>Back to Home</CustomButton></div></div>
  if (item.ownerId === user.id) return <div className="min-h-screen bg-white"><ScreenHeader title="Your Equipment" showBack /><div className="px-5 py-10 text-center"><p className="text-sm text-[#555]">You cannot request equipment you own. Manage this listing from My Equipment.</p><CustomButton className="mt-4" onClick={() => navigate('/my-equipment')}>My Equipment</CustomButton></div></div>
  const Icon = item.icon
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value })

  function validate(formValues = values) {
    const next = {}
    if (!formValues.startDate) next.startDate = 'Select a start date.'
    else if (formValues.startDate < today) next.startDate = 'Start date cannot be in the past.'
    if (!formValues.returnDate) next.returnDate = 'Select a return date.'
    else if (formValues.startDate && formValues.returnDate <= formValues.startDate) next.returnDate = 'Return date must be after the start date.'
    else if (formValues.startDate) {
      const days = getRentalDays(formValues.startDate, formValues.returnDate)
      if (days > item.borrowingLimit) next.returnDate = `Borrowing limit is ${item.borrowingLimit} days.`
    }
    if (!Number.isInteger(Number(formValues.quantity)) || Number(formValues.quantity) < 1 || Number(formValues.quantity) > item.unitsAvailable) next.quantity = `Choose a whole number from 1 to ${item.unitsAvailable}.`
    if (formValues.purpose.trim().length < 10) next.purpose = 'Tell us your purpose in at least 10 characters.'
    return next
  }
  const liveErrors = validate()
  const rentalDays = getRentalDays(values.startDate, values.returnDate)
  const totalCost = getTotalRentalCost(item.pricePerDay, rentalDays, values.quantity)
  const hasValidRentalDetails = !liveErrors.startDate && !liveErrors.returnDate && !liveErrors.quantity
  const formIsValid = Object.keys(liveErrors).length === 0
  async function submit(event) {
    event.preventDefault()
    const next = validate(); setErrors(next)
    if (Object.keys(next).length) return
    try {
      setIsSubmitting(true)
      const request = await addRequest({ equipmentId: item.id, startDate: values.startDate, returnDate: values.returnDate, quantity: Number(values.quantity), purpose: values.purpose })
      navigate(`/confirmation/${request.id}`)
    } catch (error) {
      setErrors({ purpose: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }
  function changeQuantity(amount) {
    setValues((current) => {
      const currentQuantity = Number.isInteger(Number(current.quantity)) ? Number(current.quantity) : 1
      return { ...current, quantity: Math.max(1, Math.min(item.unitsAvailable, currentQuantity + amount)) }
    })
  }

  return <div className="min-h-screen bg-white pb-8"><ScreenHeader title="Request Equipment" showBack />
    <div className="px-5 pt-5">
      <section className="flex gap-4 border-b border-[#ddd] pb-5"><div className="flex-1"><h2 className="text-2xl font-extrabold">{item.name}</h2><p className="mt-1 font-bold text-green-700">Available <span className="text-black">${item.pricePerDay}/day</span></p><p className="mt-3 text-sm"><b>Condition:</b> {item.condition}</p><p className="text-sm"><b>Limit:</b> {item.borrowingLimit} days</p></div><div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: item.color }}>{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={62} strokeWidth={1.5} />}</div></section>
      <p className="mt-4 text-sm leading-5 text-[#444]">{item.description}</p><p className="mt-2 text-sm">Owned by: <b>{item.ownerName}</b></p><p className="mt-3 flex gap-1 text-xs font-semibold text-[#555]"><MapPin size={15} /> Pickup: {item.pickupAddress}</p>
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-3"><CustomInput label="Start Date" name="startDate" type="date" min={today} value={values.startDate} onChange={update} error={errors.startDate} required /><CustomInput label="Return Date" name="returnDate" type="date" min={values.startDate || today} value={values.returnDate} onChange={update} error={errors.returnDate} required /></div>
        <div><p className="mb-1.5 text-sm font-semibold">Quantity <span className="text-red-600">*</span></p><div className={`flex max-w-56 items-center rounded-xl border bg-white p-1 ${errors.quantity ? 'border-red-500' : 'border-[#b8b8b8]'}`}><button type="button" onClick={() => changeQuantity(-1)} aria-label="Decrease quantity" className="rounded-lg p-2 hover:bg-[#eee]"><Minus size={18} /></button><input aria-label="Quantity" type="number" min="1" max={item.unitsAvailable} step="1" value={values.quantity} onChange={update} name="quantity" className="w-full bg-transparent text-center font-extrabold outline-none" /><button type="button" onClick={() => changeQuantity(1)} aria-label="Increase quantity" className="rounded-lg p-2 hover:bg-[#eee]"><Plus size={18} /></button></div>{errors.quantity && <p className="mt-1 text-xs font-medium text-red-600">{errors.quantity}</p>}</div>
        <CustomInput label="Purpose" name="purpose" multiline rows={3} maxLength={200} placeholder="What will you use it for?" value={values.purpose} onChange={update} error={errors.purpose} required />
        {hasValidRentalDetails && <section className="rounded-2xl border-2 border-black bg-[#fff6c7] p-4" aria-live="polite"><p className="text-xs font-bold uppercase tracking-wide text-[#5a4b00]">Rental summary</p><h3 className="mt-1 text-lg font-extrabold">{item.name}</h3><dl className="mt-3 space-y-1.5 text-sm"><div className="flex justify-between"><dt>Price per day</dt><dd className="font-bold">{formatCurrency(item.pricePerDay)}</dd></div><div className="flex justify-between"><dt>Rental days</dt><dd className="font-bold">{rentalDays}</dd></div><div className="flex justify-between"><dt>Quantity</dt><dd className="font-bold">{values.quantity}</dd></div><div className="mt-2 flex justify-between border-t border-black/20 pt-2 text-base"><dt className="font-extrabold">Total cost</dt><dd className="font-extrabold">{formatCurrency(totalCost)}</dd></div></dl></section>}
        <p className="rounded-xl bg-[#fff6c7] p-3 text-xs leading-5">Please handle the equipment with care and return it on time. The equipment owner will review your request.</p>
        <CustomButton type="submit" fullWidth size="lg" loading={isSubmitting} disabled={!formIsValid || isSubmitting} title={!formIsValid ? 'Complete the required fields to submit your request.' : undefined}><CalendarDays size={18} /> Submit Request</CustomButton>
      </form>
    </div>
  </div>
}