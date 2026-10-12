import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface HelpArticle {
  id: string;
  title: string;
  body: string;
}

const ARTICLES_DIR = fileURLToPath(new URL('./help-articles', import.meta.url));

/** Reads every `rag/help-articles/*.md` file and parses its front matter. */
export async function loadHelpArticles(): Promise<HelpArticle[]> {
  const files = (await readdir(ARTICLES_DIR)).filter((file) => file.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(`${ARTICLES_DIR}/${file}`, 'utf8');
      return parseFrontMatter(raw, file);
    }),
  );
}

function parseFrontMatter(raw: string, file: string): HelpArticle {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`${file} is missing --- front matter.`);
  }
  const frontMatter = match[1];
  const body = match[2];
  const id = /^id:\s*(.+)$/m.exec(frontMatter)?.[1]?.trim();
  const title = /^title:\s*(.+)$/m.exec(frontMatter)?.[1]?.trim();
  if (id === undefined || title === undefined) {
    throw new Error(`${file}'s front matter must set both id and title.`);
  }
  return { id, title, body: body.trim() };
}
