import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'contexts'
import { Home, NotFound, PlainView } from 'pages'
import { Content, Footer, Header } from 'components'
import './App.css'

export const App = () => {
    return (
        <ThemeProvider>
            <BrowserRouter basename={''}>
                <div className="app">
                    <Header />
                    <Content>
                        <Routes>
                            <Route path={'/'} element={<Home />} />
                            <Route path={'/plain'} element={<PlainView />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Content>
                    <Footer />
                </div>
            </BrowserRouter>
        </ThemeProvider>
    )
}
