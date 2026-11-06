import { render, screen } from '@testing-library/react'
import { App } from './App'

test('shows the title screen with a start button and a plain view link', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /press start/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /skip to plain view/i })).toBeInTheDocument()
})

test('includes the site content for screen readers', () => {
    render(<App />)
    expect(screen.getAllByRole('heading', { name: /about me/i }).length).toBeGreaterThan(0)
})
