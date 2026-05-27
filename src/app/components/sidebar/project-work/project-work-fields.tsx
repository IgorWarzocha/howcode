import { Search } from 'lucide-react'
import { type RefObject, useEffect, useRef } from 'react'

export function SearchHistoryField({
  inputRef,
  searchQuery,
  onSearchQueryChange,
}: {
  inputRef?: RefObject<HTMLInputElement | null>
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}) {
  return (
    <label
      className="sidebar-search-field sidebar-project-work-search-field"
      data-active={searchQuery.trim().length > 0 ? 'true' : 'false'}
    >
      <Search size={14} className="sidebar-search-icon" />
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || searchQuery.length === 0) return
          event.stopPropagation()
          onSearchQueryChange('')
        }}
        placeholder="Search history"
        className="sidebar-search-input"
        aria-label="Search history"
      />
    </label>
  )
}

export function ProjectRenameField({
  projectName,
  renameDraft,
  onCancel,
  onChange,
  onSubmit,
}: {
  projectName: string
  renameDraft: string
  onCancel: () => void
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const submittedRef = useRef(false)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submitOnce = () => {
    if (submittedRef.current) return
    submittedRef.current = true
    onSubmit()
  }

  return (
    <input
      ref={inputRef}
      className="sidebar-project-work-project-rename-input"
      value={renameDraft}
      onBlur={submitOnce}
      onChange={(event) => {
        submittedRef.current = false
        onChange(event.target.value)
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          submitOnce()
        }
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
      aria-label={`Rename ${projectName}`}
    />
  )
}
