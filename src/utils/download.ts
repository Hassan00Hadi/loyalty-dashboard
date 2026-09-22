/**
 * Hands a downloaded blob to the browser as a file.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari
 * reads the href asynchronously after the click, and revoking too early cancels
 * the download.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  // Kept out of the layout: the anchor exists only to be clicked.
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => URL.revokeObjectURL(url), 0)
}
