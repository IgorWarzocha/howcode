import type { Dispatch, SetStateAction } from 'react'
import { EmptyStateCard } from '../../common/empty-state-card'
import { SectionIntro } from '../../common/section-intro'
import {
  appToneMutedClass,
  appToneTextClass,
  appTypeGroupTextClass,
  appTypeSmallClass,
  primaryButtonClass,
  settingsInputClass,
  settingsListRowClass,
  settingsSectionClass,
} from '../../ui/classes'
import { cn } from '../../utils/cn'

export function SettingsFavoriteFoldersSection({
  favoriteFolderDraft,
  favoriteFolders,
  addFavoriteFolder,
  setFavoriteFolderDraft,
  updateFavoriteFolders,
}: {
  favoriteFolderDraft: string
  favoriteFolders: string[]
  addFavoriteFolder: () => void
  setFavoriteFolderDraft: Dispatch<SetStateAction<string>>
  updateFavoriteFolders: (folders: string[]) => void
}) {
  return (
    <section className={settingsSectionClass}>
      <SectionIntro
        title="Favorite folders"
        description="The attachment picker always shows Home plus the favorite folders you add here."
      />

      <div className="flex gap-2">
        <input
          type="text"
          value={favoriteFolderDraft}
          onChange={(event) => setFavoriteFolderDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addFavoriteFolder()
            }
          }}
          className={settingsInputClass}
          placeholder="Paste an absolute folder path"
          aria-label="Favorite folder path"
        />
        <button
          type="button"
          className={cn(primaryButtonClass, 'px-3 disabled:cursor-not-allowed disabled:opacity-45')}
          onClick={addFavoriteFolder}
          disabled={favoriteFolderDraft.trim().length === 0}
        >
          Add
        </button>
      </div>

      <div className="grid gap-2">
        {favoriteFolders.length > 0 ? (
          favoriteFolders.map((favoriteFolder) => (
            <div key={favoriteFolder} className={settingsListRowClass}>
              <div
                className={`truncate ${appTypeGroupTextClass} ${appToneTextClass}`}
                title={favoriteFolder}
              >
                {favoriteFolder}
              </div>
              <button
                type="button"
                className={`${appTypeSmallClass} ${appToneMutedClass} transition-colors hover:text-[color:var(--text)]`}
                onClick={() =>
                  updateFavoriteFolders(
                    favoriteFolders.filter((currentFolder) => currentFolder !== favoriteFolder),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <EmptyStateCard>No favorite folders yet.</EmptyStateCard>
        )}
      </div>
    </section>
  )
}
