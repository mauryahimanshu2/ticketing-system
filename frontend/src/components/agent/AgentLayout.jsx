import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Command, Headphones, LayoutDashboard, LogOut, Menu, Ticket, X } from 'lucide-react'
import { logoutUser } from '../../features/auth/authSlice.js'
import { formatPersonName, personInitials } from '../../utils/name.js'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside.js'
import '../dashboard/dashboard.css'
import './agent.css'
import './agent-controls.css'

export function AgentLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  useDismissOnOutside(profileRef, profileOpen, setProfileOpen)

  async function logout() {
    await dispatch(logoutUser())
    navigate('/auth', { replace: true })
  }

  return <div className="customer-app agent-app">
    {menuOpen && <button className="nav-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <aside className={`customer-sidebar agent-sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="dash-brand"><span><Command size={20} /></span><strong>Bitmax<i>.</i></strong><button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="agent-label"><Headphones size={14} />Agent workspace</div>
      <nav><NavLink to="/agent" end onClick={() => setMenuOpen(false)}><LayoutDashboard size={18} />Overview</NavLink><NavLink to="/agent/tickets" onClick={() => setMenuOpen(false)}><Ticket size={18} />Assigned tickets</NavLink></nav>
      <div className="sidebar-user"><span>{personInitials(user?.name, 'Agent')}</span><p><strong>{formatPersonName(user?.name, 'Agent')}</strong><small className="sidebar-role">Support agent</small><small className="sidebar-email">{user?.email}</small></p></div>
    </aside>
    <div className="customer-main"><header className="customer-topbar"><button className="mobile-nav-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><strong>Agent workspace</strong><small>Resolve assigned customer requests</small></div><div className="topbar-actions"><div className="profile-control" ref={profileRef}><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span>{personInitials(user?.name, 'Agent')}</span><p><strong>{formatPersonName(user?.name, 'Agent')}</strong></p></button>{profileOpen && <div className="profile-menu"><button onClick={logout}><LogOut size={15} />Logout</button></div>}</div></div></header><Outlet /></div>
  </div>
}
