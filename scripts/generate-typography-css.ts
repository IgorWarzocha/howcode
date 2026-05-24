import { getTypographyCssVariables } from '../src/app/ui/typography-scale'

const startMarker = '  /* app typography: generated start */'
const endMarker = '  /* app typography: generated end */'
const tokensPath = 'src/styles/tokens.css'

const tokensCss = await Bun.file(tokensPath).text()
const start = tokensCss.indexOf(startMarker)
const end = tokensCss.indexOf(endMarker)

if (start === -1 || end === -1 || end < start) {
  throw new Error(`Could not find typography generated markers in ${tokensPath}`)
}

const generated = [
  startMarker,
  ...getTypographyCssVariables().map(([name, value]) => `  ${name}: ${value};`),
  endMarker,
].join('\n')

const nextTokensCss = `${tokensCss.slice(0, start)}${generated}${tokensCss.slice(end + endMarker.length)}`

if (nextTokensCss !== tokensCss) {
  await Bun.write(tokensPath, nextTokensCss)
}
