import CustomButton from './CustomButton'

export default function EquipmentCard({ item, onRequest, isOwner = false }) {
  const Icon = item.icon
  return <article className="flex gap-3 rounded-2xl border border-[#d6d6d6] bg-white p-3 shadow-sm">
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: item.color }}>{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={43} strokeWidth={1.7} />}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold text-[#555]">{item.category}</p>
      <h3 className="truncate text-base font-extrabold">{item.name}</h3>
      <p className="text-xs font-bold text-green-700">Available: {item.unitsAvailable} · ${item.pricePerDay}/day</p>
      <p className="mt-1 text-xs text-[#555]">Owned by: <b className="text-black">{item.ownerName}</b></p>
      {isOwner ? <p className="mt-2 text-xs font-bold text-[#777]">Your listing</p> : <CustomButton size="sm" className="mt-2" onClick={() => onRequest(item.id)}>Request now</CustomButton>}
    </div>
  </article>
}