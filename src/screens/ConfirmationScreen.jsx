import { CheckCircle2, Home, ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CustomButton from '../components/CustomButton'
import ScreenHeader from '../components/ScreenHeader'
import { NumberTicker } from '../components/ui/number-ticker'
import { useApp } from '../context/AppContext'
import { formatCurrency, getRentalDays } from '../lib/rental'

function formatDate(date) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`)) }

export default function ConfirmationScreen() {
  const { requestId } = useParams()
  const { getRequest, getRequestById, getEquipmentById, equipment } = useApp()
  const navigate = useNavigate()
  const [request, setRequest] = useState(getRequest(requestId) || null)
  const [item, setItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    async function loadConfirmation() {
      setIsLoading(true)
      setLoadError('')
      try {
        const requestData = await getRequestById(requestId)
        const equipmentData = await getEquipmentById(requestData.equipmentId)
        if (active) {
          setRequest(requestData)
          setItem(equipmentData)
        }
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load this request confirmation.')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadConfirmation()
    return () => { active = false }
  }, [requestId])

  if (isLoading) return <div className="min-h-screen bg-white"><ScreenHeader title="Request Confirmation" showBack /><div className="px-5 py-10 text-center text-sm text-[#666]">Loading request confirmation…</div></div>
  if (loadError || !request || !item) return <div className="min-h-screen bg-white"><ScreenHeader title="Request Confirmation" showBack /><div className="px-5 py-10 text-center"><p className="text-sm text-red-700">{loadError || 'Request not found.'}</p><CustomButton className="mt-4" onClick={() => navigate('/home')}>Back to Home</CustomButton></div></div>
  const Icon = item.icon
  const days = request.rentalDays ?? getRentalDays(request.startDate, request.returnDate)
  const totalCost = request.totalCost ?? item.pricePerDay * days * request.quantity
  return <div className="min-h-screen bg-white"><ScreenHeader title="Request Confirmation" showBack />
    <div className="px-7 py-9 text-center"><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full" style={{ backgroundColor: item.color }}><Icon size={74} strokeWidth={1.4} /></div><CheckCircle2 className="mx-auto mt-5 text-green-600" size={31} /><h2 className="mt-2 text-3xl font-extrabold">Request Sent!</h2><p className="mt-3 text-sm leading-6 text-[#4c4c4c]">Your request for <strong className="text-black">{item.name}</strong> is waiting to be reviewed.</p>
      <section className="mt-8 rounded-2xl bg-[#ffd400] p-5"><p className="text-xs font-bold uppercase tracking-wide">Requested Period</p><p className="mt-2 text-lg font-extrabold">{formatDate(request.startDate)} – {formatDate(request.returnDate)}</p><p className="mt-2 text-sm">Requested from: <b>{request.ownerName}</b></p><div className="mt-4 border-t border-black/15 pt-3"><span className="text-2xl font-black"><NumberTicker value={days} /></span><span className="ml-1 text-sm font-bold">day{days !== 1 ? 's' : ''} × {request.quantity} item{request.quantity !== 1 ? 's' : ''}</span><div className="mt-3 flex justify-between rounded-xl bg-white/45 px-3 py-2 text-left"><span className="font-bold">Total rental cost</span><span className="font-extrabold">{formatCurrency(totalCost)}</span></div></div></section>
      <div className="mt-7 space-y-3"><CustomButton variant="secondary" fullWidth onClick={() => navigate('/home')}><ListChecks size={18} /> Continue Browsing</CustomButton><CustomButton variant="outline" fullWidth onClick={() => navigate('/home')}><Home size={18} /> Back to Home</CustomButton></div>
    </div>
  </div>
}