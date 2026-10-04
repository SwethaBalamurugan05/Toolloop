import { Bell, ClipboardList, Menu, PlusCircle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CustomInput from '../components/CustomInput'
import EquipmentCard from '../components/EquipmentCard'
import ScreenHeader from '../components/ScreenHeader'
import { ButtonColorful } from '../components/ui/button-colorful'
import { NumberTicker } from '../components/ui/number-ticker'
import { useApp } from '../context/AppContext'
import { filterMarketplaceEquipment } from '../lib/rental'

export default function HomeScreen() {
  const { equipment, user, pendingCount, borrowedCount, logout, isLoadingData, dataError, loadUserData } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const marketplaceEquipment = useMemo(
    () => equipment.filter((item) => String(item.ownerId) !== String(user.id)),
    [equipment, user.id],
  )
  const filteredItems = useMemo(
    () => filterMarketplaceEquipment(marketplaceEquipment, user.id, category, search),
    [marketplaceEquipment, user.id, search, category],
  )

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return <div className="min-h-screen bg-[#fff] pb-8">
    <ScreenHeader hero title={<>Good morning,<br />{user.name}.</>} rightSlot={<div className="flex w-full items-center gap-2"><Menu size={22} /><Bell size={21} /><ButtonColorful label="Logout" onClick={handleLogout} aria-label="Logout" title="Logout" className="ml-auto shrink-0" /></div>} />
    <div className="px-5 pt-5">
      <CustomInput aria-label="Search equipment" placeholder="Search equipment, e.g. Drill, Projector" value={search} onChange={(e) => setSearch(e.target.value)} icon={Search} />
      <div className="mt-5 flex items-center justify-between"><h2 className="text-xl font-extrabold">Categories</h2><span className="text-sm font-bold text-[#288dc6]">See all</span></div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Equipment categories">
        {['All', ...new Set(marketplaceEquipment.map((item) => item.category))].map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${category === item ? 'bg-black text-white' : 'bg-[#ededed] text-black'}`}>{item}</button>)}
      </div>
      <section className="mt-5" aria-label="Your request summary">
        <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => navigate('/activity')} className="rounded-2xl bg-[#ffd400] p-4 text-left transition hover:bg-[#e6bd00]"><p className="text-3xl font-black"><NumberTicker value={pendingCount} /></p><p className="mt-1 text-xs font-bold">Pending Requests</p></button><button type="button" onClick={() => navigate('/activity')} className="rounded-2xl bg-[#f0f0f0] p-4 text-left transition hover:bg-[#e4e4e4]"><p className="text-3xl font-black"><NumberTicker value={borrowedCount} /></p><p className="mt-1 text-xs font-bold">Borrowed Items</p></button></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => navigate('/activity')} className="flex items-center justify-center gap-2 rounded-xl border border-black bg-white py-2.5 text-sm font-extrabold transition hover:bg-[#f5f5f5]"><ClipboardList size={18} /> My Activity</button><button type="button" onClick={() => navigate('/my-equipment')} className="flex items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-extrabold text-white"><PlusCircle size={18} /> My Equipment</button></div>
      </section>
      <div className="mt-7 flex items-center justify-between"><h2 className="text-xl font-extrabold">Available Near You</h2><span className="text-sm font-bold text-[#288dc6]">See all</span></div>
      <div className="mt-3 space-y-3">
        {isLoadingData ? <div className="rounded-2xl border border-dashed border-[#aaa] p-8 text-center text-sm text-[#666]">Loading equipment…</div> : dataError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"><p>{dataError}</p><button type="button" onClick={() => loadUserData().catch(() => {})} className="mt-3 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white">Try again</button></div> : filteredItems.length ? filteredItems.map((item) => <EquipmentCard key={item.id} item={item} onRequest={(id) => navigate(`/request/${id}`)} />) : <div className="rounded-2xl border border-dashed border-[#aaa] p-8 text-center text-sm text-[#666]">No equipment from other members matches your search.</div>}
      </div>
    </div>
  </div>
}