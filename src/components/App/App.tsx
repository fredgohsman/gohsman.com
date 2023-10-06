import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'contexts'
import { Home, Login, NotFound } from 'pages'
import { Content, Footer, Header, ThemeToggle } from 'components'
import './App.css'

export const App = () => {
    return (
        <ThemeProvider>
            <div className="app">
                <Header />
                <Content>
                <BrowserRouter basename={''}>
                    <Routes>
                        <Route path={'/'} element={<Home />} />
                        <Route path={'/login'} element={<Login />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
                </Content>
                <Footer />
            </div>
        </ThemeProvider>
    )
}
