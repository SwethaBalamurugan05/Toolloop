import { CalendarDays, ClipboardList, PackageCheck, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import CustomButton from '../components/CustomButton'
import RequestStatusBadge from '../components/RequestStatusBadge'
import ScreenHeader from '../components/ScreenHeader'
import { useApp } from '../context/AppContext'
import { formatCurrency } from '../lib/rental'

function formatDate(date) {
  if (!date) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date.includes('T') ? date : `${date}T00:00:00`))
}

function EmptyState({ icon: Icon, title, message }) {
  return <div className="rounded-2xl border border-dashed border-[#b9b9b9] bg-[#fafafa] px-5 py-7 text-center"><Icon className="mx-auto text-[#777]" size={32} /><h3 className="mt-3 font-extrabold">{title}</h3><p className="mt-1 text-sm leading-5 text-[#666]">{message}</p></div>
}

export default function MyActivityScreen() {
  const { requests, borrowedItems, equipment, returnBorrowedItem, loadUserData, isLoadingData, dataError } = useApp()
  const [actionMessage, setActionMessage] = useState('')
  const [returningId, setReturningId] = useState('')

  useEffect(() => {
    const refresh = () => loadUserData().catch(() => {})
    refresh()
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 30000)
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [])

  const equipmentName = (equipmentId) => equipment.find((item) => item.id === equipmentId)?.name || 'Equipment'
  async function handleReturn(item) {
    setReturningId(item.id)
    setActionMessage('')
    try {
      await returnBorrowedItem(item.id)
      await loadUserData()
      setActionMessage(`${equipmentName(item.equipmentId)} was returned successfully.`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to return this item. Please try again.')
    } finally {
      setReturningId('')
    }
  }

  return <div className="min-h-screen bg-white pb-8"><ScreenHeader title="My Activity" showBack /><div className="space-y-8 px-5 pt-6">
    {actionMessage && <p className={`rounded-xl p-3 text-sm font-medium ${actionMessage.includes('successfully') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`} role="status">{actionMessage}</p>}
    {dataError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p>{dataError}</p><CustomButton size="sm" className="mt-3" onClick={() => loadUserData().catch(() => {})}>Try again</CustomButton></div>}
    <section aria-labelledby="requests-title"><div className="mb-3 flex items-center justify-between"><div><h2 id="requests-title" className="text-xl font-extrabold">My Requests</h2><p className="text-sm text-[#666]">Updates refresh automatically while this page is open.</p></div><span className="rounded-full bg-[#ffd400] px-3 py-1 text-sm font-extrabold">{requests.length}</span></div><div className="space-y-3">{isLoadingData ? <p className="rounded-2xl border border-dashed border-[#b9b9b9] p-5 text-center text-sm text-[#666]">Loading requests…</p> : requests.length === 0 ? <EmptyState icon={ClipboardList} title="No requests yet" message="Equipment requests you submit will appear here." /> : requests.map((request) => <article key={request.id} className="rounded-2xl border border-[#d6d6d6] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{request.equipmentName || equipmentName(request.equipmentId)}</h3><p className="mt-1 text-xs text-[#666]">Requested from: <b>{request.ownerName}</b> · Request #{request.requestNumber}</p></div><RequestStatusBadge status={request.status} /></div>{request.status === 'approved' && <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">Approved by equipment owner.</p>}{request.status === 'rejected' && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><p className="font-medium">Rejected by equipment owner.</p>{request.rejectionReason && <p className="mt-1"><b>Reason:</b> {request.rejectionReason}</p>}</div>}<div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e4e4e4] pt-3 text-sm"><p className="col-span-2 flex gap-2 text-[#555]"><CalendarDays size={16} /><span>Rental: <strong className="text-black">{formatDate(request.startDate)} – {formatDate(request.returnDate)}</strong></span></p><p className="text-[#555]">Quantity: <strong className="text-black">{request.quantity}</strong></p><p className="text-[#555]">Duration: <strong className="text-black">{request.rentalDays} day{request.rentalDays !== 1 ? 's' : ''}</strong></p><p className="col-span-2 text-[#555]">Total: <strong className="text-black">{formatCurrency(request.totalCost)}</strong></p></div></article>)}</div></section>
    <section aria-labelledby="borrowed-items-title"><div className="mb-3 flex items-center justify-between"><div><h2 id="borrowed-items-title" className="text-xl font-extrabold">Borrowed Items</h2><p className="text-sm text-[#666]">Items currently with you</p></div><span className="rounded-full bg-[#efefef] px-3 py-1 text-sm font-extrabold">{borrowedItems.length}</span></div><div className="space-y-3">{isLoadingData ? <p className="rounded-2xl border border-dashed border-[#b9b9b9] p-5 text-center text-sm text-[#666]">Loading borrowed items…</p> : borrowedItems.length === 0 ? <EmptyState icon={PackageCheck} title="No borrowed items" message="Approved equipment you are currently borrowing will appear here." /> : borrowedItems.map((item) => <article key={item.id} className="rounded-2xl border border-[#d6d6d6] bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{equipmentName(item.equipmentId)}</h3><p className="mt-1 text-xs font-bold text-green-700">Borrowed</p></div><span className="rounded-full bg-[#e5f7e9] px-2.5 py-1 text-xs font-bold text-green-800">Borrowed</span></div><div className="mt-4 space-y-1.5 border-t border-[#e4e4e4] pt-3 text-sm"><p className="text-[#555]">Borrowed: <strong className="text-black">{formatDate(item.borrowedDate)}</strong></p><p className="text-[#555]">Return by: <strong className="text-black">{formatDate(item.returnDate)}</strong></p></div><CustomButton size="sm" loading={returningId === item.id} disabled={Boolean(returningId)} className="mt-4" onClick={() => handleReturn(item)}><RotateCcw size={15} /> Return Item</CustomButton></article>)}</div></section>
  </div></div>
}