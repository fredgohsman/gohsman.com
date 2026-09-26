/*
 * Pixel art. Everything is original art drawn in code:
 * the player is defined as a grid of letters (one letter per pixel),
 * and the tiles are painted pixel-by-pixel onto small offscreen canvases.
 */

import { TILE } from './level'

export type Theme = 'light' | 'dark'

export interface Palette {
    sky: string
    star: string
    groundTop: string
    groundTopDark: string
    ground: string
    groundSpeck: string
    brick: string
    brickLight: string
    mortar: string
    hard: string
    hardLight: string
    hardDark: string
    block: string
    blockDark: string
    blockMark: string
    used: string
    usedDark: string
    pipe: string
    pipeLight: string
    pipeDark: string
    hill: string
    hillDark: string
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
        sky: '#5c94fc',
        star: '#ffffff',
        groundTop: '#3cb043',
        groundTopDark: '#1f7a2a',
        ground: '#c67c3c',
        groundSpeck: '#8a4f1f',
        brick: '#c84c0c',
        brickLight: '#fc9838',
        mortar: '#3a1c00',
        hard: '#b5651d',
        hardLight: '#f0b070',
        hardDark: '#5a2e0a',
        block: '#f8b800',
        blockDark: '#8a4c00',
        blockMark: '#fff4c8',
        used: '#9a5a2a',
        usedDark: '#4a2608',
        pipe: '#1fa01f',
        pipeLight: '#8ee85e',
        pipeDark: '#0a4a0a',
        hill: '#2e9e3a',
        hillDark: '#1b6b25',
        bush: '#48c048',
        cloud: '#ffffff',
        cloudShade: '#bcd8ff',
        castle: '#c84c0c',
        castleDark: '#3a1c00',
        label: '#ffffff',
        labelShadow: '#000000',
    },
    dark: {
        sky: '#0c1030',
        star: '#fff8d0',
        groundTop: '#8a8a8a',
        groundTopDark: '#4a4a4a',
        ground: '#5a5a5a',
        groundSpeck: '#333333',
        brick: '#2a5aa8',
        brickLight: '#6a9ae8',
        mortar: '#0a1028',
        hard: '#5a6a8a',
        hardLight: '#9aaacc',
        hardDark: '#1a2238',
        block: '#e8a000',
        blockDark: '#6a3a00',
        blockMark: '#fff0c0',
        used: '#5a4a3a',
        usedDark: '#221a10',
        pipe: '#138013',
        pipeLight: '#5cc04a',
        pipeDark: '#052805',
        hill: '#1a3a4a',
        hillDark: '#0e2230',
        bush: '#1e4a3a',
        cloud: '#4a5270',
        cloudShade: '#2a3050',
        castle: '#3a4a6a',
        castleDark: '#0a1028',
        label: '#fff8d0',
        labelShadow: '#c00000',
    },
}

type Canvas = HTMLCanvasElement

function makeCanvas(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): Canvas {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) paint(ctx)
    return canvas
}

// Draws a grid of letters, one pixel per letter. '.' is transparent.
function paintGrid(ctx: CanvasRenderingContext2D, rows: string[], colors: Record<string, string>, flip = false) {
    rows.forEach((row, y) => {
        row.split('').forEach((ch, x) => {
            const color = colors[ch]
            if (!color) return
            ctx.fillStyle = color
            ctx.fillRect(flip ? row.length - 1 - x : x, y, 1, 1)
        })
    })
}

// ---- Player ("Fred") -------------------------------------------------------

const PLAYER_COLORS: Record<string, string> = {
    H: '#5a3510', // hair
    S: '#f4c28e', // skin
    K: '#101010', // glasses
    T: '#8a3ab9', // shirt
    J: '#2a4fa0', // jeans
    O: '#3b2314', // shoes
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

const BODY = [
    '....TTTTTTT.....',
    '...TTTTTTTTT....',
    '..STTTTTTTTTS...',
    '..S.TTTTTTT.S...',
]

const BODY_JUMP = [
    '....TTTTTTT.S...',
    '...TTTTTTTTTS...',
    '..STTTTTTTTT....',
    '....TTTTTTT.....',
]

const LEGS_STAND = ['....JJJJJJJ.....', '....JJJ.JJJ.....', '....JJ...JJ.....', '...OOO...OOO....']
const LEGS_WALK1 = ['....JJJJJJJ.....', '...JJJ...JJJ....', '..JJ.......JJ...', '.OOO.......OOO..']
const LEGS_WALK2 = ['....JJJJJJJ.....', '.....JJJJJ......', '.....JJ.JJ......', '.....OO.OOO.....']
const LEGS_JUMP = ['....JJJJJJJ.....', '...JJJ...JJJ....', '..OJJ.....JJO...', '..OO.......OO...']

export type PlayerFrame = 'stand' | 'walk1' | 'walk2' | 'jump'

const PLAYER_FRAMES: Record<PlayerFrame, string[]> = {
    stand: [...HEAD, ...BODY, ...LEGS_STAND],
    walk1: [...HEAD, ...BODY, ...LEGS_WALK1],
    walk2: [...HEAD, ...BODY, ...LEGS_WALK2],
    jump: [...HEAD, ...BODY_JUMP, ...LEGS_JUMP],
}

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

function paintBlock(ctx: CanvasRenderingContext2D, p: Palette, fill: string, mark: boolean) {
    ctx.fillStyle = p.blockDark
    ctx.fillRect(0, 0, TILE, TILE)
    ctx.fillStyle = fill
    ctx.fillRect(1, 1, TILE - 2, TILE - 2)
    // Rivets in the corners.
    ctx.fillStyle = p.blockDark
    ;[
        [2, 2],
        [13, 2],
        [2, 13],
        [13, 13],
    ].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1))
    if (mark) paintGrid(ctx, QUESTION_MARK, { M: p.blockMark, D: p.blockDark })
}

function paintBrick(ctx: CanvasRenderingContext2D, p: Palette) {
    ctx.fillStyle = p.brick
    ctx.fillRect(0, 0, TILE, TILE)
    ctx.fillStyle = p.brickLight
    ctx.fillRect(0, 0, TILE, 1)
    ctx.fillStyle = p.mortar
    for (let band = 0; band < 4; band++) {
        const y = band * 4 + 3
        ctx.fillRect(0, y, TILE, 1)
        const offset = band % 2 === 0 ? 7 : 3
        ctx.fillRect(offset, band * 4, 1, 3)
        ctx.fillRect(offset + 8, band * 4, 1, 3)
    }
}

function paintHard(ctx: CanvasRenderingContext2D, p: Palette) {
    ctx.fillStyle = p.hard
    ctx.fillRect(0, 0, TILE, TILE)
    ctx.fillStyle = p.hardLight
    ctx.fillRect(0, 0, TILE, 2)
    ctx.fillRect(0, 0, 2, TILE)
    ctx.fillStyle = p.hardDark
    ctx.fillRect(0, TILE - 2, TILE, 2)
    ctx.fillRect(TILE - 2, 0, 2, TILE)
}

function paintUsed(ctx: CanvasRenderingContext2D, p: Palette) {
    ctx.fillStyle = p.usedDark
    ctx.fillRect(0, 0, TILE, TILE)
    ctx.fillStyle = p.used
    ctx.fillRect(1, 1, TILE - 2, TILE - 2)
    ctx.fillStyle = p.usedDark
    ;[
        [2, 2],
        [13, 2],
        [2, 13],
        [13, 13],
    ].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1))
}

// Small deterministic pseudo-random numbers so the ground specks don't flicker.
function specks(ctx: CanvasRenderingContext2D, color: string, fromY: number, seed: number) {
    ctx.fillStyle = color
    let s = seed
    for (let i = 0; i < 6; i++) {
        s = (s * 9301 + 49297) % 233280
        const x = s % TILE
        s = (s * 9301 + 49297) % 233280
        const y = fromY + (s % (TILE - fromY))
        ctx.fillRect(x, y, 2, 1)
    }
}

function paintGround(ctx: CanvasRenderingContext2D, p: Palette, top: boolean, theme: Theme) {
    ctx.fillStyle = p.ground
    ctx.fillRect(0, 0, TILE, TILE)
    if (theme === 'dark') {
        // Stone blocks.
        ctx.fillStyle = p.groundSpeck
        ctx.fillRect(0, 7, TILE, 1)
        ctx.fillRect(0, 15, TILE, 1)
        ctx.fillRect(5, 0, 1, 7)
        ctx.fillRect(12, 8, 1, 7)
        ctx.fillStyle = p.groundTop
        ctx.fillRect(0, 0, 5, 1)
        ctx.fillRect(6, 0, 10, 1)
        ctx.fillRect(0, 8, 12, 1)
        if (top) {
            ctx.fillStyle = p.groundTop
            ctx.fillRect(0, 0, TILE, 2)
        }
        return
    }
    specks(ctx, p.groundSpeck, top ? 6 : 0, top ? 7 : 13)
    if (top) {
        ctx.fillStyle = p.groundTop
        ctx.fillRect(0, 0, TILE, 4)
        // Jagged grass edge.
        ;[0, 3, 5, 9, 12, 14].forEach((x) => ctx.fillRect(x, 4, 2, 1))
        ;[1, 10].forEach((x) => ctx.fillRect(x, 5, 1, 1))
        ctx.fillStyle = p.groundTopDark
        ctx.fillRect(0, 0, TILE, 1)
    }
}

function paintPipe(ctx: CanvasRenderingContext2D, p: Palette, part: 'topL' | 'topR' | 'bodyL' | 'bodyR') {
    const isTop = part === 'topL' || part === 'topR'
    const isLeft = part === 'topL' || part === 'bodyL'
    // The body is 2px narrower than the lip on each side.
    const x0 = isTop || !isLeft ? 0 : 2
    const x1 = isTop || isLeft ? TILE : TILE - 2
    ctx.fillStyle = p.pipe
    ctx.fillRect(x0, 0, x1 - x0, TILE)
    ctx.fillStyle = p.pipeDark
    if (isLeft) {
        ctx.fillRect(x0, 0, 1, TILE)
        ctx.fillStyle = p.pipeLight
        ctx.fillRect(x0 + 2, 0, 3, TILE)
    } else {
        ctx.fillRect(x1 - 1, 0, 1, TILE)
        ctx.fillRect(x1 - 5, 0, 2, TILE)
    }
    if (isTop) {
        ctx.fillStyle = p.pipeDark
        ctx.fillRect(0, 0, TILE, 1)
        ctx.fillRect(0, TILE - 1, TILE, 1)
    }
}

function paintCoin(ctx: CanvasRenderingContext2D) {
    // 8x14 coin centred in a 16x16 cell.
    const rows = [
        '......DDDD......',
        '.....DYYYYD.....',
        '....DYYWWYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYWYYYYD....',
        '....DYYYYYDD....',
        '.....DYYYYD.....',
        '......DDDD......',
    ]
    ctx.translate(0, 1)
    paintGrid(ctx, rows, { D: '#8a4c00', Y: '#fcc000', W: '#fff4c8' })
}

// ---- Sprite sheet ------------------------------------------------------------

export interface Sprites {
    palette: Palette
    player: Record<PlayerFrame, { right: Canvas; left: Canvas }>
    ground: Canvas
    groundTop: Canvas
    brick: Canvas
    hard: Canvas
    block: Canvas
    used: Canvas
    pipe: Record<'topL' | 'topR' | 'bodyL' | 'bodyR', Canvas>
    coin: Canvas
}

export function buildSprites(theme: Theme): Sprites {
    const p = palettes[theme]
    const tile = (paint: (ctx: CanvasRenderingContext2D) => void) => makeCanvas(TILE, TILE, paint)

    const player = {} as Sprites['player']
    ;(Object.keys(PLAYER_FRAMES) as PlayerFrame[]).forEach((frame) => {
        player[frame] = {
            right: tile((ctx) => paintGrid(ctx, PLAYER_FRAMES[frame], PLAYER_COLORS)),
            left: tile((ctx) => paintGrid(ctx, PLAYER_FRAMES[frame], PLAYER_COLORS, true)),
        }
    })

    return {
        palette: p,
        player,
        ground: tile((ctx) => paintGround(ctx, p, false, theme)),
        groundTop: tile((ctx) => paintGround(ctx, p, true, theme)),
        brick: tile((ctx) => paintBrick(ctx, p)),
        hard: tile((ctx) => paintHard(ctx, p)),
        block: tile((ctx) => paintBlock(ctx, p, p.block, true)),
        used: tile((ctx) => paintUsed(ctx, p)),
        pipe: {
            topL: tile((ctx) => paintPipe(ctx, p, 'topL')),
            topR: tile((ctx) => paintPipe(ctx, p, 'topR')),
            bodyL: tile((ctx) => paintPipe(ctx, p, 'bodyL')),
            bodyR: tile((ctx) => paintPipe(ctx, p, 'bodyR')),
        },
        coin: tile(paintCoin),
    }
}
