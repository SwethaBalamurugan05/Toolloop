import { LoaderCircle } from 'lucide-react'

const variants = {
  primary: 'bg-[#ffd400] text-black border-[#ffd400] hover:bg-[#e6bd00]',
  secondary: 'bg-[#efefef] text-black border-[#efefef] hover:bg-[#dddddd]',
  outline: 'bg-white text-black border-black hover:bg-[#f8f8f8]',
  ghost: 'bg-transparent text-black border-transparent hover:bg-black/5',
}

const sizes = { sm: 'min-h-8 px-3 text-xs', md: 'min-h-11 px-5 text-sm', lg: 'min-h-13 px-6 text-base' }

/** A reusable ToolLoop pill-shaped action button. */
export default function CustomButton({ children, variant = 'primary', size = 'md', fullWidth = false, loading = false, className = '', type = 'button', ...props }) {
  return (
    <button type={type} disabled={loading || props.disabled} className={`inline-flex items-center justify-center gap-2 rounded-full border-2 font-bold transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`} {...props}>
      {loading && <LoaderCircle size={16} className="animate-spin" />}{children}
    </button>
  )
}