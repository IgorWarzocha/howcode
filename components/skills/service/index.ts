import { createServiceWork } from '@howaboua/howcode-sdk/node/service-work'
import type { PiSkillsService } from '../../../shared/desktop-service-contracts.ts'
import { disposeSkillsCatalog, searchPiSkills } from './catalog.ts'
import { installPiSkill, listConfiguredPiSkills, removePiSkill } from './service.ts'

export function createSkillsService() {
  const work = createServiceWork('Skills')
  const service: PiSkillsService = {
    searchPiSkills: (request) => work.run(() => searchPiSkills(request)),
    listConfiguredPiSkills: (request) => work.run(() => listConfiguredPiSkills(request)),
    installPiSkill: (request) => work.run(() => installPiSkill(request)),
    removePiSkill: (request) => work.run(() => removePiSkill(request)),
  }
  return {
    service,
    async dispose() {
      await work.stop()
      await disposeSkillsCatalog()
    },
  }
}
