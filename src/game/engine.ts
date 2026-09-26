/*
 * The game: input, the update loop, the camera and drawing.
 *
 * The React wrapper (components/GameCanvas) creates one Game per canvas,
 * and the game calls back into React when a site section should open.
 */

import { COLS, Decor, Level, ROWS, Section, TILE, buildLevel } from './level'
import { Body, PHYSICS, moveBody, overlappingTiles } from './physics'
import { Sprites, Theme, buildSprites } from './sprites'
import { sound } from './sound'

export type Control = 'left' | 'right' | 'up' | 'down' | 'jump' | 'run'

export interface GameCallbacks {
    onOpen: (section: Section, projectIndex?: number) => void
}

type State = 'title' | 'play' | 'pipeDown' | 'pipeUp' | 'flagSlide' | 'flagWalk' | 'panel'

// What to do when a panel is closed.
type ResumeAction = 'play' | 'pipeUp' | 'castleExit'

interface Bump {
    col: number
    row: number
    frame: number
}

interface CoinPop {
    x: number
    y: number
    vy: number
    frame: number
}

const STEP = 1000 / 60
// Always show at least this many tiles across, so narrow phone screens aren't zoomed right in.
const MIN_VIEW_COLS = 16
// Space kept below the level for the on-screen buttons on tall (portrait) touch screens, in CSS pixels.
const TOUCH_RESERVE = 110
const KEY_MAP: Record<string, Control> = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'jump',
    KeyZ: 'jump',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyX: 'run',
}

export class Game {
    private readonly canvas: HTMLCanvasElement
    private readonly ctx: CanvasRenderingContext2D
    private readonly callbacks: GameCallbacks
    private readonly level: Level
    private sprites: Sprites
    private theme: Theme

    private state: State = 'title'
    private resumeAction: ResumeAction = 'play'
    private controls: Record<Control, boolean> = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
    }
    private jumpWasDown = false
    private hasMoved = false
    private touchMode = false

    private player: Body
    private facing: 'left' | 'right' = 'right'
    private walkFrame = 0
    private lastSafe: { x: number; y: number }
    private timer = 0
    private hidden = false
    private flagY: number
    private flagDone = false

    private coins = 0
    private bumps: Bump[] = []
    private coinPops: CoinPop[] = []
    private projectIndexes: Record<string, number> = {}
    private stars: { x: number; y: number }[] = []

    private scale = 1
    private viewWidth = 0
    // Sky above the level, in level pixels (non-zero when the screen is taller than the level).
    private offsetY = 0
    private camX = 0
    private frame = 0
    private rafId = 0
    private lastTime = 0
    private accumulator = 0

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, theme: Theme, callbacks: GameCallbacks) {
        this.canvas = canvas
        this.ctx = ctx
        this.callbacks = callbacks
        this.theme = theme
        this.sprites = buildSprites(theme)
        this.level = buildLevel()

        const { start } = this.level
        this.player = { x: start.col * TILE + 2, y: start.row * TILE, w: 12, h: 16, vx: 0, vy: 0, onGround: true }
        this.lastSafe = { x: this.player.x, y: this.player.y }
        this.flagY = 3 * TILE
        this.indexProjects()
        this.makeStars()
    }

    // ---- Public API ---------------------------------------------------------

    start() {
        window.addEventListener('keydown', this.handleKeyDown)
        window.addEventListener('keyup', this.handleKeyUp)
        window.addEventListener('blur', this.releaseAll)
        this.resize()
        this.lastTime = performance.now()
        this.rafId = requestAnimationFrame(this.tick)
    }

    stop() {
        cancelAnimationFrame(this.rafId)
        window.removeEventListener('keydown', this.handleKeyDown)
        window.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('blur', this.releaseAll)
    }

    // Leaves the title screen and hands control to the player.
    begin() {
        if (this.state === 'title') this.state = 'play'
    }

    // Called when a panel is closed.
    resume() {
        if (this.state !== 'panel') return
        this.releaseAll()
        if (this.resumeAction === 'pipeUp') {
            this.state = 'pipeUp'
            this.timer = 0
        } else if (this.resumeAction === 'castleExit') {
            this.hidden = false
            this.state = 'play'
        } else {
            this.state = 'play'
        }
    }

    setTheme(theme: Theme) {
        if (theme === this.theme) return
        this.theme = theme
        this.sprites = buildSprites(theme)
    }

    // Touch devices get shorter on-screen hints.
    setTouchMode(touch: boolean) {
        this.touchMode = touch
        this.resize()
    }

    setControl(control: Control, down: boolean) {
        this.controls[control] = down
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr))
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr))
        const reserve = this.touchMode && rect.height > rect.width ? TOUCH_RESERVE * dpr : 0
        const available = Math.max(1, this.canvas.height - reserve)
        this.scale = Math.min(available / (ROWS * TILE), this.canvas.width / (MIN_VIEW_COLS * TILE))
        this.viewWidth = this.canvas.width / this.scale
        this.offsetY = available / this.scale - ROWS * TILE
        this.updateCamera(true)
        this.draw()
    }

    // ---- Input --------------------------------------------------------------

    private handleKeyDown = (event: KeyboardEvent) => {
        const control = KEY_MAP[event.code]
        if (!control || this.state === 'panel' || this.state === 'title') return
        event.preventDefault()
        this.controls[control] = true
    }

    private handleKeyUp = (event: KeyboardEvent) => {
        const control = KEY_MAP[event.code]
        if (!control) return
        this.controls[control] = false
    }

    private releaseAll = () => {
        ;(Object.keys(this.controls) as Control[]).forEach((c) => (this.controls[c] = false))
    }

    // ---- Loop ---------------------------------------------------------------

    private tick = (now: number) => {
        // Cap the catch-up so a background tab doesn't fast-forward the game.
        this.accumulator += Math.min(now - this.lastTime, 250)
        this.lastTime = now
        while (this.accumulator >= STEP) {
            this.update()
            this.accumulator -= STEP
        }
        this.draw()
        this.rafId = requestAnimationFrame(this.tick)
    }

    private update() {
        this.frame++
        this.updateEffects()

        switch (this.state) {
            case 'play':
                this.updatePlay()
                break
            case 'pipeDown':
                this.player.y += 0.8
                if (++this.timer >= 22) this.openSection('work', undefined, 'pipeUp')
                break
            case 'pipeUp':
                this.player.y -= 0.8
                if (++this.timer >= 22) {
                    this.player.y = Math.round(this.player.y)
                    this.state = 'play'
                }
                break
            case 'flagSlide':
                this.updateFlagSlide()
                break
            case 'flagWalk':
                this.updateFlagWalk()
                break
        }
        this.updateCamera(false)
    }

    private updatePlay() {
        const p = this.player
        const c = this.controls
        const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0)
        const maxSpeed = c.run ? PHYSICS.runSpeed : PHYSICS.walkSpeed

        if (dir !== 0) {
            this.hasMoved = true
            const turning = Math.sign(p.vx) === -dir
            p.vx += dir * (turning ? PHYSICS.turnAccel : PHYSICS.accel)
            this.facing = dir > 0 ? 'right' : 'left'
        } else {
            const friction = p.onGround ? PHYSICS.groundFriction : PHYSICS.airFriction
            p.vx = Math.abs(p.vx) <= friction ? 0 : p.vx - Math.sign(p.vx) * friction
        }
        p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx))

        const jumpDown = c.jump || c.up
        if (jumpDown && !this.jumpWasDown && p.onGround) {
            p.vy = -(PHYSICS.jumpVelocity + Math.abs(p.vx) * 0.2)
            this.hasMoved = true
            sound.play('jump')
        }
        this.jumpWasDown = jumpDown

        const gravity = p.vy < 0 && jumpDown ? PHYSICS.gravityHeld : PHYSICS.gravity
        p.vy = Math.min(p.vy + gravity, PHYSICS.maxFall)

        const bump = moveBody(p, this.level.tiles)
        if (bump) this.bumpTile(bump.col, bump.row)

        if (p.onGround) this.lastSafe = { x: p.x, y: p.y }
        this.walkFrame = p.onGround && p.vx !== 0 ? this.walkFrame + Math.abs(p.vx) * 0.12 : 0

        this.collectCoins()

        // Fell in the pit: put the player back where they last stood.
        if (p.y > ROWS * TILE + 32) {
            p.x = this.lastSafe.x
            p.y = this.lastSafe.y
            p.vx = 0
            p.vy = 0
        }

        if (p.onGround && c.down && this.isOnWorkPipe()) {
            this.state = 'pipeDown'
            this.timer = 0
            p.vx = 0
            sound.play('pipe')
        }

        const poleX = this.level.flagCol * TILE + 7
        if (this.flagDone && p.x < poleX - 3 * TILE) {
            // Walked back past the pole: raise the flag so it can be replayed.
            this.flagDone = false
            this.flagY = 3 * TILE
        }
        // Touching the pole or its base block grabs the flag.
        if (!this.flagDone && p.x + p.w >= this.level.flagCol * TILE - 1) {
            this.flagDone = true
            this.state = 'flagSlide'
            p.x = poleX - p.w + 1
            p.vx = 0
            p.vy = 0
            this.facing = 'right'
            sound.play('flag')
        }
    }

    private updateFlagSlide() {
        const p = this.player
        const baseTop = 12 * TILE
        p.y = Math.min(p.y + 2, baseTop - p.h)
        this.flagY = Math.min(this.flagY + 2, baseTop - 12)
        if (p.y >= baseTop - p.h && this.flagY >= baseTop - 12) {
            this.state = 'flagWalk'
            p.x = this.level.flagCol * TILE + TILE
        }
    }

    private updateFlagWalk() {
        const p = this.player
        p.vx = 1.2
        p.vy = Math.min(p.vy + PHYSICS.gravity, PHYSICS.maxFall)
        moveBody(p, this.level.tiles)
        this.walkFrame += 0.15
        const doorX = (this.level.castleCol + 2) * TILE
        if (p.x >= doorX) {
            p.vx = 0
            this.hidden = true
            this.openSection('contact', undefined, 'castleExit')
        }
    }

    private openSection(section: Section, projectIndex: number | undefined, then: ResumeAction) {
        this.state = 'panel'
        this.resumeAction = then
        this.player.vx = 0
        sound.play('open')
        this.callbacks.onOpen(section, projectIndex)
    }

    // ---- Blocks and coins ---------------------------------------------------

    private indexProjects() {
        let index = 0
        this.level.tiles.forEach((row, r) =>
            row.forEach((tile, c) => {
                if (tile === 'P') this.projectIndexes[`${c},${r}`] = index++
            })
        )
    }

    private bumpTile(col: number, row: number) {
        const tiles = this.level.tiles
        const tile = tiles[row][col]
        const key = `${col},${row}`

        if ('B?AaPp'.includes(tile)) {
            this.bumps.push({ col, row, frame: 0 })
        }
        switch (tile) {
            case '?':
                tiles[row][col] = 'U'
                this.addCoin(col, row)
                break
            case 'A':
                tiles[row][col] = 'a'
                this.addCoin(col, row)
                this.openSection('about', undefined, 'play')
                break
            case 'a':
                this.openSection('about', undefined, 'play')
                break
            case 'P':
                tiles[row][col] = 'p'
                this.addCoin(col, row)
                this.openSection('project', this.projectIndexes[key], 'play')
                break
            case 'p':
                this.openSection('project', this.projectIndexes[key], 'play')
                break
            default:
                sound.play('bump')
        }
    }

    private addCoin(col: number, row: number) {
        this.coins++
        this.coinPops.push({ x: col * TILE, y: (row - 1) * TILE, vy: -4, frame: 0 })
        sound.play('coin')
    }

    private collectCoins() {
        overlappingTiles(this.player).forEach(({ col, row }) => {
            if (this.level.tiles[row][col] === 'o') {
                this.level.tiles[row][col] = '.'
                this.coins++
                sound.play('coin')
            }
        })
    }

    private isOnWorkPipe() {
        const p = this.player
        const row = Math.floor((p.y + p.h) / TILE)
        const tiles = this.level.tiles[row]
        if (!tiles) return false
        const centre = p.x + p.w / 2
        const col = Math.floor(centre / TILE)
        const pipeCol = tiles[col] === 'W' ? col : tiles[col - 1] === 'W' ? col - 1 : -1
        if (pipeCol < 0) return false
        // Require the player to be roughly centred on the pipe.
        return centre > pipeCol * TILE + 6 && centre < pipeCol * TILE + 2 * TILE - 6
    }

    private updateEffects() {
        this.bumps = this.bumps.filter((b) => ++b.frame < 10)
        this.coinPops = this.coinPops.filter((c) => {
            c.y += c.vy
            c.vy += 0.25
            return ++c.frame < 32
        })
    }

    // ---- Camera -------------------------------------------------------------

    private updateCamera(snap: boolean) {
        const levelWidth = COLS * TILE
        const target = this.player.x - this.viewWidth * 0.4
        const max = Math.max(0, levelWidth - this.viewWidth)
        const clamped = Math.max(0, Math.min(max, target))
        this.camX = snap ? clamped : this.camX + (clamped - this.camX) * 0.2
    }

    // ---- Drawing ------------------------------------------------------------

    private makeStars() {
        let s = 42
        for (let i = 0; i < 70; i++) {
            s = (s * 9301 + 49297) % 233280
            const x = s % (COLS * TILE)
            s = (s * 9301 + 49297) % 233280
            // Spread stars into the extra sky that tall screens show above the level.
            const y = (s % (15 * TILE)) - 6 * TILE
            this.stars.push({ x, y })
        }
    }

    private draw() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const scale = this.scale
        // Snap the camera to whole screen pixels so tiles don't shimmer.
        const camX = Math.round(this.camX * scale) / scale

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = p.sky
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        const offsetY = Math.round(this.offsetY * scale)
        ctx.setTransform(scale, 0, 0, scale, -camX * scale, offsetY)

        if (this.theme === 'dark') {
            ctx.fillStyle = p.star
            this.stars.forEach((star) => {
                const twinkle = (star.x + this.frame) % 90 < 6
                ctx.fillRect(star.x, star.y, twinkle ? 2 : 1, twinkle ? 2 : 1)
            })
        }

        this.level.decor.forEach((d) => this.drawDecor(d))
        this.drawCastle()
        this.drawLabels()

        const behindPipe = this.state === 'pipeDown' || this.state === 'pipeUp'
        if (behindPipe) this.drawPlayer()
        this.drawTiles(camX)
        this.drawBelowLevel(camX)
        this.drawFlag()
        this.drawCoinPops()
        if (!behindPipe) this.drawPlayer()

        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        this.drawHud()
    }

    private drawTiles(camX: number) {
        const ctx = this.ctx
        const s = this.sprites
        const tiles = this.level.tiles
        const first = Math.max(0, Math.floor(camX / TILE))
        const last = Math.min(COLS - 1, Math.ceil((camX + this.viewWidth) / TILE))
        const coinWidth = Math.abs(Math.cos(this.frame / 12))

        for (let row = 0; row < ROWS; row++) {
            for (let col = first; col <= last; col++) {
                const tile = tiles[row][col]
                if (tile === '.') continue
                const bump = this.bumps.find((b) => b.col === col && b.row === row)
                const x = col * TILE
                const y = row * TILE - (bump ? Math.sin((bump.frame / 10) * Math.PI) * 5 : 0)

                let sprite: HTMLCanvasElement | null = null
                switch (tile) {
                    case '#':
                        sprite = row > 0 && tiles[row - 1][col] === '#' ? s.ground : s.groundTop
                        break
                    case 'B':
                        sprite = s.brick
                        break
                    case 'X':
                        sprite = s.hard
                        break
                    case '?':
                    case 'A':
                    case 'P':
                        sprite = s.block
                        break
                    case 'U':
                    case 'a':
                    case 'p':
                        sprite = s.used
                        break
                    case '[':
                    case 'W':
                        sprite = s.pipe.topL
                        break
                    case ']':
                        sprite = s.pipe.topR
                        break
                    case '{':
                        sprite = s.pipe.bodyL
                        break
                    case '}':
                        sprite = s.pipe.bodyR
                        break
                    case 'o': {
                        const w = Math.max(2, TILE * coinWidth)
                        ctx.drawImage(s.coin, x + (TILE - w) / 2, y, w, TILE)
                        break
                    }
                }
                if (sprite) ctx.drawImage(sprite, x, y)
                // Unopened blocks pulse gently so they read as "hit me".
                if (tile === '?' || tile === 'A' || tile === 'P') {
                    const glow = (Math.sin(this.frame / 10) + 1) / 2
                    ctx.fillStyle = `rgba(255,255,255,${glow * 0.25})`
                    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2)
                }
            }
        }
    }

    // Tall touch screens show space below the level for the buttons: continue the ground there.
    private drawBelowLevel(camX: number) {
        const depth = this.canvas.height / this.scale - this.offsetY - ROWS * TILE
        if (depth <= 0) return
        this.ctx.fillStyle = this.sprites.palette.ground
        const first = Math.max(0, Math.floor(camX / TILE))
        const last = Math.min(COLS - 1, Math.ceil((camX + this.viewWidth) / TILE))
        for (let col = first; col <= last; col++) {
            if (this.level.tiles[ROWS - 1][col] === '#') {
                this.ctx.fillRect(col * TILE, ROWS * TILE, TILE, depth + 1)
            }
        }
    }

    private drawPlayer() {
        if (this.hidden) return
        const p = this.player
        const frames = this.sprites.player
        let frame: keyof typeof frames = 'stand'
        if (this.state === 'flagSlide') frame = 'jump'
        else if (!p.onGround && this.state === 'play') frame = 'jump'
        else if (p.vx !== 0) frame = Math.floor(this.walkFrame) % 2 === 0 ? 'walk1' : 'walk2'
        const sprite = frames[frame][this.facing]
        this.ctx.drawImage(sprite, Math.round(p.x - 2), Math.round(p.y))
    }

    private drawCoinPops() {
        const w = Math.abs(Math.cos(this.frame / 3)) * TILE
        this.coinPops.forEach((c) => {
            this.ctx.drawImage(this.sprites.coin, c.x + (TILE - Math.max(2, w)) / 2, c.y, Math.max(2, w), TILE)
        })
    }

    private drawFlag() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const poleX = this.level.flagCol * TILE + 7
        const top = 2 * TILE
        ctx.fillStyle = p.pipeLight
        ctx.fillRect(poleX, top, 2, 12 * TILE - top)
        // Ball on top.
        ctx.fillStyle = p.pipe
        ctx.fillRect(poleX - 2, top - 5, 6, 6)
        ctx.fillStyle = p.pipeDark
        ctx.fillRect(poleX - 2, top - 5, 6, 1)
        // The flag: a white pennant with a star.
        ctx.fillStyle = '#ffffff'
        for (let i = 0; i < 12; i++) {
            const len = 14 - Math.abs(6 - i) * 2
            ctx.fillRect(poleX - len, this.flagY + i, len, 1)
        }
        ctx.fillStyle = p.block
        ctx.fillRect(poleX - 8, this.flagY + 4, 4, 4)
    }

    private drawCastle() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const x = this.level.castleCol * TILE
        const ground = 13 * TILE
        const brick = (bx: number, by: number, w: number, h: number) => {
            ctx.fillStyle = p.castle
            ctx.fillRect(bx, by, w, h)
            ctx.fillStyle = p.castleDark
            for (let y = by + 3; y < by + h; y += 4) ctx.fillRect(bx, y, w, 1)
            for (let y = by; y < by + h; y += 4) {
                const offset = (y / 4) % 2 === 0 ? 0 : 4
                for (let xx = bx + offset; xx < bx + w; xx += 8) ctx.fillRect(xx, y, 1, 3)
            }
        }
        // Lower wall, battlements, tower.
        brick(x, ground - 3 * TILE, 5 * TILE, 3 * TILE)
        for (let i = 0; i < 5; i++) brick(x + i * TILE + 2, ground - 3 * TILE - 8, 12, 8)
        brick(x + TILE, ground - 5 * TILE, 3 * TILE, 2 * TILE - 8)
        for (let i = 0; i < 3; i++) brick(x + TILE + i * TILE + 2, ground - 5 * TILE - 8, 12, 8)
        // Door and window.
        ctx.fillStyle = '#000000'
        ctx.fillRect(x + 2 * TILE, ground - 2 * TILE, TILE, 2 * TILE)
        ctx.fillRect(x + 2 * TILE + 2, ground - 2 * TILE - 4, TILE - 4, 4)
        ctx.fillRect(x + 2 * TILE + 4, ground - 4 * TILE - 4, TILE - 8, 12)
    }

    private drawDecor(d: Decor) {
        const ctx = this.ctx
        const p = this.sprites.palette
        const x = d.col * TILE
        const y = d.row * TILE
        if (d.kind === 'hill') {
            // A stepped mound, `size` tiles tall.
            const height = d.size * TILE
            for (let i = 0; i < height; i++) {
                const half = Math.round(Math.sqrt(1 - Math.pow(1 - i / height, 2)) * height * 1.2)
                ctx.fillStyle = p.hill
                ctx.fillRect(x + height * 1.2 - half, y - height + i, half * 2, 1)
            }
            ctx.fillStyle = p.hillDark
            ctx.fillRect(x + height * 1.2 - 3, y - height + 8, 2, 4)
            ctx.fillRect(x + height * 1.2 + 4, y - height + 12, 2, 4)
        } else {
            // Clouds and bushes share a shape: a row of puffs.
            const width = (d.size + 1) * TILE
            ctx.fillStyle = d.kind === 'cloud' ? p.cloud : p.bush
            for (let i = 0; i <= d.size; i++) {
                const cx = x + 8 + i * TILE
                ctx.fillRect(cx - 6, y - 14, 12, 14)
                ctx.fillRect(cx - 8, y - 10, 16, 10)
            }
            ctx.fillRect(x, y - 8, width + 8, 8)
            if (d.kind === 'cloud') {
                ctx.fillStyle = p.cloudShade
                ctx.fillRect(x + 2, y - 2, width + 4, 2)
            }
        }
    }

    private drawLabels() {
        const ctx = this.ctx
        const p = this.sprites.palette
        ctx.font = '10px SuperMario256, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        this.level.labels.forEach((label) => {
            const x = label.col * TILE
            const bob = Math.sin(this.frame / 20 + label.col) * 1.5
            const y = label.row * TILE + bob
            ctx.fillStyle = p.labelShadow
            ctx.fillText(label.text, x + 1, y + 1)
            ctx.fillStyle = p.label
            ctx.fillText(label.text, x, y)
            if (label.arrow) {
                // A little down arrow pointing at the pipe.
                const ay = y + 10
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = p.labelShadow
                    ctx.fillRect(x - 5 + i + 1, ay + i + 1, 10 - i * 2, 1)
                    ctx.fillStyle = p.label
                    ctx.fillRect(x - 5 + i, ay + i, 10 - i * 2, 1)
                }
            }
        })
    }

    private drawHud() {
        const ctx = this.ctx
        const p = this.sprites.palette
        const coins = String(this.coins).padStart(2, '0')
        ctx.font = '9px SuperMario256, monospace'
        ctx.textBaseline = 'top'
        const text = (value: string, x: number, y: number, align: CanvasTextAlign) => {
            ctx.textAlign = align
            ctx.fillStyle = p.labelShadow
            ctx.fillText(value, x + 1, y + 1)
            ctx.fillStyle = p.label
            ctx.fillText(value, x, y)
        }
        text('FRED', 12, 8, 'left')
        ctx.drawImage(this.sprites.coin, 12, 19, 8, 8)
        text(`x ${coins}`, 22, 19, 'left')
        text('WORLD', this.viewWidth - 12, 8, 'right')
        text('1-1', this.viewWidth - 12, 19, 'right')

        if (this.state === 'play' && !this.hasMoved) {
            const lines = this.touchMode
                ? ['HIT THE BLOCKS!', 'DOWN ENTERS PIPES']
                : ['ARROWS OR A/D TO MOVE   SPACE TO JUMP', 'HIT THE BLOCKS  -  DOWN TO ENTER PIPES']
            lines.forEach((line, i) => text(line, this.viewWidth / 2, 40 + i * 12, 'center'))
        }
    }
}
