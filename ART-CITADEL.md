# Оригинальная графика Цитадели, 0.58

31 октября 2026. Все новые ресурсы созданы специально для этого проекта; сторонние игровые наборы, текстуры и спрайты не скачивались. Пользовательский визуальный ориентир использован для направления стиля, не вырезался в качестве игрового ресурса.

## Состав

- `src/assets/citadel/*.webp`: 10 интерьеров 480×200 / 480×240 и окружение 960×384, созданные встроенным ImageGen и оптимизированные в WebP. В игре нет исходных тяжёлых атласов.
- Четыре `*.svg` со спрайтами жителей: авторский код `tools/create_citadel_overlays.py`, 6 кадров по 24×40 на жителя: ожидание, моргание, шаг, две рабочие позы, отдых. Разговор использует первые две позы.
- Двадцать прозрачных `*-upgrade*.svg`: по два самостоятельных слоя для каждой комнаты; второй добавляет тематическую обстановку, третий также добавляет архитектурный свод, дорожку и канделябры.
- `stone.svg`, `stairs.svg`: авторские векторные пиксельные плитки камня и лестницы.
- Четыре кадра героя строятся локально из его настоящего экипированного спрайта: ожидание, моргание и два шага. Исходный персонаж и данные экипировки сохранены. Кадры используют CSS и существующую маршрутную анимацию; отдельного игрового таймера нет.

Изображения являются только декорацией. Комнаты, предметы, герой, NPC, двери, оформление и покупки остаются самостоятельными элементами работающей игры. Все 37 файлов и CSS входят в хэш сборки и кеш service worker.

## Воспроизводимость

`python tools/create_citadel_overlays.py` пересоздаёт векторные ресурсы. `tools/prepare_citadel_art.py` получает три исходных атласа аргументами `--rooms`, `--lower`, `--sky` и формирует оптимизированные интерьеры. Исходные запросы ImageGen приведены ниже. Повторная генерация изображений не гарантирует идентичные пиксели; готовые оптимизированные ресурсы зафиксированы в Git.

### Запрос 1 — атлас интерьеров

Create a production game asset atlas for an original gothic dark fantasy pixel art side-view castle cutaway game. Image exactly a regular 2 columns by 5 rows grid, all ten cells equal dimensions, with NO gutters, NO text, NO labels, NO UI, NO people. Each cell a complete orthographic side-view interior room, floor at bottom 12 percent, dark stone pillars at edges, warm candlelight and violet stained glass, exquisite crisp pixel art with highly detailed furniture, 16 bit premium game aesthetic. Top row: LEFT gothic throne room with purple throne, tall pointed stained glass, banners, candles RIGHT astronomical observatory telescope, star charts, round gothic window. Second row LEFT personal bed chamber ornate canopy bed, crimson curtains, fireplace RIGHT scholar study desk, books, ink, shelves. Third row LEFT archive with towering bookshelves and ladders RIGHT forge with glowing orange furnace, anvil, tools. Fourth row LEFT alchemy hall violet crystal and glass apparatus RIGHT guard room weapons rack shields and wooden bench. Fifth row LEFT vault gold piles and iron chests RIGHT shadow gatehouse iron portcullis chains stone staircase. Architectural consistency, rich blue-black stone textures, aged gold details, dramatic depth and lighting. No characters, leave clear walking floor in front. Flat side elevation; not isometric. Ten individual rectangular game backgrounds in strict 2x5 grid, each independently usable.

В проекте использованы только первые шесть ячеек. Остальные заменены отдельным атласом, точно соответствующим существующим помещениям; алхимическая комната не добавлялась.

### Запрос 2 — нижние комнаты

Production original pixel art background atlas, EXACTLY 2 columns 2 rows of equal rectangular cells, no margins or text. Side elevation orthographic interiors for a gothic dark fantasy castle game, intricate 16-bit pixel art blue-black carved stone with gold and violet accents, many tiny crisp pixel details, no people, no UI, no labels. TOP LEFT guardhouse with iron portcullis, shields, spears, weapon racks and bench. TOP RIGHT refectory with long oak dining table, chairs, plates, candle chandelier, fireplace. BOTTOM LEFT covered cloister gallery with pointed gothic stone arches, ivy, moss, plants in pots, stained glass and distant moonlit courtyard visible through arches. BOTTOM RIGHT treasury with iron-bound chests, piles of gold, ledger on writing desk, candles, bars over pointed windows. Each independent room floor at bottom 12%, clear foreground walking area. Deep multilayer architecture, warm candles against moonlight, premium atmospheric gothic RPG. Four distinct rooms in perfectly regular 2x2 grid.

### Запрос 3 — окружение

Original production 16-bit pixel art game background, wide landscape. Moonlit gothic castle rooftop against purple dusk sky. Distant layered silhouettes of pine forests mountains and slender gothic towers, luminous amber moon upper right, wisps of clouds. Foreground at bottom 25 percent: ornate dark blue-black stone parapet, pointed slate spires at far left and right, small gargoyles and warm amber torch flames on parapet pillars. Center is open sky, no main building blocking it. Sharp tiny deliberate pixel details, rich moody blue/violet with sparse warm gold, premium dark fantasy side-view RPG aesthetic. NO text NO interface NO people. Intended as top scenic architectural background above an interactive castle cutaway.
