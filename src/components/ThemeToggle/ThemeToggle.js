import React from 'react'
import { ThemeContext } from '../../contexts'

/*
 * === NOTE =================================
 * Remember to add ThemeProvider to App.js and set darkMode: 'class' in tailwind.config.js
 * https://stackoverflow.com/questions/62269465/react-createcontext-default-value-problem-with-usestate-hook
 * ==========================================
 * */

export const ThemeToggle = () => {
    const { theme, setTheme } = React.useContext(ThemeContext)

    return (
        <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to day' : 'Switch to night'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            {theme === 'dark' ? (
                <i className="switch-dark la la-moon" />
            ) : (
                <i className="switch-light la la-sun" />
            )}
        </button>
    )
}
