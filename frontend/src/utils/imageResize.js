/**
 * Resize ảnh trước khi gửi API (giảm dung lượng base64).
 */
export function resizeImageFile(file, maxWidth = 960, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('File không phải ảnh'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'))
    reader.onload = (event) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const dataUrl = canvas.toDataURL(mime, quality)
        resolve({
          dataUrl,
          mime,
          base64: dataUrl.split(',')[1],
        })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  })
}
