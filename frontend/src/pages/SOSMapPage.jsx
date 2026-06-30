import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'
import api from '../api/axios'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này là module SOS Map.
  Input X: vị trí GPS của người dùng gồm latitude và longitude.
  Hàm xử lý f:
  - Geolocation API lấy tọa độ hiện tại.
  - OpenStreetMap/Nominatim chuyển tọa độ thành địa chỉ và tìm cơ sở y tế gần đó.
  - Backend /api/send-emergency-email gửi email SOS nếu người dùng nhập email liên hệ.
  Output y: bản đồ, marker vị trí, danh sách bệnh viện/cơ sở y tế gần nhất và trạng thái gửi email.
  Đây không phải ML, mà là tích hợp API bản đồ để hỗ trợ xử lý khẩn cấp ngoài đời thực.
*/

// Helper component to center map dynamically on position change
function ChangeMapView({ center }) {
  const map = useMap()
  if (center) {
    map.setView(center, 15)
  }
  return null
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const HOSPITALS = [
  { id: 1, name: 'Bệnh viện Chợ Rẫy', lat: 10.7553, lng: 106.66, phone: '08392325848' },
  { id: 2, name: 'Bệnh viện 115', lat: 10.7756, lng: 106.666, phone: '08392325115' },
  { id: 3, name: 'BV Nhân Dân Gia Định', lat: 10.8048, lng: 106.7147, phone: '08392327273' },
  { id: 4, name: 'BV Bình Dân', lat: 10.7795, lng: 106.6957, phone: '08392325858' },
  { id: 5, name: 'BV Đại học Y Dược', lat: 10.7582, lng: 106.6694, phone: '08392325900' },
]

const DEFAULT_CENTER = [10.7769, 106.7009]
const DEFAULT_ZOOM = 13

export default function SOSMapPage() {
  const [userPos, setUserPos] = useState(null)
  const [nearestHospitals, setNearestHospitals] = useState([])
  const [geoError, setGeoError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emergencyEmail, setEmergencyEmail] = useState(() => localStorage.getItem('emergency_email') || '')
  const [emailInput, setEmailInput] = useState(() => localStorage.getItem('emergency_email') || '')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [displayedHospitals, setDisplayedHospitals] = useState(HOSPITALS)
  const [emailStatus, setEmailStatus] = useState({ success: null, message: '', isWarning: false })
  const [emailLoading, setEmailLoading] = useState(false)

  const userIcon = new L.Icon({
    iconUrl:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzE2YTM0YSIvPjwvc3ZnPg==',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -10],
  })

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const findNearestHospitals = (lat, lng) =>
    HOSPITALS.map((h) => ({
      ...h,
      distance: calculateDistance(lat, lng, h.lat, h.lng),
    }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)

  const sendSOSEmail = async (lat, lng, hospitalsList, addressText) => {
    if (!emergencyEmail) {
      setEmailStatus({
        success: false,
        message: 'Chưa thiết lập Email người thân. Vui lòng điền email người nhận khẩn cấp ở ô bên phải để gửi thông báo SOS.',
        isWarning: false
      })
      return
    }

    setEmailLoading(true)
    setEmailStatus({ success: null, message: '', isWarning: false })

    let userId = null
    let userName = ''
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const u = JSON.parse(userStr)
        userId = u.user_id
        userName = u.full_name
      }
    } catch (e) {
      console.error(e)
    }

    try {
      const res = await api.post('/api/send-emergency-email', {
        user_id: userId,
        receiver_email: emergencyEmail,
        user_name: userName,
        latitude: lat,
        longitude: lng,
        address: addressText || 'Đang định vị...',
        hospitals: hospitalsList.map(h => ({
          name: h.name,
          phone: h.phone,
          distance: h.distance
        }))
      })

      if (res.data?.success) {
        setEmailStatus({
          success: true,
          message: res.data.message || `Đã gửi Email SOS chứa vị trí của bạn tới ${emergencyEmail}!`,
          isWarning: true
        })
      } else {
        setEmailStatus({
          success: false,
          message: 'Không thể gửi email cứu trợ. Vui lòng kiểm tra kết nối internet hoặc thử lại.',
          isWarning: false
        })
      }
    } catch (err) {
      console.error(err)
      setEmailStatus({
        success: false,
        message: 'Lỗi máy chủ gửi email. Đã tự động gửi thông tin thất bại, vui lòng liên hệ trực tiếp 115.',
        isWarning: false
      })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSOS = () => {
    setLoading(true)
    setGeoError('')
    setResolvedAddress('')
    setEmailStatus({ success: null, message: '', isWarning: false })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserPos([lat, lng])

        // 1. First reverse geocode to get address & detect region (urban vs rural)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: {
            'Accept-Language': 'vi',
            'User-Agent': 'SmartPreventiveHealthApp/1.0'
          }
        })
          .then(res => res.json())
          .then(async (data) => {
            const addr = data && data.display_name ? data.display_name : `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            setResolvedAddress(addr)

            // Determine search radius: 10km for city, 30km for rural area
            let delta = 0.3 // Default rural: 30km (approx 0.3 degrees)
            const addrStr = addr.toLowerCase()
            const isUrban = addrStr.includes('quận') || 
                            addrStr.includes('phường') || 
                            (addrStr.includes('thành phố') && !addrStr.includes('huyện'))
            
            if (isUrban) {
              delta = 0.1 // City: 10km (approx 0.1 degrees)
              console.log('[SOS] Định vị ở khu vực Thành thị/Thành phố. Phạm vi quét: 10km')
            } else {
              delta = 0.3 // Rural: 30km (approx 0.3 degrees)
              console.log('[SOS] Định vị ở khu vực Nông thôn. Phạm vi quét: 30km')
            }

            let nearby = []
            const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`

            // 2. Fetch real-time local hospitals inside the calculated viewbox (bounded=1)
            try {
              // Search for "bệnh viện"
              let osmRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=bệnh+viện&lat=${lat}&lon=${lng}&viewbox=${viewbox}&bounded=1&limit=10`,
                {
                  headers: {
                    'Accept-Language': 'vi',
                    'User-Agent': 'SmartPreventiveHealthApp/1.0'
                  }
                }
              )
              let osmData = await osmRes.json()

              // Fallback to "hospital" if no Vietnamese match
              if (!osmData || osmData.length === 0) {
                osmRes = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=hospital&lat=${lat}&lon=${lng}&viewbox=${viewbox}&bounded=1&limit=10`,
                  {
                    headers: {
                      'Accept-Language': 'vi',
                      'User-Agent': 'SmartPreventiveHealthApp/1.0'
                    }
                  }
                )
                osmData = await osmRes.json()
              }

              if (osmData && osmData.length > 0) {
                const mapped = osmData.map((item, idx) => {
                  const name = item.display_name.split(',')[0]
                  const hLat = parseFloat(item.lat)
                  const hLng = parseFloat(item.lon)
                  const distance = calculateDistance(lat, lng, hLat, hLng)
                  return {
                    id: `osm-${idx}`,
                    name: name,
                    lat: hLat,
                    lng: hLng,
                    distance: distance,
                    phone: '115'
                  }
                })
                mapped.sort((a, b) => a.distance - b.distance)
                nearby = mapped.slice(0, 3)
                setDisplayedHospitals(mapped)
              }
            } catch (osmErr) {
              console.error('Error fetching real-time local hospitals from OSM:', osmErr)
            }

            // Fallback to hardcoded list if no hospitals found nearby
            if (nearby.length === 0) {
              nearby = findNearestHospitals(lat, lng)
              setDisplayedHospitals(HOSPITALS)
            }

            setNearestHospitals(nearby)
            setLoading(false)

            // 3. Automatically send email if configured
            if (emergencyEmail) {
              sendSOSEmail(lat, lng, nearby, addr)
            } else {
              setEmailStatus({
                success: false,
                message: 'Đã xác định vị trí nhưng chưa gửi Email được. Vui lòng thiết lập Email người thân ở ô bên phải để nhận thông báo tự động lần sau.',
                isWarning: false
              })
            }
          })
          .catch(err => {
            console.error('Nominatim reverse geocoding/search error:', err)
            const fallbackAddr = `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            setResolvedAddress(fallbackAddr)
            
            // Fallback
            const nearby = findNearestHospitals(lat, lng)
            setNearestHospitals(nearby)
            setDisplayedHospitals(HOSPITALS)
            setLoading(false)
            
            if (emergencyEmail) {
              sendSOSEmail(lat, lng, nearby, fallbackAddr)
            }
          })
      },
      () => {
        setGeoError('Không thể lấy vị trí. Vui lòng bật GPS và cho phép truy cập vị trí.')
        setLoading(false)
      }
    )
  }
  const feature = getFeatureById('sos')
  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px] mx-auto min-h-screen text-slate-800 font-sans selection:bg-rose-500/10 selection:text-slate-900 space-y-6">
      <FeaturePageBanner feature={feature} />
      
      {/* Page Header */}
      <div className="bg-white/60 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-md">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-red-600 via-orange-500 to-rose-550 bg-clip-text text-transparent">
          Bản đồ SOS Khẩn Cấp
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
          GPS thời gian thực + OpenStreetMap — tìm bệnh viện gần nhất, hotline 115/113
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: Map view (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {userPos && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 shadow-sm flex items-start gap-3 animate-in fade-in duration-205">
              <span className="text-lg">📍</span>
              <div className="flex-1">
                <p className="font-extrabold text-xs uppercase tracking-wide">Vị trí hiện tại của bạn:</p>
                <p className="font-mono text-sm mt-0.5">
                  {userPos[0].toFixed(5)}° N, {userPos[1].toFixed(5)}° E
                </p>
                {resolvedAddress ? (
                  <p className="text-xs text-emerald-700 font-bold mt-1.5 leading-relaxed">
                    🏠 Địa chỉ: {resolvedAddress}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic mt-1.5 flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-slate-400 border-t-slate-600 rounded-full animate-spin" /> Đang định dạng địa chỉ thực tế từ bản đồ...
                  </p>
                )}
                <p className="text-[11px] text-emerald-600 font-extrabold mt-2 uppercase tracking-wider">
                  ⚠️ Lưu ý: Gọi ngay cấp cứu 115 hoặc di chuyển tới bệnh viện gần nhất nếu có thể!
                </p>
              </div>
            </div>
          )}

          {geoError && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 shadow-sm flex items-start gap-3 animate-in fade-in duration-205">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-extrabold text-xs uppercase tracking-wide">Lỗi định vị GPS:</p>
                <p className="text-xs text-rose-600 mt-1 leading-relaxed">{geoError}</p>
              </div>
            </div>
          )}

          {emailLoading && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 shadow-sm flex items-center gap-3 animate-pulse">
              <span className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-600 rounded-full animate-spin shrink-0" />
              <p className="text-xs font-bold">Hệ thống đang tiến hành gửi Email cảnh báo khẩn cấp SOS chứa vị trí và địa chỉ của bạn tới {emergencyEmail}...</p>
            </div>
          )}

          {emailStatus.message && (
            <div className={`p-4 rounded-xl shadow-sm flex items-start gap-3 animate-in fade-in duration-250 border ${
              emailStatus.success 
                ? 'bg-amber-50 border-amber-300 text-amber-900' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              <span className="text-lg">{emailStatus.success ? '🚨' : '⚠️'}</span>
              <div className="flex-1">
                <p className="font-extrabold text-xs uppercase tracking-wide">
                  {emailStatus.success ? 'Cảnh báo tự động gửi Email SOS:' : 'Lỗi gửi Email SOS:'}
                </p>
                <p className="text-xs mt-1 leading-relaxed font-semibold">{emailStatus.message}</p>
                {emailStatus.success && (
                  <p className="text-[10px] text-amber-700 font-bold mt-1.5 uppercase tracking-wide">
                    * Lưu ý: Do cuộc gọi di động có thể mất phí hoặc gặp sự cố, hệ thống đã gửi thư SOS khẩn cấp qua Internet chứa vị trí chính xác của bạn!
                  </p>
                )}
              </div>
              {userPos && !emailLoading && (
                <button
                  onClick={() => sendSOSEmail(userPos[0], userPos[1], nearestHospitals, resolvedAddress)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase transition-colors shrink-0 cursor-pointer shadow-sm self-center active:scale-95"
                >
                  Gửi lại
                </button>
              )}
            </div>
          )}

          {userPos && nearestHospitals.length > 0 && (
            <div className="bg-rose-50 border-2 border-red-200 p-4 sm:p-5 rounded-2xl text-rose-950 shadow-md flex items-start gap-3 sm:gap-4 animate-in slide-in-from-top duration-300">
              <span className="text-2xl sm:text-3xl animate-pulse shrink-0 mt-0.5">🏥</span>
              <div className="flex-1">
                <p className="font-extrabold text-[10px] sm:text-xs uppercase tracking-wider text-red-700 font-black">
                  Đã định vị bệnh viện gần bạn nhất:
                </p>
                <h3 className="font-black text-base sm:text-lg text-slate-900 mt-1">
                  {nearestHospitals[0].name}
                </h3>
                <p className="text-xs text-slate-600 font-bold mt-0.5">
                  Khoảng cách: <span className="text-red-650 font-black">{nearestHospitals[0].distance.toFixed(2)} km</span>
                </p>
                <div className="flex flex-wrap gap-2 mt-3.5">
                  <a
                    href={`tel:${nearestHospitals[0].phone}`}
                    className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-550 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-200/50 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    📞 Gọi Cấp Cứu: {nearestHospitals[0].phone}
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${nearestHospitals[0].lat},${nearestHospitals[0].lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    🗺️ Dẫn đường đi
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/60 p-2 rounded-2xl border border-slate-200/80 shadow-md overflow-hidden flex-1 min-h-[350px] lg:min-h-[500px] flex">
            <div className="w-full h-full relative rounded-xl overflow-hidden flex-1 min-h-[350px] lg:min-h-[500px]">
              <MapContainer
                center={userPos || DEFAULT_CENTER}
                zoom={userPos ? 15 : DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                {userPos && <ChangeMapView center={userPos} />}
                {userPos && (
                  <Marker position={userPos} icon={userIcon}>
                    <Popup>
                      <div className="text-center font-bold">Vị trí của bạn</div>
                    </Popup>
                  </Marker>
                )}
                {displayedHospitals.map((h) => (
                  <Marker key={h.id} position={[h.lat, h.lng]}>
                    <Popup>
                      <div className="p-1 font-sans">
                        <strong className="text-slate-800 font-bold text-sm block mb-1">{h.name}</strong>
                        <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs rounded-lg transition-colors border border-red-200">
                          📞 Gọi: {h.phone}
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SOS controls and Hospital list (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Giant red SOS button card - redesigned to be compact and premium */}
          <div className="bg-white/60 p-5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md text-center flex flex-col items-center justify-center relative overflow-hidden group">
            
            {/* Background ripple decoration */}
            <div className="absolute w-32 h-32 bg-red-500/5 rounded-full -top-6 -right-6 pointer-events-none group-hover:scale-150 transition-all duration-500" />
            
            {/* SOS button */}
            <button
              type="button"
              onClick={handleSOS}
              disabled={loading}
              className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white font-black text-3xl sm:text-4xl shadow-xl shadow-red-200/50 transition-all duration-200 disabled:opacity-75 flex items-center justify-center border-4 border-red-50 cursor-pointer"
            >
              {loading ? (
                <span className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] animate-pulse">SOS</span>
              )}
              {/* Outer pulsing ring */}
              {!loading && (
                <span className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping opacity-75 pointer-events-none" />
              )}
            </button>
            <p className="mt-4 text-xs sm:text-sm font-black text-red-700 uppercase tracking-wide">
              Nhấn để định vị bệnh viện gần bạn
            </p>
          </div>

          {/* Emergency Call Quick Grid */}
          <div className="bg-red-55 p-4 rounded-2xl border border-red-100/80 shadow-sm flex flex-col gap-3">
            <h3 className="font-extrabold text-xs text-red-800 uppercase tracking-wider">☎️ Đường dây nóng Cấp cứu:</h3>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="tel:115"
                className="bg-white border border-red-200 hover:border-red-600 hover:bg-red-50 hover:scale-[1.02] active:scale-95 rounded-xl p-3 text-center transition-all flex flex-col items-center justify-center shadow-sm"
              >
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Cấp cứu Y tế</span>
                <span className="font-black text-xl sm:text-2xl text-red-600">115</span>
              </a>
              <a
                href="tel:113"
                className="bg-white border border-red-200 hover:border-red-600 hover:bg-red-50 hover:scale-[1.02] active:scale-95 rounded-xl p-3 text-center transition-all flex flex-col items-center justify-center shadow-sm"
              >
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Cảnh sát</span>
                <span className="font-black text-xl sm:text-2xl text-red-600">113</span>
              </a>
            </div>
          </div>

          {/* Emergency Email Setup Card */}
          <div className="bg-white/60 p-5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 mb-3 pb-2 border-b border-slate-200/60 flex items-center gap-1.5">
              <span>📧</span> Email Cảnh Báo SOS
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed font-medium">
              Thiết lập email của người thân. Khi bạn nhấn nút <strong>SOS</strong> hoặc gặp tình huống khẩn cấp, hệ thống tự động gửi email thông báo kèm vị trí và địa chỉ của bạn.
            </p>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="emergency-email-input" className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email người nhận khẩn cấp:
                </label>
                <div className="flex gap-2">
                  <input
                    id="emergency-email-input"
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value)
                      if (saveSuccess) setSaveSuccess(false)
                    }}
                    placeholder="VD: nguoi-than@gmail.com"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-red-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => {
                      if (!emailInput || !emailInput.includes('@')) {
                        alert('Vui lòng nhập địa chỉ email hợp lệ.')
                        return
                      }
                      localStorage.setItem('emergency_email', emailInput)
                      setEmergencyEmail(emailInput)
                      setSaveSuccess(true)
                      setTimeout(() => setSaveSuccess(false), 3000)
                    }}
                    className="px-4 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    {saveSuccess ? '✓ Đã lưu' : 'Lưu'}
                  </button>
                </div>
              </div>
              
              {emergencyEmail && userPos && (
                <button
                  onClick={() => sendSOSEmail(userPos[0], userPos[1], nearestHospitals, resolvedAddress)}
                  disabled={emailLoading}
                  className="w-full text-center py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {emailLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>📧 Gửi Thử Email SOS</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Near Hospital list card */}
          {nearestHospitals.length > 0 ? (
            <div className="bg-white/60 p-5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md flex-1">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 mb-4 pb-2 border-b border-slate-200/60 flex items-center gap-1.5">
                <span>🏥</span> Bệnh viện gần nhất
              </h2>
              <ul className="space-y-3">
                {nearestHospitals.map((h, idx) => (
                  <li key={h.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 transition-all hover:bg-slate-100/50">
                    <div>
                      <p className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {idx + 1}. {h.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Khoảng cách: <strong className="text-slate-700 font-bold">{h.distance.toFixed(2)} km</strong>
                      </p>
                    </div>
                    <a
                      href={`tel:${h.phone}`}
                      className="w-full text-center py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-550 hover:to-rose-550 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      📞 Gọi Cấp Cứu
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white/60 p-6 rounded-2xl border border-slate-200/80 shadow-md text-center py-10 text-slate-500 text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-3 backdrop-blur-md flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                🏥
              </div>
              Nhấn nút SOS ở trên để tìm các bệnh viện gần vị trí của bạn nhất
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
