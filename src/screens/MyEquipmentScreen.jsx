import { ClipboardList, Pencil, PlusCircle, Power } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CustomButton from '../components/CustomButton'
import ScreenHeader from '../components/ScreenHeader'
import { useApp } from '../context/AppContext'
import { deactivateEquipment } from '../services/api'

export default function MyEquipmentScreen() {
  const { myEquipment, loadUserData, isLoadingData } = useApp()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [removing, setRemoving] = useState('')
  useEffect(() => { loadUserData().catch(() => {}) }, [])
  async function deactivate(item) {
    if (!window.confirm(`Deactivate ${item.name}? It will no longer be available for new requests.`)) return
    setRemoving(item.id); setMessage('')
    try { await deactivateEquipment(item.id); await loadUserData(); setMessage(`${item.name} was deactivated.`) } catch (error) { setMessage(error.message || 'Unable to deactivate this listing.') } finally { setRemoving('') }
  }
  return <div className="min-h-screen bg-white pb-8"><ScreenHeader title="My Equipment" showBack rightSlot={<button type="button" onClick={() => navigate('/equipment/new')} className="rounded-full bg-black px-3 py-2 text-xs font-bold text-white">Post Equipment</button>} /><div className="px-5 pt-5">
    {message && <p className="mb-4 rounded-xl bg-[#fff6c7] p-3 text-sm font-medium" role="status">{message}</p>}
    <div className="mb-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => navigate('/equipment/new')} className="rounded-2xl bg-[#ffd400] p-4 text-left"><PlusCircle size={24} /><p className="mt-2 font-extrabold">Post Equipment</p></button><button type="button" onClick={() => navigate('/my-equipment/requests')} className="rounded-2xl bg-black p-4 text-left text-white"><ClipboardList size={24} /><p className="mt-2 font-extrabold">Requests for Mine</p></button></div>
    <h2 className="text-xl font-extrabold">Your Listings</h2><p className="mt-1 text-sm text-[#666]">Only you can manage equipment you posted.</p>
    <div className="mt-4 space-y-3">{isLoadingData ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-[#666]">Loading your equipment…</p> : myEquipment.length === 0 ? <div className="rounded-2xl border border-dashed p-7 text-center"><p className="font-extrabold">No equipment posted yet</p><p className="mt-1 text-sm text-[#666]">List an item for other ToolLoop users to rent.</p><CustomButton className="mt-4" onClick={() => navigate('/equipment/new')}>Post Equipment</CustomButton></div> : myEquipment.map((item) => <article key={item.id} className="rounded-2xl border border-[#d6d6d6] p-4 shadow-sm"><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold text-[#666]">{item.category} · {item.isActive ? 'Active' : 'Inactive'}</p><h3 className="text-lg font-extrabold">{item.name}</h3><p className="mt-1 text-sm text-[#555]">{item.description}</p></div><p className="whitespace-nowrap text-sm font-extrabold">${item.pricePerDay}/day</p></div><p className="mt-3 text-sm">Available: <b>{item.unitsAvailable}</b> of {item.totalUnits}</p><div className="mt-4 flex gap-2"><CustomButton size="sm" variant="outline" onClick={() => navigate(`/my-equipment/${item.id}/edit`)}><Pencil size={15} /> Edit</CustomButton>{item.isActive && <CustomButton size="sm" variant="secondary" loading={removing === item.id} onClick={() => deactivate(item)}><Power size={15} /> Deactivate</CustomButton>}</div></article>)}</div>
  </div></div>
}