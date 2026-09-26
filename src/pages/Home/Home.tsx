import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { GameCanvas } from 'components/GameCanvas/GameCanvas'
import { MarioColorText } from 'components'
import { siteContent } from 'content/siteContent'
import { sound } from 'game/sound'
import { PlainContent } from 'pages/PlainView/PlainView'
import './Home.css'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export const Home = () => {
    const [started, setStarted] = useState(false)
    const [searchParams] = useSearchParams()
    // People who ask their device for less motion get the plain view, unless they chose to play.
    const skipGame = prefersReducedMotion() && searchParams.get('play') !== '1'

    const start = useCallback(() => {
        sound.unlock()
        setStarted(true)
    }, [])

    useEffect(() => {
        if (started) return
        const onKey = (event: KeyboardEvent) => {
            // Let Enter still follow a focused link, like "Skip to plain view".
            if (event.target instanceof HTMLAnchorElement) return
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault()
                start()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [started, start])

    if (skipGame) return <Navigate to="/plain" replace />

    return (
        <div className="home">
            <GameCanvas started={started} />
            {!started && (
                <div className="title-screen">
                    <div className="title-box">
                        <div className="title-name">
                            <MarioColorText text={siteContent.name} />
                        </div>
                        <p className="title-tagline">{siteContent.tagline}</p>
                        <button type="button" className="title-start" onClick={start}>
                            Press Start
                        </button>
                        <p className="title-help">Arrow keys to move · Space to jump · Hit the blocks</p>
                        <Link className="title-skip" to="/plain">
                            Skip to plain view
                        </Link>
                    </div>
                </div>
            )}
            {/* The same content for screen readers, which can't play the game. */}
            <div className="visually-hidden">
                <PlainContent />
            </div>
        </div>
    )
}
