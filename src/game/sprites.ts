/*
 * Pixel art, in a 16-bit console style: more colours, shading and dark outlines.
 * Everything is original art drawn in code:
 *   - characters and items are grids of letters (one letter per pixel), then "polished":
 *     each colour region gets a highlight on top, a shadow underneath, and the sprite gets an outline;
 *   - tiles are painted pixel-by-pixel onto small offscreen canvases with several tones each.
 */

import { TILE } from './level'

export type Theme = 'light' | 'dark'

export interface Palette {
    skyTop: string
    skyBottom: string
    star: string
    moon: string
    mountain: string
    mountainSnow: string
    farHill: string
    grass: string
    ground: string
    groundDeep: string
    groundSpeck: string
    brick: string
    mortar: string
    hard: string
    block: string
    blockDark: string
    blockMark: string
    used: string
    pipe: string
    hill: string
    bush: string
    cloud: string
    cloudShade: string
    castle: string
    castleDark: string
    label: string
    labelShadow: string
}

// Keep ground colours in sync with Footer.css so the footer looks like more ground.
export const palettes: Record<Theme, Palette> = {
    light: {
        skyTop: '#3a78f0',
        skyBottom: '#a8d8ff',
        star: '#ffffff',
        moon: '#fff6d0',
        mountain: '#7a9ad8',
        mountainSnow: '#eef4ff',
        farHill: '#5fb870',
        grass: '#3cb043',
        ground: '#c67c3c',
        groundDeep: '#94552a',
        groundSpeck: '#6e3c1a',
        brick: '#c84c0c',
        mortar: '#3a1c00',
        hard: '#b5651d',
        block: '#f8b800',
        blockDark: '#8a4c00',
        blockMark: '#fff4c8',
        used: '#9a5a2a',
        pipe: '#22a82a',
        hill: '#2e9e3a',
        bush: '#48c048',
        cloud: '#ffffff',
        cloudShade: '#c8dcff',
        castle: '#c84c0c',
        castleDark: '#3a1c00',
        label: '#ffffff',
        labelShadow: '#000000',
    },
    dark: {
        skyTop: '#05081e',
        skyBottom: '#2a2458',
        star: '#fff8d0',
        moon: '#fff4c0',
        mountain: '#1c2248',
        mountainSnow: '#8a94c8',
        farHill: '#16304a',
        grass: '#3a7a6a',
        ground: '#5a5a5a',
        groundDeep: '#404048',
        groundSpeck: '#2a2a30',
        brick: '#2a5aa8',
        mortar: '#0a1028',
        hard: '#5a6a8a',
        block: '#e8a000',
        blockDark: '#6a3a00',
        blockMark: '#fff0c0',
        used: '#5a4a3a',
        pipe: '#179018',
        hill: '#1a3a4a',
        bush: '#1e4a3a',
        cloud: '#4a5270',
        cloudShade: '#2e3456',
        castle: '#3a4a6a',
        castleDark: '#0a1028',
        label: '#fff8d0',
        labelShadow: '#c00000',
    },
}

// ---- Colour helpers ----------------------------------------------------------

function toRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: number[]): string {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

// Lightens (amount > 0) or darkens (amount < 0) a colour. amount is -1..1.
export function shade(hex: string, amount: number): string {
    const rgb = toRgb(hex)
    return toHex(rgb.map((v) => (amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))))
}

// ---- Canvas helpers ------------------------------------------------------------

type Canvas = HTMLCanvasElement
type Ctx = CanvasRenderingContext2D

function makeCanvas(width: number, height: number, paint: (ctx: Ctx) => void): Canvas {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) paint(ctx)
    return canvas
}

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
}

// Pads rows to a fixed width (16 by default), and adds empty rows on top so the art sits on the bottom edge.
function grid(rows: string[], height = TILE, width = TILE): string[] {
    const padded = rows.map((row) => row.padEnd(width, '.').slice(0, width))
    while (padded.length < height) padded.unshift('.'.repeat(width))
    return padded
}

// Draws a grid of letters, one pixel per letter. '.' is transparent.
function paintGrid(ctx: Ctx, rows: string[], colors: Record<string, string>, flip = false) {
    rows.forEach((row, y) => {
        row.split('').forEach((ch, x) => {
            const color = colors[ch]
            if (color) px(ctx, color, flip ? row.length - 1 - x : x, y)
        })
    })
}

// The 16-bit touch: highlight the top edge of each colour region, shade its bottom and right edges,
// then draw a dark outline around the whole sprite.
function polish(ctx: Ctx, width: number, height: number) {
    const image = ctx.getImageData(0, 0, width, height)
    const src = new Uint8ClampedArray(image.data)
    const out = image.data
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : (y * width + x) * 4)
    const opaque = (i: number) => i >= 0 && src[i + 3] > 0
    const same = (i: number, j: number) =>
        j >= 0 && src[j + 3] > 0 && src[i] === src[j] && src[i + 1] === src[j + 1] && src[i + 2] === src[j + 2]
    const set = (i: number, rgb: number[], alpha = 255) => {
        out[i] = rgb[0]
        out[i + 1] = rgb[1]
        out[i + 2] = rgb[2]
        out[i + 3] = alpha
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = at(x, y)
            const rgb = [src[i], src[i + 1], src[i + 2]]
            if (opaque(i)) {
                if (!same(i, at(x, y - 1))) set(i, rgb.map((v) => v + (255 - v) * 0.28))
                else if (!same(i, at(x, y + 1)) || !same(i, at(x + 1, y))) set(i, rgb.map((v) => v * 0.72))
                continue
            }
            // Transparent pixel next to the sprite: make it outline.
            const neighbour = [at(x, y - 1), at(x, y + 1), at(x - 1, y), at(x + 1, y)].find(opaque)
            if (neighbour !== undefined) {
                set(i, [src[neighbour] * 0.25, src[neighbour + 1] * 0.2, src[neighbour + 2] * 0.25])
            }
        }
    }
    ctx.putImageData(image, 0, 0)
}

// A polished sprite from a letter grid.
function sprite(rows: string[], colors: Record<string, string>, flip = false): Canvas {
    const width = rows[0].length
    return makeCanvas(width, rows.length, (ctx) => {
        paintGrid(ctx, rows, colors, flip)
        polish(ctx, width, rows.length)
    })
}

// ---- Player ("Fred") -------------------------------------------------------

const PLAYER_COLORS: Record<string, string> = {
    H: '#6b3e14', // hair
    S: '#f6c89a', // skin
    K: '#141820', // glasses
    T: '#8a3ab9', // shirt
    J: '#3a64c0', // jeans
    O: '#4a2a14', // shoes
    W: '#ffffff', // glasses glint
}

const HEAD = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '....HHSSSSSH....',
    '...HHSKKSKKS....',
    '...HSSKWSKWSS...',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
]
const BODY = ['....TTTTTTT.....', '...TTTTTTTTT....', '..STTTTTTTTTS...', '..S.TTTTTTT.S...']
const BODY_JUMP = ['....TTTTTTT.S...', '...TTTTTTTTTS...', '..STTTTTTTTT....', '....TTTTTTT.....']
const LEGS_STAND = ['....JJJJJJJ.....', '....JJJ.JJJ.....', '....JJ...JJ.....', '...OOO...OOO....']
const LEGS_WALK1 = ['....JJJJJJJ.....', '...JJJ...JJJ....', '..JJ.......JJ...', '.OOO.......OOO..']
const LEGS_WALK2 = ['....JJJJJJJ.....', '.....JJJJJ......', '.....JJ.JJ......', '.....OO.OOO.....']
const LEGS_JUMP = ['....JJJJJJJ.....', '...JJJ...JJJ....', '..OJJ.....JJO...', '..OO.......OO...']

// Tall Fred, after a cup of coffee: 16x32.
const BIG_HEAD = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHSSSSSSHH...',
    '...HSSSSSSSSH...',
    '...SKKKSSKKKS...',
    '..SSKWKSSKWKSS..',
    '...SKKKSSKKKS...',
    '...SSSSSSSSSS...',
    '....SSSSSSSS....',
    '.....SSSSSS.....',
]
const BIG_BODY = [
    '.....TTTTTT.....',
    '...TTTTTTTTTT...',
    '..TTTTTTTTTTTT..',
    '..TTTTTTTTTTTT..',
    '.STTTTTTTTTTTTS.',
    '.STTTTTTTTTTTTS.',
    '.SS.TTTTTTTT.SS.',
    '....TTTTTTTT....',
    '....JJJJJJJJ....',
    '....JJJJJJJJ....',
]
const BIG_BODY_JUMP = [
    '.....TTTTTT..SS.',
    '...TTTTTTTTTTSS.',
    '..TTTTTTTTTTTT..',
    '..TTTTTTTTTTTT..',
    '.STTTTTTTTTTTT..',
    '.STTTTTTTTTTTT..',
    '.SS.TTTTTTTT....',
    '....TTTTTTTT....',
    '....JJJJJJJJ....',
    '....JJJJJJJJ....',
]
const BIG_LEGS_STAND = [
    '....JJJJJJJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '....JJJ..JJJ....',
    '...OOOO..OOOO...',
    '..OOOOO..OOOOO..',
]
const BIG_LEGS_WALK1 = [
    '....JJJJJJJJ....',
    '...JJJJ..JJJJ...',
    '...JJJ....JJJ...',
    '..JJJ......JJJ..',
    '..JJJ......JJJ..',
    '.JJJ........JJJ.',
    '.JJJ........JJJ.',
    '.JJJ........JJJ.',
    'OOOO........OOOO',
    'OOOO.........OOO',
]
const BIG_LEGS_WALK2 = [
    '....JJJJJJJJ....',
    '.....JJJJJJ.....',
    '.....JJJJJJ.....',
    '.....JJJ.JJ.....',
    '.....JJJ.JJ.....',
    '.....JJJ.JJ.....',
    '.....JJJ.JJ.....',
    '.....JJJ.JJ.....',
    '....OOOO.OOO....',
    '....OOOO.OOOO...',
]
const BIG_LEGS_JUMP = [
    '....JJJJJJJJ....',
    '...JJJJ..JJJJ...',
    '..JJJJ....JJJJ..',
    '..JJJ......JJJ..',
    '..JJJ......JJJ..',
    '.JJJ.......OOO..',
    '.JJJ.......OOO..',
    'OOOO............',
    'OOOO............',
    '................',
]

export type PlayerFrame = 'stand' | 'walk1' | 'walk2' | 'jump'

const SMALL_FRAMES: Record<PlayerFrame, string[]> = {
    stand: [...HEAD, ...BODY, ...LEGS_STAND],
    walk1: [...HEAD, ...BODY, ...LEGS_WALK1],
    walk2: [...HEAD, ...BODY, ...LEGS_WALK2],
    jump: [...HEAD, ...BODY_JUMP, ...LEGS_JUMP],
}

const BIG_FRAMES: Record<PlayerFrame, string[]> = {
    stand: grid([...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS_STAND], 32),
    walk1: grid([...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS_WALK1], 32),
    walk2: grid([...BIG_HEAD, ...BIG_BODY, ...BIG_LEGS_WALK2], 32),
    jump: grid([...BIG_HEAD, ...BIG_BODY_JUMP, ...BIG_LEGS_JUMP], 32),
}

// ---- Enemies and items ---------------------------------------------------------

const BUG_COLORS: Record<string, string> = {
    C: '#1a1a22', // chip casing
    c: '#3a3a48', // casing face
    R: '#ff3030', // LED eyes
    W: '#ffd8d8', // LED glint
    g: '#d8b040', // gold contacts
    L: '#c8c8d8', // silver pin legs
}

// A software bug: a little circuit chip scuttling on its pins. Stomp it.
const BUG_BODY = [
    '..L.L.L.L.L.L...',
    '.CCCCCCCCCCCCC..',
    '.CcccccccccccC..',
    '.CcRRcccccRRcC..',
    '.CcRWcccccRWcC..',
    '.CcccccccccccC..',
    '.CcccgggggcccC..',
    '.CcccccccccccC..',
    '.CCCCCCCCCCCCC..',
]
const BUG_1 = grid([...BUG_BODY, '..L.L.L.L.L.L...', '.L.L.L.L.L.L....'])
const BUG_2 = grid([...BUG_BODY, '..L.L.L.L.L.L...', '...L.L.L.L.L.L..'])
const BUG_FLAT = grid(['.CCCCCCCCCCCCC..', '.CcRRcccccRRcC..', '.CCCCCCCCCCCCC..', '.LLLLLLLLLLLLL..'])

const SHREDDER_COLORS: Record<string, string> = {
    V: '#e0e0ec', // blades
    D: '#20202a', // slot
    G: '#6a6a78', // casing
    g: '#8a8a9a', // casing face
    R: '#ff4040', // angry lights
    K: '#101014', // mouth slot
    P: '#ffffff', // shredded paper
    k: '#2a2a30', // wheels
}

// A paper shredder with blades on top. Don't stomp it.
const SHREDDER_BODY = [
    '.V.V.V.V.V.V.V..',
    'VVVVVVVVVVVVVVV.',
    'DDDDDDDDDDDDDDD.',
    'GGGGGGGGGGGGGGG.',
    'GgggggggggggggG.',
    'GgRRgggggggRRgG.',
    'GggggKKKKKggggG.',
    'GgggggggggggggG.',
    'GgPgPgPgPgPgPgG.',
    'GGGGGGGGGGGGGGG.',
    '.PP.PP.PP.PP.P..',
]
const SHREDDER_1 = grid([...SHREDDER_BODY, '.kk........kk...'])
const SHREDDER_2 = grid([...SHREDDER_BODY, '..kk......kk....'])

// The power-up: a cup of coffee. Drink it to grow tall and break bricks.
const COFFEE = grid([
    '.....s...s......',
    '......s...s.....',
    '.....s...s......',
    '...WWWWWWWWW....',
    '...WbbbbbbbW....',
    '...WWWWWWWWWWW..',
    '...WWWWWWWWW..W.',
    '...WWWRRWWWW..W.',
    '...WWRRRRWWW..W.',
    '...WWWRRWWWWWW..',
    '...WWWWWWWWW....',
    '....WWWWWWW.....',
])
const COFFEE_COLORS: Record<string, string> = { W: '#f4f4f8', b: '#5a3418', R: '#d02828', s: '#c8d0e0' }

// ---- The boss: "The Manager" (24x44) -----------------------------------------

const BOSS_COLORS: Record<string, string> = {
    H: '#3a2a1a', // slicked-back hair
    S: '#f0c8a0', // skin
    G: '#202020', // glasses frames
    g: '#bfe3ff', // lenses
    K: '#7a3a2a', // smug mouth
    W: '#e4ecf8', // dress shirt
    R: '#d01818', // bow tie
    r: '#8a0a0a', // bow tie knot
    B: '#3a2a1a', // belt
    Y: '#e8c040', // buckle
    T: '#c8b078', // khakis
    P: '#0c0c10', // patent leather shoes
    w: '#ffffff', // shoe shine
}

const BOSS_HEAD = [
    '........HHHHHHH.........',
    '......HHHHHHHHHHH.......',
    '.....HHHHHHHHHHHHH......',
    '.....HHSSSSSSSSSHH......',
    '.....HSSSSSSSSSSSH......',
    '.....SSGGGGSGGGGSS......',
    '....SSSGggGSGggGSS......',
    '....SSSGGGGSGGGGSS......',
    '.....SSSSSSSSSSSSS......',
    '.....SSSSSSSSSSSSS......',
    '......SSSKKKKSSSS.......',
    '.......SSSSSSSSS........',
    '........SSSSSSS.........',
]
const BOSS_COLLAR = [
    '......WWWWSSSWWWW.......',
    '....WWWWWRRrRRWWWWW.....',
    '....WWWWWRRrRRWWWWW.....',
    '....WWWWWWWWWWWWWWW.....',
]
const BOSS_ARMS = [
    '...WWWWWWWWWWWWWWWWWW...',
    '..WWWWWWWWWWWWWWWWWWWW..',
    '..WWW.WWWWWWWWWWWW.WWW..',
    '..WWW.WWWWWWWWWWWW.WWW..',
    '..WWW.WWWWWWWWWWWW.WWW..',
    '..SSS.WWWWWWWWWWWW.SSS..',
    '..SSS.WWWWWWWWWWWW.SSS..',
]
// Arm out front, holding the stapler (the stapler itself is drawn separately).
const BOSS_ARMS_AIM = [
    '...WWWWWWWWWWWWWWWWWWWW.',
    '..WWWWWWWWWWWWWWWWWWWWSS',
    '..WWW.WWWWWWWWWWWW....SS',
    '..WWW.WWWWWWWWWWWW......',
    '..WWW.WWWWWWWWWWWW......',
    '..SSS.WWWWWWWWWWWW......',
    '..SSS.WWWWWWWWWWWW......',
]
const BOSS_WAIST = [
    '......BBBBBYYBBBBB......',
    '......TTTTTTTTTTTT......',
    '......TTTTTTTTTTTT......',
    '......TTTTTTTTTTTT......',
]
const BOSS_LEGS_STAND = [
    ...Array(10).fill('......TTTTT..TTTTT......'),
    '.....PPPPPP..PPPPPPP....',
    '.....PwPPPP..PwPPPPPP...',
    '.....PPPPPP..PPPPPPPP...',
]
const BOSS_LEGS_WALK = [
    '.....TTTTT....TTTTT.....',
    '.....TTTT......TTTT.....',
    '....TTTT........TTTT....',
    '....TTTT........TTTT....',
    '...TTTT..........TTTT...',
    '...TTTT..........TTTT...',
    '...TTTT..........TTTT...',
    '..TTTT............TTTT..',
    '..TTTT............TTTT..',
    '..TTTT............TTTT..',
    '.PPPPP............PPPPPP',
    '.PwPPP............PwPPPP',
    '.PPPPP............PPPPPP',
]

export type BossFrame = 'stand' | 'walk' | 'aim'

const BOSS_FRAMES: Record<BossFrame, string[]> = {
    stand: grid([...BOSS_HEAD, ...BOSS_COLLAR, ...BOSS_ARMS, ...BOSS_WAIST, ...BOSS_LEGS_STAND], 44, 24),
    walk: grid([...BOSS_HEAD, ...BOSS_COLLAR, ...BOSS_ARMS, ...BOSS_WAIST, ...BOSS_LEGS_WALK], 44, 24),
    aim: grid([...BOSS_HEAD, ...BOSS_COLLAR, ...BOSS_ARMS_AIM, ...BOSS_WAIST, ...BOSS_LEGS_STAND], 44, 24),
}

const STAPLER = grid(['.TTTTTTTTTT.', 'TttttttttttT', 'TTTTTTTTTTTT', '..TT....TT..', '.TTTTTTTTTTT'], 5, 12)
const STAPLER_COLORS: Record<string, string> = { T: '#2a2a32', t: '#b8b8c8' }

const COIN = grid([
    '......DDDD......',
    '.....DYYYYD.....',
    '....DYLWWYyD....',
    '....DYWLYYyD....',
    '....DYWYYYyD....',
    '....DYWYYYyD....',
    '....DYWYYYyD....',
    '....DYWYYYyD....',
    '....DYWYYYyD....',
    '....DYLYYYyD....',
    '....DYYYYyyD....',
    '.....DyyyyD.....',
    '......DDDD......',
    '................',
])
const COIN_COLORS: Record<string, string> = { D: '#7a4000', Y: '#fcc000', y: '#d88a00', W: '#fffbe0', L: '#ffe070' }

// ---- Tiles -------------------------------------------------------------------

const QUESTION_MARK = [
    '................',
    '................',
    '................',
    '.....MMMMM......',
    '....MMDDDMM.....',
    '....MMD..MMD....',
    '.....DD..MMD....',
    '........MMDD....',
    '.......MMDD.....',
    '.......MMD......',
    '........DD......',
    '.......MM.......',
    '.......MMD......',
    '........DD......',
    '................',
    '................',
]

// Raised-panel look: light top/left edges, dark bottom/right edges.
function bevel(ctx: Ctx, color: string, x: number, y: number, w: number, h: number, depth = 1) {
    px(ctx, color, x, y, w, h)
    for (let d = 0; d < depth; d++) {
        px(ctx, shade(color, 0.35 - d * 0.1), x + d, y + d, w - d * 2, 1)
        px(ctx, shade(color, 0.2 - d * 0.1), x + d, y + d, 1, h - d * 2)
        px(ctx, shade(color, -0.35 + d * 0.1), x + d, y + h - 1 - d, w - d * 2, 1)
        px(ctx, shade(color, -0.25 + d * 0.1), x + w - 1 - d, y + d, 1, h - d * 2)
    }
}

function rivets(ctx: Ctx, color: string) {
    ;[
        [2, 2],
        [12, 2],
        [2, 12],
        [12, 12],
    ].forEach(([x, y]) => {
        px(ctx, shade(color, -0.5), x, y, 2, 2)
        px(ctx, shade(color, 0.6), x, y, 1, 1)
    })
}

function paintBlock(ctx: Ctx, p: Palette) {
    px(ctx, p.blockDark, 0, 0, TILE, TILE)
    // Vertical gradient: brighter at the top.
    for (let y = 1; y < TILE - 1; y++) px(ctx, shade(p.block, 0.18 - (y / TILE) * 0.3), 1, y, TILE - 2, 1)
    px(ctx, shade(p.block, 0.55), 1, 1, TILE - 2, 1)
    px(ctx, shade(p.block, 0.35), 1, 1, 1, TILE - 2)
    px(ctx, shade(p.block, -0.45), 1, TILE - 2, TILE - 2, 1)
    px(ctx, shade(p.block, -0.35), TILE - 2, 1, 1, TILE - 2)
    rivets(ctx, p.block)
    paintGrid(ctx, QUESTION_MARK, { M: p.blockMark, D: shade(p.blockDark, -0.2) })
}

function paintUsed(ctx: Ctx, p: Palette) {
    px(ctx, shade(p.used, -0.6), 0, 0, TILE, TILE)
    bevel(ctx, p.used, 1, 1, TILE - 2, TILE - 2, 2)
    rivets(ctx, p.used)
}

function paintBrick(ctx: Ctx, p: Palette) {
    px(ctx, p.mortar, 0, 0, TILE, TILE)
    for (let band = 0; band < 4; band++) {
        const y = band * 4
        const offset = band % 2 === 0 ? 0 : -4
        for (let x = offset; x < TILE; x += 8) {
            const bx = Math.max(0, x)
            const w = Math.min(x + 7, TILE) - bx
            if (w <= 0) continue
            px(ctx, p.brick, bx, y, w, 3)
            px(ctx, shade(p.brick, 0.35), bx, y, w, 1)
            px(ctx, shade(p.brick, 0.15), bx, y + 1, 1, 2)
            px(ctx, shade(p.brick, -0.25), bx, y + 2, w, 1)
        }
    }
}

function paintHard(ctx: Ctx, p: Palette) {
    // Four sloped faces, like a stud.
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const top = y < x && y < TILE - 1 - x
            const bottom = y > x && y > TILE - 1 - x
            const left = x <= y && x <= TILE - 1 - y
            const amount = top ? 0.3 : bottom ? -0.35 : left ? 0.12 : -0.2
            px(ctx, shade(p.hard, amount), x, y)
        }
    }
    bevel(ctx, p.hard, 4, 4, 8, 8)
    px(ctx, shade(p.hard, -0.6), 0, TILE - 1, TILE, 1)
    px(ctx, shade(p.hard, -0.6), TILE - 1, 0, 1, TILE)
}

// Small deterministic pseudo-random numbers so the ground doesn't flicker.
function random(seed: number) {
    let s = seed
    return () => {
        s = (s * 9301 + 49297) % 233280
        return s / 233280
    }
}

function pebbles(ctx: Ctx, color: string, fromY: number, seed: number, count: number) {
    const next = random(seed)
    for (let i = 0; i < count; i++) {
        const x = Math.floor(next() * (TILE - 2))
        const y = fromY + Math.floor(next() * (TILE - fromY - 1))
        px(ctx, shade(color, 0.25), x, y, 2, 1)
        px(ctx, shade(color, -0.35), x + 1, y + 1, 2, 1)
    }
}

function paintGround(ctx: Ctx, p: Palette, top: boolean, theme: Theme) {
    if (theme === 'dark') {
        // Stone blocks with bevels, moss on top.
        px(ctx, p.groundSpeck, 0, 0, TILE, TILE)
        bevel(ctx, p.ground, 0, 0, 6, 8)
        bevel(ctx, p.ground, 6, 0, 10, 8)
        bevel(ctx, p.groundDeep, 0, 8, 12, 8)
        bevel(ctx, p.groundDeep, 12, 8, 4, 8)
        if (top) {
            px(ctx, p.grass, 0, 0, TILE, 2)
            px(ctx, shade(p.grass, 0.3), 0, 0, TILE, 1)
            ;[1, 5, 9, 13].forEach((x) => px(ctx, p.grass, x, 2, 2, 1))
            ;[3, 11].forEach((x) => px(ctx, shade(p.grass, -0.2), x, 3, 1, 1))
        }
        return
    }
    // Dirt gets darker the deeper it goes.
    for (let y = 0; y < TILE; y++) {
        const depth = top ? y / TILE : 0.5 + y / (TILE * 2)
        px(ctx, shade(p.ground, -depth * 0.25), 0, y, TILE, 1)
    }
    pebbles(ctx, p.ground, top ? 7 : 0, top ? 7 : 13, 5)
    if (top) {
        const g = p.grass
        px(ctx, g, 0, 0, TILE, 5)
        px(ctx, shade(g, 0.35), 0, 0, TILE, 1)
        ;[1, 4, 8, 11, 14].forEach((x) => px(ctx, shade(g, 0.2), x, 1, 1, 2))
        // Jagged edge where grass meets dirt, with a little shadow under it.
        ;[0, 3, 5, 9, 12, 14].forEach((x) => px(ctx, shade(g, -0.2), x, 5, 2, 1))
        ;[1, 10].forEach((x) => px(ctx, shade(g, -0.3), x, 6, 1, 1))
        px(ctx, shade(p.ground, -0.3), 0, 6, TILE, 1)
        ;[0, 3, 5, 9, 12, 14].forEach((x) => px(ctx, shade(p.ground, -0.3), x, 7, 2, 1))
    }
}

function paintOfficeFloor(ctx: Ctx, top: boolean, theme: Theme) {
    const carpet = theme === 'dark' ? '#3a4058' : '#6a7aa0'
    const base = theme === 'dark' ? '#2a2a34' : '#8a8a94'
    px(ctx, top ? carpet : base, 0, 0, TILE, TILE)
    const next = random(top ? 3 : 5)
    for (let i = 0; i < 10; i++) px(ctx, shade(top ? carpet : base, next() > 0.5 ? 0.15 : -0.15), Math.floor(next() * TILE), Math.floor(next() * TILE))
    if (top) {
        // Baseboard trim along the top of the carpet.
        px(ctx, shade(carpet, 0.35), 0, 0, TILE, 1)
        px(ctx, shade(carpet, -0.3), 0, 1, TILE, 1)
    }
}

// Pipes are shaded across their width like a cylinder: highlight left of centre, dark at the edges.
const PIPE_RAMP = [-0.55, -0.1, 0.25, 0.5, 0.35, 0.15, 0.05, 0, 0, -0.05, -0.1, -0.15, -0.2, -0.25, -0.3, -0.35]

function paintPipe(ctx: Ctx, p: Palette, part: 'topL' | 'topR' | 'bodyL' | 'bodyR') {
    const isTop = part === 'topL' || part === 'topR'
    const isLeft = part === 'topL' || part === 'bodyL'
    // The body is 2px narrower than the lip on each side; the ramp spans the full 32px pipe.
    const inset = isTop ? 0 : 2
    const span = 32 - inset * 2
    for (let x = 0; x < TILE; x++) {
        const pipeX = isLeft ? x : TILE + x
        if (pipeX < inset || pipeX >= 32 - inset) continue
        const t = Math.floor(((pipeX - inset) / span) * PIPE_RAMP.length)
        const amount = pipeX === inset || pipeX === 31 - inset ? -0.7 : PIPE_RAMP[t]
        px(ctx, shade(p.pipe, amount), x, 0, 1, TILE)
    }
    if (isTop) {
        px(ctx, shade(p.pipe, -0.7), 0, 0, TILE, 1)
        px(ctx, shade(p.pipe, -0.7), 0, TILE - 1, TILE, 1)
        px(ctx, 'rgba(0,0,0,0.25)', 0, TILE - 3, TILE, 2)
    }
}

// ---- Sprite sheet ------------------------------------------------------------

type Facing = { right: Canvas; left: Canvas }

export interface Sprites {
    palette: Palette
    player: Record<PlayerFrame, Facing>
    bigPlayer: Record<PlayerFrame, Facing>
    ground: Canvas
    groundTop: Canvas
    brick: Canvas
    hard: Canvas
    block: Canvas
    used: Canvas
    pipe: Record<'topL' | 'topR' | 'bodyL' | 'bodyR', Canvas>
    coin: Canvas
    coffee: Canvas
    officeFloor: Canvas
    officeFloorTop: Canvas
    // Enemy frames face right; `left` versions are mirrored.
    bug: { walk: [Canvas, Canvas]; flat: Canvas }
    shredder: { right: [Canvas, Canvas]; left: [Canvas, Canvas] }
    boss: Record<BossFrame, Facing>
    stapler: Facing
}

function facing(rows: string[], colors: Record<string, string>): Facing {
    return { right: sprite(rows, colors), left: sprite(rows, colors, true) }
}

export function buildSprites(theme: Theme): Sprites {
    const p = palettes[theme]
    const tile = (paint: (ctx: Ctx) => void) => makeCanvas(TILE, TILE, paint)
    const frames = (source: Record<PlayerFrame, string[]>) => {
        const result = {} as Record<PlayerFrame, Facing>
        ;(Object.keys(source) as PlayerFrame[]).forEach((f) => (result[f] = facing(source[f], PLAYER_COLORS)))
        return result
    }

    return {
        palette: p,
        player: frames(SMALL_FRAMES),
        bigPlayer: frames(BIG_FRAMES),
        ground: tile((ctx) => paintGround(ctx, p, false, theme)),
        groundTop: tile((ctx) => paintGround(ctx, p, true, theme)),
        brick: tile((ctx) => paintBrick(ctx, p)),
        hard: tile((ctx) => paintHard(ctx, p)),
        block: tile((ctx) => paintBlock(ctx, p)),
        used: tile((ctx) => paintUsed(ctx, p)),
        pipe: {
            topL: tile((ctx) => paintPipe(ctx, p, 'topL')),
            topR: tile((ctx) => paintPipe(ctx, p, 'topR')),
            bodyL: tile((ctx) => paintPipe(ctx, p, 'bodyL')),
            bodyR: tile((ctx) => paintPipe(ctx, p, 'bodyR')),
        },
        coin: tile((ctx) => paintGrid(ctx, COIN, COIN_COLORS)),
        coffee: sprite(COFFEE, COFFEE_COLORS),
        officeFloor: tile((ctx) => paintOfficeFloor(ctx, false, theme)),
        officeFloorTop: tile((ctx) => paintOfficeFloor(ctx, true, theme)),
        bug: {
            walk: [sprite(BUG_1, BUG_COLORS), sprite(BUG_2, BUG_COLORS)],
            flat: sprite(BUG_FLAT, BUG_COLORS),
        },
        shredder: {
            right: [sprite(SHREDDER_1, SHREDDER_COLORS), sprite(SHREDDER_2, SHREDDER_COLORS)],
            left: [sprite(SHREDDER_1, SHREDDER_COLORS, true), sprite(SHREDDER_2, SHREDDER_COLORS, true)],
        },
        boss: {
            stand: facing(BOSS_FRAMES.stand, BOSS_COLORS),
            walk: facing(BOSS_FRAMES.walk, BOSS_COLORS),
            aim: facing(BOSS_FRAMES.aim, BOSS_COLORS),
        },
        stapler: facing(STAPLER, STAPLER_COLORS),
    }
}
