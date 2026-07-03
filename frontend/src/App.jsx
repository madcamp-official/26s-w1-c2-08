<<<<<<< HEAD
import { NavLink, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
=======
import { Route, Routes } from 'react-router-dom'
>>>>>>> fbd6ebd3b5afd882150707b9e79ee3cf74ce7c88
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import RankingPage from './rank/ranking.jsx'

function App() {
  return (
<<<<<<< HEAD
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
=======
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/user/:userId" element={<UserPage />} />
      <Route path="/itemreg" element={<ItemRegPage />} />
      <Route path="/ranking" element={<RankingApp />} />
    </Routes>
>>>>>>> fbd6ebd3b5afd882150707b9e79ee3cf74ce7c88
  )
}

export default App
