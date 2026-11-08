import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Camera, Image as ImageIcon, Loader2, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  ParseFailedError,
  isImageQualityFailure,
  createBlankReceipt,
  uploadAndParseReceipt,
} from '@/hooks/useReceipts'
import { Button } from '@/components/ui/button'

type Phase = 'select' | 'processing' | 'error'

const MIN_LOADING_MS = 3000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function UploadReceipt() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('select')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined)

  // Revoke the object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function processFile(file: File) {
    if (!user) return
    if (!navigator.onLine) {
      toast.error("No internet connection. Please try again when you're online.")
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    setPendingFile(file)
    setReceiptId(null)
    setPhase('processing')

    try {
      // Keep the loading state up for at least MIN_LOADING_MS so the UX
      // doesn't flash on fast responses.
      const [result] = await Promise.all([
        uploadAndParseReceipt(file, user.id),
        sleep(MIN_LOADING_MS),
      ])
      navigate(`/review/${result.receiptId}`, {
        state: { parsed: result.parsed },
      })
    } catch (err) {
      if (err instanceof ParseFailedError) {
        setReceiptId(err.receiptId)
        setErrorCode(err.code)
      } else {
        setErrorCode(undefined)
      }
      setPhase('error')
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = ''
    if (file) processFile(file)
  }

  function retry() {
    if (pendingFile) processFile(pendingFile)
    else setPhase('select')
  }

  async function enterManually() {
    if (!user) return
    try {
      const id = receiptId ?? (await createBlankReceipt(user.id))
      navigate(`/review/${id}`, { state: { parsed: null } })
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
  }

  return (
    <div
      className="mx-auto flex min-h-[100svh] w-full max-w-app flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="relative flex items-center justify-center px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="absolute left-2 flex h-12 w-12 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Add Receipt</h1>
      </header>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        className="hidden"
        onChange={onInputChange}
      />

      <div className="flex flex-1 flex-col px-4 pb-8">
        {phase === 'select' && (
          <div className="flex flex-col gap-4">
            <UploadCard
              icon={<Camera className="h-8 w-8 text-primary" />}
              title="Take a Photo"
              subtitle="Use your camera"
              onClick={() => cameraInputRef.current?.click()}
            />
            <UploadCard
              icon={<ImageIcon className="h-8 w-8 text-primary" />}
              title="Upload from Gallery"
              subtitle="Choose an existing photo"
              onClick={() => galleryInputRef.current?.click()}
            />
          </div>
        )}

        {previewUrl && phase !== 'select' && (
          <div className="mb-4 overflow-hidden rounded-xl bg-muted">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="mx-auto max-h-[280px] w-full object-contain"
            />
          </div>
        )}

        {phase === 'processing' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-card">
            <Loader2 className="h-8 w-8 animate-spin text-success" />
            <div>
              <p className="text-base font-bold text-foreground">
                Analysing your receipt...
              </p>
              <p className="text-sm text-muted-foreground">
                Our AI is reading the details
              </p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-card">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-base font-bold text-foreground">
                {isImageQualityFailure(errorCode)
                  ? "Couldn't read this receipt"
                  : 'Receipt scanning is unavailable'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isImageQualityFailure(errorCode)
                  ? 'The image may be blurry or too dark. You can enter the details manually.'
                  : 'This is a problem on our side, not with your photo. You can enter the details manually.'}
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2">
              <Button onClick={retry} className="h-12 w-full rounded-lg">
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={enterManually}
                className="h-12 w-full rounded-lg"
              >
                Enter manually
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface UploadCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}

function UploadCard({ icon, title, subtitle, onClick }: UploadCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 w-full items-center gap-4 rounded-xl border-[1.5px] border-border bg-card px-5 text-left"
    >
      {icon}
      <div>
        <p className="text-lg font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  )
}
