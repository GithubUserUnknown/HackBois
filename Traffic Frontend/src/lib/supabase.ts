import { createClient } from '@jsr/supabase__supabase-js'
import { projectId, publicAnonKey } from '../utils/supabase/info'

const supabaseUrl = `https://${projectId}.supabase.co`
const supabaseAnonKey = publicAnonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
