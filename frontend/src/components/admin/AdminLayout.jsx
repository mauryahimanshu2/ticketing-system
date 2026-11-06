import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Activity, Command, Headphones, LayoutDashboard, LogOut, Menu, Settings, Ticket, Users, X } from 'lucide-react'
import { logoutUser } from '../../features/auth/authSlice.js'
import { formatPersonName, personInitials } from '../../utils/name.js'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside.js'
import '../dashboard/dashboard.css'
import './admin.css'

const links = [
  ['/admin', 'Overview', LayoutDashboard, true],
  ['/admin/tickets', 'Tickets', Ticket],
  ['/admin/users', 'Customers', Users],
  ['/admin/agents', 'Agents', Headphones],
  ['/admin/settings', 'Categories', Settings],
  ['/admin/audit', 'Audit logs', Activity],
]

export function AdminLayout() {
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

  return <div className="customer-app admin-app">
    {menuOpen && <button className="nav-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <aside className={`customer-sidebar admin-sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="dash-brand"><span><Command size={20} /></span><strong>Bitmax<i>.</i></strong><button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <nav>{links.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}><Icon size={18} />{label}</NavLink>)}</nav>
      <div className="sidebar-user"><span>{personInitials(user?.name, 'Admin')}</span><p><strong>{formatPersonName(user?.name, 'Administrator')}</strong><small className="sidebar-role">Administrator</small><small className="sidebar-email">{user?.email}</small></p></div>
    </aside>
    <div className="customer-main">
      <header className="customer-topbar">
        <button className="mobile-nav-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div><strong>Admin console</strong><small>Support operations and access management</small></div>
        <div className="topbar-actions">
          <div className="profile-control" ref={profileRef}>
            <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span>{personInitials(user?.name, 'Admin')}</span><p><strong>{formatPersonName(user?.name, 'Administrator')}</strong></p></button>
            {profileOpen && <div className="profile-menu"><button onClick={logout}><LogOut size={15} />Logout</button></div>}
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  </div>
}
