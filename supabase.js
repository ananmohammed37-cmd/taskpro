// =============================================
// supabase.js — Supabase Client
// ضع هذا الملف في: frontend/supabase.js
// =============================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 🔑 استبدل هذه القيم بقيمك من Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://zzzwtofefyvqyzxnhydc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qvn6wEqUfycAjq6VTmbR5w__WXUz_fE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// =============================================
// AUTH HELPERS
// =============================================

export async function signUp(email, password, username, role = 'worker') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, role } }
  })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser() {
  const session = await getSession()
  if (!session) return null
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return data
}

// =============================================
// TASKS HELPERS
// =============================================

export async function getTasks(category = null, search = null) {
  let query = supabase
    .from('tasks')
    .select(`*, created_by_user:users!tasks_created_by_fkey(username)`)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  return { data, error }
}

export async function getAllTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select(`*, assigned_user:users!tasks_assigned_to_fkey(username)`)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function createTask(task) {
  const user = await getUser()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, created_by: user.id })
    .select()
    .single()
  return { data, error }
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// =============================================
// APPLICATIONS HELPERS
// =============================================

export async function applyToTask(taskId, coverNote = '') {
  const user = await getUser()
  const { data, error } = await supabase
    .from('applications')
    .insert({ task_id: taskId, worker_id: user.id, cover_note: coverNote })
    .select()
    .single()
  return { data, error }
}

export async function getMyApplications() {
  const user = await getUser()
  const { data, error } = await supabase
    .from('applications')
    .select(`*, task:tasks(*)`)
    .eq('worker_id', user.id)
  return { data, error }
}

export async function getTaskApplications(taskId) {
  const { data, error } = await supabase
    .from('applications')
    .select(`*, worker:users(username, rating, completed_tasks)`)
    .eq('task_id', taskId)
  return { data, error }
}

export async function acceptApplication(appId, taskId, workerId) {
  // Accept this application
  await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId)
  // Reject others
  await supabase.from('applications')
    .update({ status: 'rejected' })
    .eq('task_id', taskId)
    .neq('id', appId)
  // Assign task
  await supabase.from('tasks')
    .update({ status: 'assigned', assigned_to: workerId })
    .eq('id', taskId)
  // Notify worker
  await createNotification(workerId, '🎉 تم قبول طلبك!', 'تم قبول طلبك لتنفيذ مهمة. ابدأ العمل الآن!')
}

// =============================================
// SUBMISSIONS HELPERS
// =============================================

export async function submitWork(taskId, content, files = []) {
  const user = await getUser()
  const { data, error } = await supabase
    .from('submissions')
    .insert({ task_id: taskId, worker_id: user.id, content, files })
    .select()
    .single()
  if (!error) {
    await supabase.from('tasks').update({ status: 'review' }).eq('id', taskId)
  }
  return { data, error }
}

export async function approveSubmission(submissionId, taskId, workerId, reward) {
  // Approve submission
  await supabase.from('submissions').update({ status: 'approved' }).eq('id', submissionId)
  // Complete task
  await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId)
  // Create payment record
  const { data: payment } = await supabase
    .from('payments')
    .insert({ worker_id: workerId, task_id: taskId, amount: reward, status: 'pending' })
    .select().single()
  // Update worker balance
  await supabase.rpc('complete_payment', { payment_id: payment.id })
  // Notify worker
  await createNotification(workerId, '💎 تم إضافة أرباحك!', `تم إضافة ${reward} USDT لمحفظتك`)
}

export async function rejectSubmission(submissionId, taskId, feedback) {
  await supabase.from('submissions').update({ status: 'rejected', feedback }).eq('id', submissionId)
  await supabase.from('tasks').update({ status: 'assigned' }).eq('id', taskId)
}

// =============================================
// PAYMENTS HELPERS
// =============================================

export async function getMyPayments() {
  const user = await getUser()
  const { data, error } = await supabase
    .from('payments')
    .select(`*, task:tasks(title)`)
    .eq('worker_id', user.id)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function getAllPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select(`*, worker:users(username), task:tasks(title)`)
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function requestWithdraw(amount, walletAddress, network = 'TRC20') {
  const user = await getUser()
  if (user.balance < amount) return { error: 'رصيد غير كافٍ' }
  // Deduct balance
  await supabase.from('users')
    .update({ balance: user.balance - amount })
    .eq('id', user.id)
  // Create withdrawal record
  const { data, error } = await supabase
    .from('payments')
    .insert({
      worker_id: user.id,
      amount: -amount,
      wallet_address: walletAddress,
      network,
      status: 'processing'
    })
    .select().single()
  return { data, error }
}

// =============================================
// NOTIFICATIONS HELPERS
// =============================================

export async function createNotification(userId, title, message, type = 'info') {
  await supabase.from('notifications').insert({ user_id: userId, title, message, type })
}

export async function getMyNotifications() {
  const user = await getUser()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  return data
}

export async function markAllRead() {
  const user = await getUser()
  await supabase.from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
}

// =============================================
// REALTIME SUBSCRIPTIONS
// =============================================

export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe()
}

export function subscribeToTasks(callback) {
  return supabase
    .channel('tasks')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks'
    }, callback)
    .subscribe()
}
