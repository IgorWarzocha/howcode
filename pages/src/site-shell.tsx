import { asset } from './site-assets'

export function SiteNav() {
  const homeUrl = asset('')
  return (
    <nav aria-label="Primary navigation">
      <a href={`${homeUrl}#shape`}>What</a>
      <a href={`${homeUrl}#install`}>Install</a>
      <a href={`${homeUrl}#roadmap`}>Roadmap</a>
      <a href={`${homeUrl}#changelog`}>Changelog</a>
      <a href={asset('blog/')}>Blog</a>
      <a href={`${homeUrl}#about`}>Builder</a>
      <a href={asset('dependencies/')}>Deps</a>
      <a href="https://github.com/IgorWarzocha/howcode">GitHub</a>
    </nav>
  )
}
