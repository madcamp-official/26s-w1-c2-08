import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import RankingPage from './rank/ranking.jsx'

function App() {
  return (
    <>
      <nav className="site-nav">
        <NavLink className="site-brand" to="/">
          꿀템
        </NavLink>
        <div className="site-links">
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/ranking">랭킹</NavLink>
          <NavLink to="/itemreg">등록</NavLink>
          <NavLink to="/login">로그인</NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/itemreg" element={<ItemRegPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/:userId" element={<UserPage />} />
      </Routes>
    </>
  )
}

export default App
