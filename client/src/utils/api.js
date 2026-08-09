/**
 * API fetch wrapper to handle auth errors and base configurations.
 */
export const apiRequest = async (url, options = {}) => {
  const { skipAuthRedirect = false, ...fetchOptions } = options
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  }

  // Handle FormData headers (browser handles boundary automatically if Content-Type is omitted)
  if (fetchOptions.body instanceof FormData) {
    delete headers['Content-Type']
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  if (response.status === 401 && !skipAuthRedirect) {
    // Token expired or invalid, auto logout (skip during login attempts)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Sesi Anda telah berakhir. Silakan login kembali.')
  }

  return response
}
