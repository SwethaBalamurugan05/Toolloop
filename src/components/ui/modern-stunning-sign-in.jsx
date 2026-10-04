import { Eye, EyeOff, LockKeyhole, Mail, ToolCase, Wrench } from 'lucide-react'
import { useState } from 'react'
import CustomButton from '../CustomButton'
import CustomInput from '../CustomInput'

// Source: "Modern Stunning Sign In" from 21st.dev (HextaUI).
// The original component used remote logo/avatar SVGs. It has been adapted for
// ToolLoop with Lucide icons, ToolLoop colours, and an onSignIn callback.
// Component source supplied for this assignment on 12 September 2026.

/**
 * A ToolLoop-branded version of the 21st.dev Modern Stunning Sign In component.
 * @param {{ onSignIn: (email: string, password: string) => Promise<{success: boolean, errors?: object, error?: string}>, initialEmail?: string }} props
 */
export function SignIn1({ onSignIn, onSignUp, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [signupValues, setSignupValues] = useState({ fullName: '', email: initialEmail, password: '', confirmPassword: '' })
  const [signupErrors, setSignupErrors] = useState({})
  const [signupNotice, setSignupNotice] = useState('')

  async function handleSignIn(event) {
    event?.preventDefault()
    setIsSubmitting(true)
    const result = await onSignIn(email.trim(), password)
    setErrors(result.errors ?? (result.error ? { form: result.error } : {}))
    setIsSubmitting(false)
  }

  function updateSignup(event) {
    const { name, value } = event.target
    setSignupValues((current) => ({ ...current, [name]: value }))
    setSignupErrors((current) => ({ ...current, [name]: '', form: '' }))
    setSignupNotice('')
  }

  async function handleSignUp(event) {
    event.preventDefault()
    const nextErrors = {}
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupValues.email.trim())
    if (signupValues.fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name (at least 2 characters).'
    if (!signupValues.email.trim()) nextErrors.email = 'Email is required.'
    else if (!validEmail) nextErrors.email = 'Enter a valid email address.'
    if (!signupValues.password) nextErrors.password = 'Password is required.'
    else if (signupValues.password.length < 6) nextErrors.password = 'Password must be at least 6 characters.'
    if (!signupValues.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password.'
    else if (signupValues.confirmPassword !== signupValues.password) nextErrors.confirmPassword = 'Passwords do not match.'
    setSignupErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setIsSubmitting(true)
    const result = await onSignUp(signupValues.fullName.trim(), signupValues.email.trim(), signupValues.password)
    setIsSubmitting(false)
    if (!result.success) {
      setSignupErrors(result.errors ?? { form: result.error || 'Unable to create your account. Please try again.' })
      return
    }
    if (result.requiresEmailConfirmation) {
      setEmail(signupValues.email.trim())
      setPassword('')
      setSignupNotice(result.message)
    }
  }

  if (isCreatingAccount) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#2b3036] px-5 py-8 sm:min-h-[calc(100vh-32px)]">
        <div className="w-full max-w-sm rounded-[28px] border border-white/15 bg-white p-6 shadow-2xl sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd400] text-black shadow-lg"><ToolCase size={29} strokeWidth={2.3} aria-hidden="true" /></div>
          <p className="text-center text-3xl font-black tracking-tight"><span className="text-[#e5b900]">Tool</span>Loop</p>
          <h1 className="mt-5 text-center text-xl font-extrabold text-black">Create your account</h1>
          <p className="mt-1 text-center text-sm leading-5 text-[#666]">Join your community equipment-lending platform.</p>
          <form className="mt-6 flex w-full flex-col gap-4" onSubmit={handleSignUp} noValidate>
            <CustomInput label="Full Name" name="fullName" value={signupValues.fullName} onChange={updateSignup} error={signupErrors.fullName} placeholder="Your full name" autoComplete="name" required />
            <CustomInput label="Email" name="email" type="email" value={signupValues.email} onChange={updateSignup} error={signupErrors.email} placeholder="Email address" autoComplete="email" required />
            <CustomInput label="Password" name="password" type="password" value={signupValues.password} onChange={updateSignup} error={signupErrors.password} placeholder="At least 6 characters" autoComplete="new-password" required />
            <CustomInput label="Confirm Password" name="confirmPassword" type="password" value={signupValues.confirmPassword} onChange={updateSignup} error={signupErrors.confirmPassword} placeholder="Enter your password again" autoComplete="new-password" required />
            {signupErrors.form && <p className="-mt-1 text-left text-sm font-medium text-red-600" role="alert">{signupErrors.form}</p>}
            {signupNotice && <p className="-mt-1 rounded-xl bg-[#fff6c7] p-3 text-left text-sm font-medium text-[#5a4b00]" role="status">{signupNotice}</p>}
            <CustomButton type="submit" fullWidth loading={isSubmitting}>Create Account</CustomButton>
          </form>
          <p className="mt-5 text-center text-sm text-[#666]">Already have an account? <button type="button" onClick={() => { setIsCreatingAccount(false); setErrors({}) }} className="font-extrabold text-black underline decoration-[#ffd400] decoration-2 underline-offset-4 hover:text-[#5a4b00]">Log in</button></p>
        </div>
        <div className="mt-7 flex max-w-sm items-center gap-3 text-center text-sm text-white/80"><div className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2b3036] bg-[#ffd400]"><Wrench size={14} /></span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2b3036] bg-white text-black"><ToolCase size={14} /></span></div><p>Join students sharing useful equipment.</p></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#2b3036] px-5 py-8 sm:min-h-[calc(100vh-32px)]">
      <div className="w-full max-w-sm rounded-[28px] border border-white/15 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd400] text-black shadow-lg">
          <ToolCase size={29} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <p className="text-center text-3xl font-black tracking-tight"><span className="text-[#e5b900]">Tool</span>Loop</p>
        <h1 className="mt-5 text-center text-xl font-extrabold text-black">Welcome back</h1>
        <p className="mt-1 text-center text-sm leading-5 text-[#666]">Sign in to borrow equipment from your community.</p>

        <form className="mt-6 flex w-full flex-col gap-4" onSubmit={handleSignIn} noValidate>
          <label className="relative block">
            <span className="sr-only">Email address</span>
            <Mail size={19} className="pointer-events-none absolute left-4 top-3.5 text-[#555]" aria-hidden="true" />
            <input placeholder="Email address" type="email" value={email} autoComplete="email" aria-invalid={Boolean(errors.username)} className={`w-full rounded-xl border bg-white py-3 pl-11 pr-4 text-sm text-black outline-none transition placeholder:text-[#888] focus:border-black focus:ring-2 focus:ring-[#ffd400]/70 ${errors.username ? 'border-red-500' : 'border-[#cfcfcf]'}`} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, username: '', form: '' })) }} />
          </label>
          {errors.username && <p className="-mt-2 text-left text-sm font-medium text-red-600" role="alert">{errors.username}</p>}
          <label className="relative block">
            <span className="sr-only">Password</span>
            <LockKeyhole size={19} className="pointer-events-none absolute left-4 top-3.5 text-[#555]" aria-hidden="true" />
            <input placeholder="Password (at least 6 characters)" type={showPassword ? 'text' : 'password'} value={password} autoComplete="current-password" aria-invalid={Boolean(errors.password)} className={`w-full rounded-xl border bg-white py-3 pl-11 pr-11 text-sm text-black outline-none transition placeholder:text-[#888] focus:border-black focus:ring-2 focus:ring-[#ffd400]/70 ${errors.password ? 'border-red-500' : 'border-[#cfcfcf]'}`} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: '', form: '' })) }} />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 rounded-lg p-1.5 text-[#555] hover:bg-[#f1f1f1]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </label>
          {errors.password && <p className="-mt-2 text-left text-sm font-medium text-red-600" role="alert">{errors.password}</p>}
          {errors.form && <p className="-mt-1 text-left text-sm font-medium text-red-600" role="alert">{errors.form}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#ffd400] px-5 py-3 text-sm font-extrabold text-black shadow transition hover:bg-[#e6bd00] focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Signing in…' : 'Sign in to ToolLoop'}</button>
        </form>

        <p className="mt-5 text-center text-sm text-[#666]">Don&apos;t have an account? <button type="button" onClick={() => { setIsCreatingAccount(true); setSignupErrors({}); setSignupNotice('') }} className="font-extrabold text-black underline decoration-[#ffd400] decoration-2 underline-offset-4 hover:text-[#5a4b00]">Create Account</button></p>
      </div>
      <div className="mt-7 flex max-w-sm items-center gap-3 text-center text-sm text-white/80"><div className="flex -space-x-2"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2b3036] bg-[#ffd400]"><Wrench size={14} /></span><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2b3036] bg-white text-black"><ToolCase size={14} /></span></div><p>Join students sharing useful equipment.</p></div>
    </div>
  )
}

export default SignIn1