import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://qrklhmkrofdfstavxxuq.supabase.co"
const supabaseKey = "sb_publishable_xGjxic2yK0BLi0zxUzY0UA_kgSicz1-"

export const supabase = createClient(supabaseUrl, supabaseKey)