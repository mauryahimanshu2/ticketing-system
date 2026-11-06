import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice.js'
import ticketsReducer from '../features/tickets/ticketsSlice.js'
import adminReducer from '../features/admin/adminSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tickets: ticketsReducer,
    admin: adminReducer,
  },
})
