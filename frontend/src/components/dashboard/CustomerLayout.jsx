import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, Command, LayoutDashboard, LogOut, Menu, Plus, Ticket, X } from 'lucide-react'
import { logoutUser } from '../../features/auth/authSlice.js'
import { formatPersonName, personInitials } from '../../utils/name.js'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside.js'
import { CreateTicketModal } from './CreateTicketModal.jsx'
import './dashboard.css'

export function CustomerLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const profileRef = useRef(null)
  useDismissOnOutside(profileRef, profileOpen, setProfileOpen)

  async function logout() {
    await dispatch(logoutUser())
    navigate('/auth', { replace: true })
  }

  return (
    <div className="customer-app">
      {menuOpen && <button className="nav-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`customer-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="dash-brand"><span><Command size={20} /></span><strong>Bitmax<i>.</i></strong><button onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
        <nav>
          <NavLink to="/app" end onClick={() => setMenuOpen(false)}><LayoutDashboard size={18} />Overview</NavLink>
          <NavLink to="/app/tickets" onClick={() => setMenuOpen(false)}><Ticket size={18} />My tickets</NavLink>
        </nav>
        <div className="sidebar-help"><span>Need help?</span><strong>We’re here for you.</strong><button onClick={() => setCreateOpen(true)}><Plus size={15} />Create ticket</button></div>
        <div className="sidebar-user"><span>{personInitials(user?.name)}</span><p><strong>{formatPersonName(user?.name, 'Customer')}</strong><small className="sidebar-role">Customer</small><small className="sidebar-email">{user?.email}</small></p></div>
      </aside>

      <div className="customer-main">
        <header className="customer-topbar">
          <button className="mobile-nav-button" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div><strong>Customer support</strong><small>Track and manage your requests</small></div>
          <div className="topbar-actions">
            <button className="notification-button"><Bell size={18} /><i /></button>
            <div className="profile-control" ref={profileRef}>
              <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span>{personInitials(user?.name)}</span><p><strong>{formatPersonName(user?.name, 'Customer')}</strong></p></button>
              {profileOpen && <div className="profile-menu"><button onClick={logout}><LogOut size={15} />Logout</button></div>}
            </div>
          </div>
        </header>
        <Outlet context={{ openCreate: () => setCreateOpen(true) }} />
      </div>
      {createOpen && <CreateTicketModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
