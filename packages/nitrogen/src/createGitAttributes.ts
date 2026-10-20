import fs from 'fs/promises'
import path from 'path'

export async function createGitAttributes(folder: string): Promise<string> {
  const file = path.join(folder, '.gitattributes')
  // Marks all files in this current folder as "generated"
  const content = `
** linguist-generated=true
  `.trim()
  await fs.writeFile(file, content + '\n', 'utf-8')
  return file
}
