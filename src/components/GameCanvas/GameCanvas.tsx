import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from 'contexts'
import { Control, Game } from 'game/engine'
import { Section } from 'game/level'
import { TouchControls } from 'game/touchControls'
import { InfoPanel } from 'components/InfoPanel/InfoPanel'
import './GameCanvas.css'

interface IProps {
    started: boolean
}

interface OpenPanel {
    section: Section
    projectIndex?: number
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

    const onControl = useCallback((control: Control, down: boolean) => {
        gameRef.current?.setControl(control, down)
    }, [])

    return (
        <div className="game-canvas">
            <canvas ref={canvasRef} aria-hidden="true" />
            {started && touch && !panel && <TouchControls onControl={onControl} />}
            {panel && (
                <InfoPanel
                    section={panel.section}
                    projectIndex={panel.projectIndex}
                    projectsFound={foundProjects.length}
                    onClose={closePanel}
                />
            )}
        </div>
    )
}
