import { MarioColorText, ThemeToggle } from 'components'
import './Header.css'

export const Header = () => {
    return (
        <header className="app-header">
            <div className="app-header-left"></div>
            <div className="app-header-center">
                <MarioColorText text="Fred Gohsman" />
            </div>
            <div className="app-header-right">
                <ThemeToggle />
            </div>
        </header>
    )
}
