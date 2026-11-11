import React from "react";
import satori, { Font } from "satori";
import { NitroOgCard, NitroOgCardProps } from "./NitroOgCard";
import fs from 'fs/promises'
import path from 'path'
import sharp from "sharp";
import * as cheerio from 'cheerio';
import type { PropVersionDoc } from "@docusaurus/plugin-content-docs";


async function loadFont(fontName: string, filename: string): Promise<Font> {
  console.log(`Loading font '${fontName}' from ${filename}...`)
  const fontPath = path.join(__dirname, filename);
  const fontData = await fs.readFile(fontPath);
  console.log(`Font '${fontName}' loaded!`)
  return { name: fontName, data: fontData }
}

interface RenderProps {
  fonts: Font[]
  width: number
  height: number
  cardConfig: NitroOgCardProps
  outputPath: string
}

async function renderCard({ fonts, width, height, cardConfig, outputPath }: RenderProps): Promise<void> {
  console.log(`Rendering social-card "${cardConfig.title}"...`)
  const svg = await satori(
    <NitroOgCard {...cardConfig} />,
    { fonts: fonts, width: width, height: height }
  )
  const directory = path.dirname(outputPath)
  const png = await svgToPng(svg)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(outputPath, png)
}

async function svgToPng(svg: string): Promise<Buffer<ArrayBufferLike>> {
  const buffer = Buffer.from(svg)
  const png = await sharp(buffer).png().toBuffer()
  return png
}

interface MetaTag {
  selector: string
  value: string
}

async function replaceMetaTags(fileName: string, replacementTags: MetaTag[]): Promise<void> {
  const html = await fs.readFile(fileName, "utf8");
  const $ = cheerio.load(html);
  for (const tag of replacementTags) {
    const $meta = $(`meta[${tag.selector}]`);
    $meta.attr('content', tag.value)
  }
  const updatedHtml = $.html()
  await fs.writeFile(fileName, updatedHtml)
}

async function fileExists(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file)
    return stat.isFile()
  } catch {
    return false
  }
}

interface Options {
  width: number
  height: number
  outDirectory: string
  docsPages: PropVersionDoc[]
  baseUrl: string
}

interface CardConfig extends NitroOgCardProps {
  filePath: string
}

export async function runPlugin({ width, height, outDirectory, docsPages, baseUrl }: Options): Promise<void> {
  const fonts = await Promise.all([
    loadFont('ClashDisplay', 'fonts/ClashDisplay-Bold.otf'),
    loadFont('Inter', 'fonts/Inter-Medium.ttf')
  ])
  const rootImgDirectory = path.join('/img', 'social-cards')
  const imgOutDirectory = path.join(outDirectory, rootImgDirectory)
  await fs.mkdir(imgOutDirectory, { recursive: true })

  console.log(`Generating social-cards in ${outDirectory}...`)
  const cardConfigs: CardConfig[] = [
    {
      title: 'Nitro Modules',
      subtitle: 'A framework for building fast, type-safe native modules for React Native with statically compiled JSI bindings.',
      url: 'nitro.margelo.com',
      filePath: path.join(imgOutDirectory, 'og-card.png')
    },
    ...docsPages.map((page) => ({
      title: page.title,
      url: 'nitro.margelo.com',
      filePath: path.join(imgOutDirectory, `${page.id}.png`)
    }))
  ]
  const promises = await Promise.all(cardConfigs.map(async (card) => {
    await renderCard({
      fonts: fonts,
      width: width,
      height: height,
      cardConfig: card,
      outputPath: card.filePath
    })
  }))
  console.log(`Generated ${promises.length} social-cards!`)

  const docsDirectory = path.join(outDirectory, 'docs')
  const docsFiles = await fs.readdir(docsDirectory, { recursive: true, withFileTypes: true })
  await Promise.all(docsFiles.map(async (filename) => {
    if (!filename.isFile()) {
      // skip non-files
      return
    }
    const filePath = path.join(filename.parentPath, filename.name)
    // /Users/mrousavy/Projects/nitro/docs/build/docs/example.html -> example.html
    const relativeDocsPath = path.relative(docsDirectory, filePath)
    // example.html -> example
    const routeId = relativeDocsPath.split('.')[0]
    // example -> /img/example.png
    const cardPath = path.join(rootImgDirectory, `${routeId}.png`)
    // double-check if the card even exists
    const exists = await fileExists(path.join(outDirectory, cardPath))
    if (!exists) {
      throw new Error(`The og-image card at "${cardPath}" (${path.join(outDirectory, cardPath)}) does not exist!`)
    }
    const cardUrl = new URL(cardPath, baseUrl)
    await replaceMetaTags(filePath, [
      {
        selector: 'property="og:image"',
        value: cardUrl.href
      },
      {
        selector: 'name="twitter:image"',
        value: cardUrl.href
      }
    ])
  }))

  console.log(`Successfully created and injected all social-cards!`)
}
