import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NativeAskQuestion } from '../../../desktop/types'
import { cn } from '../../../utils/cn'

type AskQuestionsCardProps = {
  composerDraft: string
  questions: NativeAskQuestion[]
  onUseComposerDraft: () => string
  onAnswered?: (answers: string[][]) => boolean | Promise<boolean>
  onDismiss?: () => boolean | Promise<boolean>
  registerArrowNavigation?: (handler: ((direction: 'previous' | 'next') => boolean) | null) => void
  registerComposerSubmit?: (handler: (() => boolean) | null) => void
}

function getInitialAnswers(questions: NativeAskQuestion[]) {
  return questions.map(() => [] as string[])
}

const askQuestionsCardClass =
  'relative mx-auto grid w-full max-w-[664px] content-start gap-2 rounded-t-xl rounded-b-none border border-[color:var(--border)] bg-[color:var(--panel)] px-3 pt-2.5 pb-4'

function getQuestionOptionRowClass(input: { isOther: boolean; picked: boolean }) {
  const pickedOtherClass = input.picked
    ? 'text-[color:var(--text)]'
    : 'text-[color:var(--muted)] opacity-55'
  const pickedOptionClass = input.picked
    ? 'bg-[color:var(--accent-bg)] text-[color:var(--text)]'
    : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]'
  return cn(
    'grid grid-cols-[16px_minmax(0,1fr)_auto] gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] leading-4 transition-colors',
    input.isOther ? pickedOtherClass : pickedOptionClass,
  )
}

function QuestionOptionMark({
  isOther,
  multiple,
  picked,
}: {
  isOther: boolean
  multiple: boolean
  picked: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center self-start',
        isOther
          ? picked
            ? 'text-[color:var(--accent)]'
            : 'text-transparent'
          : cn(
              'border',
              multiple ? 'rounded' : 'rounded-full',
              picked
                ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
                : 'border-[color:var(--border-strong)] text-transparent',
            ),
      )}
    >
      <Check size={11} />
    </span>
  )
}

export function AskQuestionsCard({
  composerDraft,
  questions,
  onUseComposerDraft,
  onAnswered,
  onDismiss,
  registerArrowNavigation,
  registerComposerSubmit,
}: AskQuestionsCardProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [answers, setAnswers] = useState<string[][]>(() => getInitialAnswers(questions))
  const [customAnswers, setCustomAnswers] = useState<string[]>(() => questions.map(() => ''))
  const [dismissed, setDismissed] = useState(false)
  const question = questions[activeIndex]
  const reviewIndex = questions.length
  const onReview = activeIndex === reviewIndex

  const setQuestionAnswers = (next: string[]) => {
    setAnswers((current) => current.map((answer, index) => (index === activeIndex ? next : answer)))
  }

  const setQuestionCustomAnswer = (next: string) => {
    setCustomAnswers((current) =>
      current.map((answer, index) => (index === activeIndex ? next : answer)),
    )
  }

  const closeCard = async ({ notifyDismiss = true }: { notifyDismiss?: boolean } = {}) => {
    const ok = notifyDismiss ? ((await onDismiss?.()) ?? true) : true
    if (ok) setDismissed(true)
  }

  const advance = () => {
    setActiveIndex((index) => Math.min(reviewIndex, index + 1))
  }

  const submitComposerDraft = () => {
    if (onReview) {
      void (async () => {
        const ok = (await onAnswered?.(answers)) ?? true
        if (ok) await closeCard({ notifyDismiss: false })
      })()
      return true
    }

    const value = onUseComposerDraft().trim()
    const previousCustomAnswer = customAnswers[activeIndex]?.trim() ?? ''
    if (!value) {
      if (previousCustomAnswer && question?.multiple) {
        setQuestionAnswers(
          (answers[activeIndex] ?? []).filter((item) => item !== previousCustomAnswer),
        )
        setQuestionCustomAnswer('')
      }
      advance()
      return true
    }
    const current = answers[activeIndex] ?? []
    setQuestionAnswers(
      question?.multiple
        ? [...current.filter((item) => item !== value && item !== previousCustomAnswer), value]
        : [value],
    )
    setQuestionCustomAnswer(value)
    advance()
    return true
  }

  useEffect(() => {
    registerComposerSubmit?.(submitComposerDraft)
    return () => registerComposerSubmit?.(null)
  })

  useEffect(() => {
    registerArrowNavigation?.((direction) => {
      setActiveIndex((index) => {
        if (direction === 'previous') return Math.max(0, index - 1)
        return Math.min(reviewIndex, index + 1)
      })
      return true
    })
    return () => registerArrowNavigation?.(null)
  }, [registerArrowNavigation, reviewIndex])

  useEffect(() => {
    setActiveIndex(0)
    setAnswers(getInitialAnswers(questions))
    setCustomAnswers(questions.map(() => ''))
    setDismissed(false)
  }, [questions])

  if (dismissed || questions.length === 0) {
    return null
  }

  if (onReview) {
    return (
      <div className={askQuestionsCardClass}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2">
          <div className="truncate text-[13px] leading-5 text-[color:var(--text)]">
            Review answers
          </div>

          <div className="flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--muted)]">
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              aria-label="Previous question"
            >
              &lt;
            </button>
            <span className="min-w-7 text-center tabular-nums">
              {reviewIndex + 1}/{reviewIndex + 1}
            </span>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-35"
              disabled
              aria-label="Next question"
            >
              &gt;
            </button>
          </div>
        </div>

        <div className="grid gap-0.5">
          {questions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="grid grid-cols-[minmax(0,1fr)] rounded-lg px-2 py-1.5 text-left text-[12px] leading-4 text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
              onClick={() => setActiveIndex(index)}
            >
              <span className="truncate text-[color:var(--text)]">{item.question}</span>
              <span className="truncate">{answers[index]?.join(', ') || 'No answer'}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!question) return null

  const toggleOption = (label: string) => {
    const current = answers[activeIndex] ?? []
    if (question.multiple) {
      setQuestionAnswers(
        current.includes(label)
          ? current.filter((answer) => answer !== label)
          : [...current, label],
      )
      return
    }
    setQuestionCustomAnswer('')
    setQuestionAnswers([label])
  }

  return (
    <div className={askQuestionsCardClass}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2">
        <div className="min-w-0 truncate text-[13px] leading-5">
          <span className="text-[color:var(--text)]">{question.question}</span>{' '}
          <span className="text-[11px] text-[color:var(--muted)]">
            {question.multiple ? 'Pick any that apply' : 'Pick one'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-[11px] text-[color:var(--muted)]">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-35"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            aria-label="Previous question"
          >
            &lt;
          </button>
          <span className="min-w-7 text-center tabular-nums">
            {activeIndex + 1}/{reviewIndex + 1}
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)] disabled:opacity-35"
            onClick={() => setActiveIndex((index) => Math.min(reviewIndex, index + 1))}
            aria-label="Next question"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="grid gap-0.5">
        {[
          ...question.options.map((option) => ({ ...option, syntheticOther: false as const })),
          { label: 'Other', syntheticOther: true as const },
        ].map((option) => {
          const isOther = option.syntheticOther
          const picked = isOther
            ? composerDraft.trim().length > 0 || Boolean(customAnswers[activeIndex]?.trim())
            : (answers[activeIndex]?.includes(option.label) ?? false)
          const rowClass = getQuestionOptionRowClass({ isOther, picked })
          const mark = (
            <QuestionOptionMark
              isOther={isOther}
              multiple={question.multiple === true}
              picked={picked}
            />
          )

          if (isOther) {
            return (
              <div key="__howcode_other_answer" className="relative">
                <button type="button" className={rowClass} tabIndex={-1} aria-disabled="true">
                  {mark}
                  <span className="min-w-0 truncate leading-4">{option.label}</span>
                  <span />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
                  onClick={() => void closeCard()}
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            )
          }

          return (
            <button
              key={option.label}
              type="button"
              className={rowClass}
              onClick={() => toggleOption(option.label)}
              aria-pressed={picked}
            >
              {mark}
              <span className="min-w-0 truncate leading-4">{option.label}</span>
              <span />
            </button>
          )
        })}
      </div>
    </div>
  )
}
