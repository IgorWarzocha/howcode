import rootPackage from '../../../package.json'
import launcherPackage from '../../../packages/howcode/package.json'
import { asset } from '../site-assets'
import { SiteNav } from '../site-shell'

type DependencyGroup = {
  title: string
  description: string
  dependencies: Record<string, string>
}

const dependencyGroups: DependencyGroup[] = [
  {
    title: 'App runtime',
    description: 'Packages shipped with or used directly by the desktop app.',
    dependencies: rootPackage.dependencies,
  },
  {
    title: 'Build, checks, and development',
    description: 'Tooling used to build, typecheck, lint, test, and package Howcode.',
    dependencies: rootPackage.devDependencies,
  },
  {
    title: 'npm launcher',
    description: 'Runtime dependencies for the small `howcode` launcher package.',
    dependencies: launcherPackage.dependencies,
  },
]

function DependencyTable({ group }: { group: DependencyGroup }) {
  const entries = Object.entries(group.dependencies).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return (
    <article className="dependency-card">
      <div>
        <p className="label">{entries.length} packages</p>
        <h2>{group.title}</h2>
        <p>{group.description}</p>
      </div>
      <div className="dependency-list">
        {entries.map(([name, version]) => (
          <div className="dependency-row" key={name}>
            <code>{name}</code>
            <span>{version}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

export function DependenciesPage() {
  return (
    <main className="site-shell dependencies-page">
      <header className="nav">
        <a className="brand" href={asset('')} aria-label="Howcode home">
          <img src={asset('howcode-icon.svg')} alt="" />
          <span>howcode</span>
        </a>
        <SiteNav />
      </header>

      <section className="dependencies-hero">
        <p className="eyebrow">dependency ledger</p>
        <h1>What Howcode currently uses.</h1>
        <p className="lede">
          A plain list from the checked-in package manifests. Useful when the ecosystem is on fire
          and you want to know what is actually in the tree before installing anything.
        </p>
      </section>

      <section className="dependency-groups" aria-label="Howcode dependencies">
        {dependencyGroups.map((group) => (
          <DependencyTable group={group} key={group.title} />
        ))}
      </section>
    </main>
  )
}
