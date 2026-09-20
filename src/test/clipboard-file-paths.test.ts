import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseClipboardFilePaths } from '../electron/main/ipc/request-handlers/clipboard-file-paths'

describe('clipboard file URI lists', () => {
  it('decodes file paths without treating escaped separators as list delimiters', () => {
    const paths = [path.resolve('a space.txt'), path.resolve('hash#and%percent.txt')]
    const uriList = paths.map((filePath) => pathToFileURL(filePath).href).join('\r\n')

    expect(parseClipboardFilePaths(uriList)).toEqual(paths)
  })

  it('ignores comments, non-file URLs and malformed entries without losing valid files', () => {
    const filePath = path.resolve('valid.txt')
    const uri = pathToFileURL(filePath).href

    expect(
      parseClipboardFilePaths(
        `# copied files\r\nhttps://example.com/file\nnot a URL\nfile:///bad%ZZ\n${uri}\n${uri}\n`,
      ),
    ).toEqual([filePath])
  })

  it('rejects encoded NULs and encoded path separators', () => {
    expect(parseClipboardFilePaths('file:///tmp/a%00b\nfile:///tmp/a%2Fb')).toEqual([])
  })
})
