import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

/** A reusable labelled input with error feedback, search icon support, and textarea mode. */
export default function CustomInput({ label, error, icon: Icon, multiline = false, rows = 3, className = '', type = 'text', ...props }) {
  const [showPassword, setShowPassword] = useState(false)
  const inputType = type === 'password' && showPassword ? 'text' : type
  const commonClass = `w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#8a8a8a] focus:border-black focus:ring-2 focus:ring-[#ffd400]/60 ${Icon ? 'pl-11' : ''} ${type === 'password' ? 'pr-11' : ''} ${error ? 'border-red-500' : 'border-[#b8b8b8]'} ${className}`

  return <label className="block text-sm font-semibold text-[#242424]">
    {label && <span className="mb-1.5 block">{label}{props.required && <span className="ml-1 text-red-600">*</span>}</span>}
    <span className="relative block">
      {Icon && <Icon size={20} className="pointer-events-none absolute left-3 top-3.5 text-black" />}
      {multiline ? <textarea rows={rows} className={commonClass} aria-invalid={Boolean(error)} {...props} /> : <input type={inputType} className={commonClass} aria-invalid={Boolean(error)} {...props} />}
      {type === 'password' && <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-3 text-[#555]" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>}
    </span>
    {error && <span className="mt-1 block text-xs font-medium text-red-600" role="alert">{error}</span>}
  </label>
}