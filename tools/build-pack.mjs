#!/usr/bin/env node
/**
 * Собирает pack.zip из packs/<id>/files и обновляет packs/<id>/pack.json.
 *
 * Пример:
 *   node tools/build-pack.mjs \
 *     --pack packs/example-fabric \
 *     --repo user/mc-packs \
 *     --tag pack-example-fabric-v1
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : 'true';
    args[name] = value;
  }
  return args;
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function walkFiles(directory, base = directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(absolute, base));
    } else if (entry.isFile()) {
      if (['.DS_Store', 'Thumbs.db', '.gitkeep'].includes(entry.name)) continue;
      result.push(path.relative(base, absolute).split(path.sep).join('/'));
    }
  }

  return result.sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packDir = path.resolve(args.pack || '');
  const repo = String(args.repo || '');
  const tag = String(args.tag || '');

  if (!args.pack) throw new Error('Укажите --pack packs/<id>');
  if (!fs.existsSync(packDir)) throw new Error(`Папка не найдена: ${packDir}`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('Укажите --repo owner/repo');
  }
  if (!tag) throw new Error('Укажите --tag, например pack-example-v1');

  const packJsonPath = path.join(packDir, 'pack.json');
  const pack = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
  const filesDir = path.join(packDir, 'files');
  const relativeFiles = walkFiles(filesDir);

  // Защита от случайной перезаписи pack.json пустым списком файлов.
  // Например, в CI, где папка files/ не хранится в git.
  if (relativeFiles.length === 0) {
    throw new Error(
      `Папка ${path.relative(process.cwd(), filesDir)} пуста или отсутствует. ` +
        'Не перезаписываю pack.json — добавьте файлы сборки или соберите архив вручную.'
    );
  }

  pack.files = relativeFiles.map((relative) => {
    const buffer = fs.readFileSync(path.join(filesDir, relative));
    return {
      path: relative,
      sha1: sha1(buffer),
      size: buffer.length,
    };
  });

  if (pack.files.length === 0) {
    pack.archive = null;
  } else {
    const zip = new AdmZip();
    zip.addLocalFolder(filesDir);
    const distDir = path.join(packDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });
    const zipPath = path.join(distDir, 'pack.zip');
    zip.writeZip(zipPath);

    const buffer = fs.readFileSync(zipPath);
    pack.archive = {
      url: `https://github.com/${repo}/releases/download/${tag}/pack.zip`,
      sha1: sha1(buffer),
      size: buffer.length,
    };
  }

  fs.writeFileSync(packJsonPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

  console.log(`Сборка: ${pack.id}`);
  console.log(`Файлов: ${pack.files.length}`);
  if (pack.archive) {
    console.log(`Архив: ${pack.archive.url}`);
    console.log(`SHA1:   ${pack.archive.sha1}`);
    console.log(`Размер: ${pack.archive.size} байт`);
    console.log(`Готово: ${path.join(packDir, 'dist', 'pack.zip')}`);
  } else {
    console.log('Файлов нет — архив не создан.');
  }
}

try {
  main();
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exit(1);
}
