const styles = {
  pending: 'bg-[#fff6c7] text-[#8a6500]',
  approved: 'bg-[#e5f7e9] text-green-800',
  rejected: 'bg-red-50 text-red-700',
  returned: 'bg-[#eeeeee] text-[#555]',
  cancelled: 'bg-[#eeeeee] text-[#555]',
  issued: 'bg-blue-50 text-blue-700',
}

export default function RequestStatusBadge({ status }) {
  const label = `${status || 'pending'}`.replace(/^./, (letter) => letter.toUpperCase())
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${styles[status] || styles.pending}`}>{label}</span>
}