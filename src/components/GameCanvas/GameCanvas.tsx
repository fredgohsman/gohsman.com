import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from 'contexts'
import { Control, Game, RunResult } from 'game/engine'
import { LevelId, Section } from 'game/level'
import { TouchControls } from 'game/touchControls'
import { InfoPanel } from 'components/InfoPanel/InfoPanel'
import { GameMessage } from 'components/GameMessage/GameMessage'
import './GameCanvas.css'

interface IProps {
    started: boolean
}

interface OpenPanel {
    section: Section
    projectIndex?: number
}

interface RunEnd extends RunResult {
    outcome: 'clear' | 'gameover'
}

const isTouchDevice = () =>
    typeof window !== 'undefined' &&
    (('ontouchstart' in window && navigator.maxTouchPoints > 0) || window.matchMedia?.('(pointer: coarse)').matches)

// Runs the game on a canvas and shows the site's panels when the game asks for them.
export const GameCanvas = ({ started }: IProps) => {
    const { theme } = useContext(ThemeContext)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameRef = useRef<Game | null>(null)
    const [panel, setPanel] = useState<OpenPanel | null>(null)
    const [runEnd, setRunEnd] = useState<RunEnd | null>(null)
    const [foundProjects, setFoundProjects] = useState<number[]>([])
    const [touch] = useState(isTouchDevice)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const game = new Game(canvas, ctx, theme, {
            onOpen: (section, projectIndex) => {
                setPanel({ section, projectIndex })
                if (projectIndex !== undefined) {
                    setFoundProjects((found) => (found.includes(projectIndex) ? found : [...found, projectIndex]))
                }
            },
            onLevelComplete: (result) => setRunEnd({ ...result, outcome: 'clear' }),
            onGameOver: (result) => setRunEnd({ ...result, outcome: 'gameover' }),
        })
        gameRef.current = game
        game.start()
        // Handy for poking at the game from the browser console while developing.
        if (process.env.NODE_ENV === 'development') (window as any).__game = game

        const onResize = () => game.resize()
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
        observer?.observe(canvas)
        window.addEventListener('resize', onResize)

        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', onResize)
            game.stop()
            gameRef.current = null
        }
        // The game is created once; theme changes are passed in below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        gameRef.current?.setTheme(theme)
    }, [theme])

    useEffect(() => {
        gameRef.current?.setTouchMode(touch)
    }, [touch])

    useEffect(() => {
        if (started) gameRef.current?.begin()
    }, [started])

    const closePanel = useCallback(() => {
        setPanel(null)
        gameRef.current?.resume()
    }, [])

    const goToLevel = useCallback((id: LevelId) => {
        setPanel(null)
        setRunEnd(null)
        gameRef.current?.loadLevel(id)
    }, [])

    const onControl = useCallback((control: Control, down: boolean) => {
        gameRef.current?.setControl(control, down)
    }, [])

    return (
        <div className="game-canvas">
            <canvas ref={canvasRef} aria-hidden="true" />
            {started && touch && !panel && !runEnd && <TouchControls onControl={onControl} />}
            {panel && (
                <InfoPanel
                    section={panel.section}
                    projectIndex={panel.projectIndex}
                    projectsFound={foundProjects.length}
                    onClose={closePanel}
                    onNextLevel={() => goToLevel(2)}
                />
            )}
            {runEnd && (
                <GameMessage
                    title={runEnd.outcome === 'clear' ? 'Course Clear!' : 'Game Over'}
                    lines={[`Score ${runEnd.score}`, `Coins ${runEnd.coins}`]}
                    actions={[
                        { label: runEnd.outcome === 'clear' ? 'Play again' : 'Try again', onClick: () => goToLevel(2) },
                        { label: 'Back to 1-1', onClick: () => goToLevel(1) },
                    ]}
                />
            )}
        </div>
    )
}
