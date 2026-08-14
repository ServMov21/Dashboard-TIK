import { useState, useEffect } from 'react'
import { apiRequest } from '../utils/api'
import { getTitleFromXP, DEFAULT_TITLE_CONFIG } from '../utils/titleRank.jsx'

/**
 * Hook global untuk cek title up di mana saja (hanya untuk siswa).
 * Fetch stats saat mount, bandingkan dengan localStorage, trigger popup.
 */
export function useGlobalTitlePopup() {
  const [popupData, setPopupData] = useState(null)

  useEffect(() => {
    const checkTitle = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (user.role !== 'siswa') return

        const res = await apiRequest('/api/xp/siswa/stats')
        if (!res.ok) return
        const xpData = await res.json()

        const tc = xpData.xpCfg?.titleConfig || DEFAULT_TITLE_CONFIG
        const curTitle = getTitleFromXP(xpData.totalXP || 0, xpData.tasksCompleted || 0, tc)
        
        const storageKey = `prevTitle_${xpData.id || user.id || 'siswa'}`
        const prevTitleName = localStorage.getItem(storageKey)

        console.log('[DEBUG] checkTitle:', { prevTitleName, curTitleName: curTitle.name, totalXP: xpData.totalXP })

        if (prevTitleName && prevTitleName !== curTitle.name) {
          const prevTitle = tc.find(t => t.name === prevTitleName) || tc[0]
          const curIndex = tc.findIndex(t=>t.name===curTitle.name)
          const prevIndex = tc.findIndex(t=>t.name===prevTitle.name)
          const isUp = curIndex > prevIndex

          console.log('[DEBUG] title diff found:', { prevTitle: prevTitle.name, curTitle: curTitle.name, prevIndex, curIndex, isUp })
          
          if (isUp) {
            setPopupData({
              type: 'up',
              nama: user.nama,
              currentTitle: curTitle,
              prevTitle: prevTitle
            })
          } else {
            setPopupData({
              type: 'down',
              nama: user.nama,
              currentTitle: curTitle,
              prevTitle: prevTitle
            })
          }
          localStorage.setItem(storageKey, curTitle.name)
        } else if (!prevTitleName) {
          console.log('[DEBUG] initial set title storage:', curTitle.name)
          localStorage.setItem(storageKey, curTitle.name)
        }
      } catch (error) {
        console.error('Global title check failed:', error)
      }
    }

    checkTitle()

    // Listen for manual triggers (e.g. after task submission)
    window.addEventListener('xp-updated', checkTitle)
    return () => window.removeEventListener('xp-updated', checkTitle)
  }, [])

  return {
    popupData,
    clearPopup: () => setPopupData(null)
  }
}
