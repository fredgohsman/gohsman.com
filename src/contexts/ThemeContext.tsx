import React from 'react'

const getInitialTheme = (): any => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const storedTheme = window.localStorage.getItem('app-theme')
        if (typeof storedTheme === 'string') {
            return storedTheme
        }

        const userMedia = window.matchMedia('(prefers-color-scheme: dark)')
        if (userMedia.matches) {
            return 'dark'
        }
    }

    return 'light' // light theme as the default;
}

export const ThemeContext = React.createContext<any>(getInitialTheme())

type ThemeProviderProps = {
    initialTheme?: string
    children?: React.ReactNode
}
export const ThemeProvider = ({ initialTheme, children }: ThemeProviderProps) => {
    const [theme, setTheme] = React.useState(getInitialTheme)

    const rawSetTheme = (rawTheme: string) => {
        const root = window.document.documentElement
        const isDark = rawTheme === 'dark'

        root.classList.remove(isDark ? 'light' : 'dark')
        root.classList.add(rawTheme)

        localStorage.setItem('app-theme', rawTheme)
    }

    if (initialTheme) {
        rawSetTheme(initialTheme)
    }

    React.useEffect(() => {
        rawSetTheme(theme)
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
