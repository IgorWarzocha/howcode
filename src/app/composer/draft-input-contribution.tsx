import { useContext } from 'react'
import {
  DraftInputContributionContext,
  type DraftInputContributionProps,
} from './draft-input-context'

export function DraftInputContribution(props: DraftInputContributionProps) {
  const Contribution = useContext(DraftInputContributionContext)
  return Contribution ? (
    <Contribution {...props} />
  ) : (
    props.children({ leadingAdornment: null, onKeyDown: () => undefined })
  )
}
