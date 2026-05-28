import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'

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

  const handleSOS = () => {
    setLoading(true)
    setGeoError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setUserPos([lat, lng])
        setNearestHospitals(findNearestHospitals(lat, lng))
        setLoading(false)
      },
      () => {
        setGeoError('Không thể lấy vị trí. Vui lòng bật GPS và cho phép truy cập vị trí.')
        setLoading(false)
      }
    )
  }

  const feature = getFeatureById('sos')

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-6xl mx-auto">
      <FeaturePageBanner feature={feature} />
      <PageHeader
        title="Bản đồ SOS khẩn cấp"
        description="GPS thời gian thực + OpenStreetMap — bệnh viện gần nhất, hotline 115/113."
      />

      <div className="section-card bg-red-50 border-red-200 text-center py-10 sm:py-12">
        <button
          type="button"
          onClick={handleSOS}
          disabled={loading}
          className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-4xl sm:text-5xl shadow-lg shadow-red-500/30 transition-all disabled:opacity-70 flex items-center justify-center"
        >
          {loading ? (
            <span className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'SOS'
          )}
        </button>
        <p className="mt-6 text-lg font-medium text-red-900">
          Nhấn để xác định vị trí và tìm bệnh viện gần nhất
        </p>
        {geoError && <p className="mt-4 alert-error inline-block text-left">{geoError}</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {userPos && (
            <div className="alert-success">
              <p className="font-bold text-brand-900">Vị trí hiện tại</p>
              <p className="text-slate-700 mt-1">
                {userPos[0].toFixed(4)}° N, {userPos[1].toFixed(4)}° E
              </p>
              <p className="text-sm text-brand-800 mt-2 font-medium">
                Vui lòng gọi cấp cứu 115 nếu cần hỗ trợ ngay.
              </p>
            </div>
          )}

          <div className="section-card p-0 overflow-hidden">
            <div style={{ height: '400px', width: '100%' }}>
              <MapContainer
                center={userPos || DEFAULT_CENTER}
                zoom={userPos ? 15 : DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />
                {userPos && (
                  <Marker position={userPos} icon={userIcon}>
                    <Popup>Vị trí của bạn</Popup>
                  </Marker>
                )}
                {HOSPITALS.map((h) => (
                  <Marker key={h.id} position={[h.lat, h.lng]}>
                    <Popup>
                      <strong>{h.name}</strong>
                      <br />
                      <a href={`tel:${h.phone}`} className="text-brand-600 font-medium">
                        {h.phone}
                      </a>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {nearestHospitals.length > 0 ? (
            <div className="section-card">
              <h2 className="text-lg font-bold mb-4">Bệnh viện gần nhất</h2>
              <ul className="space-y-4">
                {nearestHospitals.map((h, idx) => (
                  <li key={h.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="font-bold text-slate-900">
                      {idx + 1}. {h.name}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Cách khoảng {h.distance.toFixed(2)} km
                    </p>
                    <a
                      href={`tel:${h.phone}`}
                      className="mt-3 block w-full text-center py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
                    >
                      Gọi cấp cứu
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="section-card text-center py-12 text-slate-500">
              Nhấn nút SOS để tìm bệnh viện gần bạn
            </div>
          )}

          <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
            <h3 className="font-bold text-red-900 mb-3">Gọi khẩn cấp</h3>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="tel:115"
                className="bg-white border-2 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-xl p-4 text-center transition-all"
              >
                <p className="text-xs text-slate-500 mb-1">Cấp cứu y tế</p>
                <p className="font-extrabold text-2xl text-red-600">115</p>
              </a>
              <a
                href="tel:113"
                className="bg-white border-2 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-xl p-4 text-center transition-all"
              >
                <p className="text-xs text-slate-500 mb-1">Cảnh sát</p>
                <p className="font-extrabold text-2xl text-red-600">113</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
