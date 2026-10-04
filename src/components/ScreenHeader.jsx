import { ArrowLeft, Home } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Shared yellow ToolLoop header used on the browse, request and confirmation pages. */
export default function ScreenHeader({ title, subtitle, hero = false, showBack = false, rightSlot }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showHome = location.pathname !== '/home'
  return <header className={`bg-[#ffd400] ${hero ? 'px-6 pb-7 pt-6' : 'flex min-h-28 items-center gap-3 px-5 pt-3'}`}>
    {!hero && showBack && <button type="button" aria-label="Go back" onClick={() => navigate(-1)} className="rounded-full p-2 transition hover:bg-black/10"><ArrowLeft size={28} strokeWidth={3} /></button>}
    <div className="flex-1">{subtitle && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/60">{subtitle}</p>}<h1 className={`${hero ? 'text-3xl leading-tight' : 'text-2xl'} font-extrabold tracking-tight`}>{title}</h1></div>
    {showHome && <button type="button" aria-label="Go to Home" title="Home" onClick={() => navigate('/home')} className="rounded-full p-2 transition hover:bg-black/10"><Home size={24} strokeWidth={2.5} /></button>}
    {rightSlot && <div>{rightSlot}</div>}
  </header>
}