import type { ReactElement } from 'react'
import type { View } from '../types'

// Contributions are bound at composition, not given access to the shell controller.
// Omitting a presentation does not change the conversation's available tools.
export type WorkspaceViewContributions = Readonly<Partial<Record<View, ReactElement>>>
