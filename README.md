# Шаблон репозитория сборок

Этот репозиторий хранит **только манифесты** (JSON), а тяжёлые файлы модов — в GitHub Releases.
Лаунчер читает `manifest.json` с ветки `main` и обновляет файлы сборки при запуске.

## Структура

```
manifest.json                      # список сборок
packs/
  vanilla-1.20.1/
    pack.json                      # описание сборки
  example-fabric/
    pack.json
    files/                         # содержимое будущего pack.zip
      mods/
      config/
    dist/pack.zip                  # создаётся скриптом, в git не попадает
tools/
  build-pack.mjs                   # сборка архива и pack.json
.github/workflows/publish-pack.yml # публикация релиза
```

## Как добавить свою сборку

1. Создайте папку:

   ```
   packs/my-pack/
     pack.json
     files/
       mods/...
       config/...
   ```

2. Заполните `pack.json`:

   ```json
   {
     "schemaVersion": 1,
     "id": "my-pack",
     "name": "My Pack 1.20.1",
     "description": "Моя сборка",
     "minecraft": "1.20.1",
     "loader": { "type": "forge", "version": "47.2.0" },
     "java": 17,
     "memory": { "minMb": 2048, "maxMb": 6144 },
     "jvmArgs": ["-XX:+UseG1GC"],
     "files": [],
     "archive": null,
     "deleteObsolete": true
   }
   ```

   Поддерживаемые загрузчики:

   | `loader.type` | `loader.version` | Пример |
   |---|---|---|
   | `vanilla` | не нужен | — |
   | `fabric` | версия Fabric Loader | `0.16.14` |
   | `forge` | версия Forge без MC | `47.2.0` для 1.20.1 |
   | `neoforge` | версия артефакта NeoForge | `21.1.80` для 1.21.1, `20.4.237` для 1.20.4 |

   Для NeoForge 1.20.1 (артефакт `net.neoforged:forge`) добавьте `"project": "forge"` и версию
   вида `1.20.1-47.1.106`.

3. Добавьте `my-pack` в `manifest.json`:

   ```json
   {
     "id": "my-pack",
     "name": "My Pack 1.20.1",
     "description": "Моя сборка",
     "manifest": "packs/my-pack/pack.json"
   }
   ```

4. Соберите архив и обновите `pack.json`:

   ```bash
   npm install --prefix tools
   node tools/build-pack.mjs --pack packs/my-pack --repo USER/REPO --tag pack-my-pack-v1
   ```

   > В PowerShell переносы строк через `\` не работают — команда должна быть в одну строку
   > (или используйте обратный апостроф `` ` `` в конце строки).

5. Запустите workflow **Publish pack** (Actions → Publish pack → Run workflow):
   - `pack` = `my-pack`
   - `tag` = `pack-my-pack-v1`

   Workflow создаст релиз, загрузит `pack.zip`, обновит `pack.json` и закоммитит его.

6. Проверьте, что в `pack.json` появились `files` и `archive`, а `manifest.json` ссылается на сборку.

## Большие сборки (больше 100 МБ в одном файле)

GitHub не принимает файлы больше 100 МБ, а моды вроде `L_Ender's Cataclysm` весят ~130 МБ.
Поэтому для больших сборок **папку `files/` в git не коммитят**. В репозитории остаются только
`pack.json`, `manifest.json` и инструменты, а сам `pack.zip` публикуется в GitHub Releases.

Порядок для такой сборки:

1. Соберите архив локально (папка `files/` уже должна быть у вас на диске):

   ```powershell
   npm install --prefix tools
   node tools/build-pack.mjs --pack packs/ATM10-5.4 --repo USER/REPO --tag atm10-5.4-v1
   ```

2. Создайте релиз с тегом `atm10-5.4-v1` и прикрепите к нему
   `packs/ATM10-5.4/dist/pack.zip` вручную (или через `gh release upload`).
3. Закоммитьте обновлённый `pack.json` — в нём уже прописаны URL, SHA1 и размер архива.

В этом репозитории `packs/ATM10-5.4/files/` добавлена в `.gitignore`, а workflow **Publish pack**
для неё не используется: у CI нет исходников, и без файлов он не сможет собрать архив.

> `build-pack.mjs` намеренно завершается с ошибкой, если папка `files/` пуста или отсутствует,
> чтобы случайно не перезаписать `pack.json` пустым списком файлов (`archive: null`).

## Про workflow

Файл `.github/workflows/publish-pack.yml` добавляется в репозиторий, только если у токена есть
scope `workflow`. Обычный Personal Access Token с scope `repo` не может создать файл в
`.github/workflows/`, и `git push` завершается ошибкой:

```
refusing to allow a Personal Access Token to create or update workflow ... without `workflow` scope
```

Варианты:

- создать токен со scope `workflow` и запушить файл, либо
- добавить workflow через веб-интерфейс GitHub (Actions → New workflow), либо
- для больших сборок workflow не нужен — архив загружается в релиз вручную.

## Формат `pack.json`

```json
{
  "schemaVersion": 1,
  "id": "my-pack",
  "name": "My Pack",
  "description": "Описание",
  "minecraft": "1.20.1",
  "loader": { "type": "fabric", "version": "0.16.14" },
  "java": 17,
  "memory": { "minMb": 2048, "maxMb": 4096 },
  "jvmArgs": ["-XX:+UseG1GC"],
  "gameArgs": [],
  "server": { "ip": "play.example.com", "port": 25565 },
  "resolution": { "width": 1280, "height": 720, "fullscreen": false },
  "files": [
    { "path": "mods/example.jar", "sha1": "...", "size": 12345 }
  ],
  "archive": {
    "url": "https://github.com/USER/REPO/releases/download/pack-my-pack-v1/pack.zip",
    "sha1": "...",
    "size": 12345678
  },
  "deleteObsolete": true
}
```

- `files[].path` — путь внутри папки сборки. Лаунчер сравнивает SHA1 и скачивает только изменённое.
- `files[].url` — необязательная прямая ссылка на конкретный файл (вместо архива).
- `files[].entry` — путь файла внутри `pack.zip`, если отличается от `path`.
- `archive` — общий zip, из которого лаунчер достаёт изменившиеся файлы.
- `deleteObsolete` — удалять файлы, которые лаунчер ставил раньше, но которых больше нет в манифесте.
  Пользовательские `saves/`, `options.txt` и прочее не трогаются.

`memory` можно писать и строками: `{ "min": "2G", "max": "6G" }`.

## Обновление сборки

1. Измените файлы в `packs/my-pack/files/`.
2. Запустите `build-pack.mjs` с **новым тегом**, например `pack-my-pack-v2`.
3. Опубликуйте релиз через workflow.
4. Пользователи получат обновление при следующем запуске лаунчера.

`pack.json` читается с ветки `main`, поэтому после коммита workflow изменения подхватятся
автоматически. Лаунчер запрашивает файлы с `Cache-Control: no-cache`, чтобы GitHub не отдавал
старую версию из кеша.
