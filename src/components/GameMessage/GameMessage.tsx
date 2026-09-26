import { useEffect, useRef } from 'react'
import 'components/InfoPanel/InfoPanel.css'
import './GameMessage.css'

export interface GameMessageAction {
    label: string
    onClick: () => void
}

interface IProps {
    title: string
    lines: string[]
    actions: GameMessageAction[]
}

// End-of-run box for World 1-2 ("Course Clear!" or "Game Over"), in the same style as the site panels.
export const GameMessage = ({ title, lines, actions }: IProps) => {
    const boxRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Focus the box, not a button, so a held Space from the last jump can't click one by accident.
        boxRef.current?.focus()
    }, [])

    return (
        <div className="info-panel-backdrop">
            <div ref={boxRef} tabIndex={-1} className="info-panel game-message" role="dialog" aria-modal="true" aria-label={title}>
                <h2>{title}</h2>
                {lines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
                <div className="game-message-actions">
                    {actions.map((action) => (
                        <button key={action.label} type="button" className="info-panel-continue" onClick={action.onClick}>
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
