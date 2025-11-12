import axios from 'axios'
import { API_BASE_URL } from '../config'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const loginForm = async (email, password) => {
  const params = new URLSearchParams()
  params.append('username', email)
  params.append('password', password)
  const { data } = await api.post('/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const fetchMe = async () => (await api.get('/user/me')).data
export const fetchUsers = async () => (await api.get('/users')).data
export const fetchDepartments = async () => (await api.get('/departments')).data
export const createShoutout = async (payload) => (await api.post('/shoutout/create', payload)).data
export const fetchFeed = async (params) => (await api.get('/shoutout/feed', { params })).data
export const toggleReaction = async (payload) => (await api.post('/reaction/toggle', payload)).data

// Comments
export const fetchComments = async (shoutoutId) => (await api.get(`/comment/fetch/${shoutoutId}`)).data
export const addComment = async (payload) => (await api.post('/comment/add', payload)).data

// Reports (Phase 4)
export const reportShoutout = async (payload) => (await api.post('/shoutout/report', payload)).data
export const reportComment = async (payload) => (await api.post('/comment/report', payload)).data

// Admin
export const adminUsers = async () => (await api.get('/admin/users')).data
export const adminDeleteUser = async (id) => (await api.delete(`/admin/users/${id}`)).data
export const adminShoutouts = async () => (await api.get('/admin/shoutouts')).data
export const adminDeleteShoutout = async (sid) => (await api.delete(`/admin/shoutouts/${sid}`)).data
export const adminReports = async () => (await api.get('/admin/reports')).data
export const adminDismissReport = async (rid) => (await api.post(`/admin/reports/${rid}/dismiss`)).data
export const adminAnalytics = async () => (await api.get('/admin/analytics')).data
