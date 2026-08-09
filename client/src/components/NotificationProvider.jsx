import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileUp, Users } from 'lucide-react'

const NotificationContext = createContext()

export const useNotifications = () => useContext(NotificationContext)

const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    socketRef.current = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    })
    const socket = socketRef.current

    socket.on('pengumpulan-baru', (data) => {
      addNotification({
        type: 'pengumpulan',
        title: `${data.namaFile}`,
        message: 'Berhasil mengumpulkan tugas baru.',
        icon: FileUp,
        color: 'text-green-500',
        bg: 'bg-green-50',
      })
    })

    socket.on('pengumpulan-update', (data) => {
      addNotification({
        type: 'update',
        title: 'Tugas diperbarui',
        message: `${data.namaFile} telah diunggah ulang.`,
        icon: FileUp,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
      })
    })

    socket.on('user-online', (data) => {
      addNotification({
        type: 'online',
        title: `${data.nama}`,
        message: 'bergabung ke ruangan.',
        icon: Users,
        color: 'text-purple-500',
        bg: 'bg-purple-50',
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const addNotification = (notif) => {
    const id = Date.now() + Math.random()
    setNotifications((prev) => [...prev.slice(-4), { ...notif, id }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 5000)
  }

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, socket: socketRef.current }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-3 w-80 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xl pointer-events-auto flex items-start gap-3"
            >
              <div className={`w-10 h-10 rounded-xl ${notif.bg} flex items-center justify-center flex-shrink-0`}>
                <notif.icon className={`w-5 h-5 ${notif.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{notif.title}</p>
                <p className="text-xs text-gray-500 truncate">{notif.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notif.id)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  )
}

export default NotificationProvider
