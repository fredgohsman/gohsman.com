import { PointerEvent, useEffect } from 'react'
import { Control } from './engine'
import './touchControls.css'

interface IProps {
    onControl: (control: Control, down: boolean) => void
}

interface ControlsProps extends IProps {
    running: boolean
    onToggleRun: () => void
    // Shows the banana button (the boss-level easter egg).
    canThrow: boolean
}

interface ButtonProps extends IProps {
    control: Control
    label: string
    className?: string
}

const TouchButton = ({ control, label, className, onControl }: ButtonProps) => {
    const press = (down: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault()
        // Keep the button held even if the finger slides off it.
        if (down) {
            try {
                event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
                // Not all pointers can be captured; the button still works without it.
            }
        }
        onControl(control, down)
    }
    return (
        <button
            type="button"
            className={`touch-button ${className ?? ''}`}
            aria-label={control}
            onPointerDown={press(true)}
            onPointerUp={press(false)}
            onPointerCancel={press(false)}
            onLostPointerCapture={() => onControl(control, false)}
            onContextMenu={(event) => event.preventDefault()}
        >
            {label}
        </button>
    )
}

// On-screen buttons for phones and tablets.
// Run is a toggle rather than a hold, because one thumb can't hold Run and press Jump at once.
export const TouchControls = ({ onControl, running, onToggleRun, canThrow }: ControlsProps) => {
    // The game releases every control when a panel closes; re-apply Run whenever the buttons reappear.
    useEffect(() => {
        onControl('run', running)
    }, [onControl, running])

    return (
        <div className="touch-controls" aria-hidden="true">
            <div className="touch-pad">
                <TouchButton control="left" label="◀" onControl={onControl} />
                <TouchButton control="down" label="▼" onControl={onControl} />
                <TouchButton control="right" label="▶" onControl={onControl} />
            </div>
            <div className="touch-actions">
                {canThrow && <TouchButton control="throw" label="🍌" className="touch-throw" onControl={onControl} />}
                <button
                    type="button"
                    className={`touch-button touch-run ${running ? 'touch-run-on' : ''}`}
                    aria-label="run"
                    aria-pressed={running}
                    onPointerDown={(event) => {
                        event.preventDefault()
                        onToggleRun()
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    RUN
                </button>
                <TouchButton control="jump" label="A" className="touch-jump" onControl={onControl} />
            </div>
        </div>
    )
}
